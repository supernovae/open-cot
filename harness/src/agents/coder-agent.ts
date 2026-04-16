/**
 * Coder agent — plan-do-act coding agent with full FSM traversal.
 *
 * Demonstrates: plan -> inspect -> act -> verify -> (repair loop) -> summarize -> stop.
 * Exercises every FSM phase, plan versioning, evidence collection,
 * verify-after-change policy, and budget exhaustion handling.
 */

import type { LLMBackend, LLMResponseWithTools } from "../backends/types.js";
import { createBudgetTracker } from "../core/budget-tracker.js";
import type { BudgetTracker } from "../core/budget-tracker.js";
import type { LoopPolicy } from "../core/loop-policy.js";
import { DEFAULT_LOOP_POLICY } from "../core/loop-policy.js";
import type { AgentState } from "../core/state.js";
import { createAgentState } from "../core/state.js";
import {
  emitPlan,
  emitAction,
  emitObservation,
  emitVerify,
  emitThought,
  emitCritique,
  emitSummary,
  finalizeTrace,
  resetStepCounter,
} from "../core/trace-emitter.js";
import { transition } from "../core/transitions.js";
import type { ToolRegistry } from "../core/tool-registry.js";
import type { Trace, ToolInvocation } from "../schemas/trace.js";
import type { BudgetPolicy } from "../schemas/budget.js";
import type { SandboxConfig } from "../schemas/sandbox.js";

function isStopped(state: AgentState): boolean {
  return (state.phase as string) === "stop";
}

export interface CoderAgentConfig {
  backend: LLMBackend;
  tools: ToolRegistry;
  budgetPolicy?: BudgetPolicy;
  loopPolicy?: LoopPolicy;
  sandbox?: SandboxConfig;
  maxRepairAttempts?: number;
}

export interface CoderResult {
  answer: string;
  trace: Trace;
  state: AgentState;
}

export async function runCoderAgent(
  task: string,
  config: CoderAgentConfig,
): Promise<CoderResult> {
  resetStepCounter();
  const maxRepairs = config.maxRepairAttempts ?? 3;
  const budget = createBudgetTracker();
  const state = createAgentState({
    objective: task,
    budgetPolicy: config.budgetPolicy,
    sandbox: config.sandbox,
  });

  let lastLLMResponse: LLMResponseWithTools | undefined;

  const callLLM = async (
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  ): Promise<string> => {
    if (isStopped(state)) return "";
    const response = await config.backend.chat(messages);
    budget.recordTokens(state, response.tokensUsed, `LLM call (${config.backend.name})`);
    lastLLMResponse = response;
    return response.content;
  };

  const executeToolCalls = async (parentStepId: string): Promise<void> => {
    if (!lastLLMResponse?.toolCalls) return;
    for (const tc of lastLLMResponse.toolCalls) {
      const inv: ToolInvocation = {
        tool_name: tc.toolName,
        arguments: tc.arguments,
        triggered_by_step: parentStepId,
      };
      const actionStep = emitAction(state, `call:${tc.toolName}`, inv, parentStepId);
      budget.recordToolCall(state, `tool:${tc.toolName}`);
      if (isStopped(state)) return;

      const result = await config.tools.call(tc.toolName, tc.arguments, state.sandbox);
      emitObservation(
        state,
        result.error ? `Error: ${result.error}` : JSON.stringify(result.output),
        actionStep.id,
      );
    }
  };

  // ── Phase 1: Plan ──
  const planContent = await callLLM([
    {
      role: "system",
      content:
        "You are a coding assistant. Break the task into steps: inspect -> edit -> verify.",
    },
    { role: "user", content: task },
  ]);
  if (isStopped(state)) return finish(state);

  const planStep = emitPlan(state, planContent);
  budget.recordStep(state, "plan");

  // ── Phase 2: Inspect ──
  transition(state, "inspect", "Reading files to gather context");
  const inspectResponse = await callLLM([
    { role: "system", content: "Inspect the relevant files. Use readFile to gather context." },
    { role: "user", content: task },
    { role: "assistant", content: planContent },
  ]);
  if (isStopped(state)) return finish(state);

  if (lastLLMResponse?.toolCalls) {
    await executeToolCalls(planStep.id);
  } else {
    emitThought(state, inspectResponse, planStep.id);
  }
  budget.recordStep(state, "inspect");

  // ── Phase 3: Act (write/edit files) ──
  transition(state, "act", "Making code changes");
  const actResponse = await callLLM([
    { role: "system", content: "Make the necessary code changes. Use writeFile to edit files." },
    { role: "user", content: task },
  ]);
  if (isStopped(state)) return finish(state);

  if (lastLLMResponse?.toolCalls) {
    await executeToolCalls(planStep.id);
  } else {
    emitThought(state, actResponse, planStep.id);
  }
  budget.recordStep(state, "act");

  // ── Phase 4: Verify + Repair loop ──
  let verified = false;
  let repairCount = 0;

  while (!verified && repairCount <= maxRepairs && !isStopped(state)) {
    transition(state, "verify", repairCount === 0 ? "Running tests" : `Re-verifying after repair #${repairCount}`);
    const verifyResponse = await callLLM([
      { role: "system", content: "Verify the changes by running tests. Report pass/fail." },
      { role: "user", content: `verify changes for: ${task}` },
    ]);
    if (isStopped(state)) return finish(state);

    let testOutput = "";
    if (lastLLMResponse?.toolCalls) {
      for (const tc of lastLLMResponse.toolCalls) {
        const inv: ToolInvocation = {
          tool_name: tc.toolName,
          arguments: tc.arguments,
          triggered_by_step: planStep.id,
        };
        const actionStep = emitAction(state, `call:${tc.toolName}`, inv);
        budget.recordToolCall(state, `tool:${tc.toolName}`);
        if (isStopped(state)) return finish(state);

        const result = await config.tools.call(tc.toolName, tc.arguments, state.sandbox);
        testOutput = result.error ? `Error: ${result.error}` : JSON.stringify(result.output);
        emitObservation(state, testOutput, actionStep.id);
      }
    }

    const passed =
      verifyResponse.toLowerCase().includes("correct") ||
      verifyResponse.toLowerCase().includes("passed") ||
      testOutput.includes('"failed":0');
    emitVerify(
      state,
      verifyResponse + (testOutput ? `\nTest output: ${testOutput}` : ""),
      passed ? "verified" : "failed",
    );
    budget.recordStep(state, "verify");

    if (passed) {
      verified = true;
    } else if (repairCount < maxRepairs) {
      repairCount++;
      transition(state, "repair", `Repair attempt #${repairCount}`);
      emitCritique(state, `Verification failed. Attempting repair #${repairCount}.`);

      const _repairResponse = await callLLM([
        { role: "system", content: "Fix the issues found during verification." },
        { role: "user", content: `fix the error in: ${task}` },
      ]);
      if (isStopped(state)) return finish(state);

      if (lastLLMResponse?.toolCalls) {
        await executeToolCalls(planStep.id);
      } else {
        emitThought(state, _repairResponse);
      }
      budget.recordStep(state, "repair");

      // Back to act before re-verify
      transition(state, "act", "Re-applying after repair");
      budget.recordStep(state, "act (post-repair)");
    } else {
      emitCritique(state, `Max repair attempts (${maxRepairs}) reached. Proceeding to summarize.`);
      state.completionStatus = "failed";
      break;
    }
  }

  // ── Phase 5: Summarize ──
  if (!isStopped(state)) {
    transition(state, "summarize", "Producing final summary");
    const summaryResponse = await callLLM([
      { role: "system", content: "Summarize what was done and the final state." },
      { role: "user", content: `summarize: ${task}` },
    ]);
    if (!isStopped(state)) {
      emitSummary(state, summaryResponse);
      budget.recordStep(state, "summarize");
    }
  }

  // ── Phase 6: Stop ──
  if (!isStopped(state)) {
    transition(state, "stop", verified ? "Task completed successfully" : "Task completed with issues");
  }

  return finish(state);
}

function finish(state: AgentState): CoderResult {
  const answer = state.trace.final_answer || state.completionStatus;
  finalizeTrace(state, answer);
  return { answer, trace: state.trace, state };
}
