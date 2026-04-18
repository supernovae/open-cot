/**
 * Coder agent — plan / execute (pre-authorized) / observe / critique with repair loop.
 */

import type { LLMBackend, LLMMessage, LLMResponseWithTools } from "../backends/types.js";
import type { AgentState } from "../core/state.js";
import { createAgentState } from "../core/state.js";
import { transition, forceStop } from "../core/transitions.js";
import { createBudgetTracker } from "../core/budget-tracker.js";
import type { ToolRegistry } from "../core/tool-registry.js";
import {
  emitPlan,
  emitAction,
  emitObservation,
  emitThought,
  emitCritique,
  emitSummary,
  finalizeTrace,
  resetStepCounter,
} from "../core/trace-emitter.js";
import type { Trace, ToolInvocation } from "../schemas/trace.js";
import type { BudgetPolicy } from "../schemas/budget.js";
import type { SandboxConfig } from "../schemas/sandbox.js";
import { DEFAULT_SANDBOX_CONFIG } from "../schemas/sandbox.js";
import { buildManifest, manifestToCompactText } from "../governance/manifest-builder.js";

function halted(state: AgentState): boolean {
  return state.phase === "audit_seal";
}

function isPreAuthorized(toolName: string, sandbox: SandboxConfig): boolean {
  if (sandbox.blockedTools.includes(toolName)) return false;
  if (sandbox.allowedTools.includes("*")) return true;
  return sandbox.allowedTools.includes(toolName);
}

export async function runCoderAgent(
  backend: LLMBackend,
  objective: string,
  toolRegistry: ToolRegistry,
  budgetPolicy?: BudgetPolicy,
  sandbox?: SandboxConfig,
  maxRepairAttempts?: number,
): Promise<Trace> {
  resetStepCounter();
  const maxRepairs = maxRepairAttempts ?? 3;
  const budget = createBudgetTracker();
  const sb = sandbox ?? DEFAULT_SANDBOX_CONFIG;
  const state = createAgentState({
    objective,
    budgetPolicy,
    sandbox: sb,
  });

  let lastResponse: LLMResponseWithTools | undefined;

  const callLLM = async (messages: LLMMessage[]): Promise<LLMResponseWithTools> => {
    if (halted(state)) {
      return { content: "", tokensUsed: 0, model: "noop", finishReason: "stop" };
    }
    try {
      const response = await backend.chat(messages);
      budget.recordTokens(state, response.tokensUsed, `LLM (${backend.name})`);
      lastResponse = response;
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      forceStop(state, "fail_safe", msg);
      return { content: "", tokensUsed: 0, model: "error", finishReason: "stop" };
    }
  };

  const end = (answer: string): Trace => {
    finalizeTrace(state, answer || state.trace.final_answer || String(state.completionStatus));
    return state.trace;
  };

  // receive
  emitThought(state, `[receive] ${objective}`);
  budget.recordStep(state, "receive");
  transition(state, "frame", "Begin framing");

  // frame
  if (halted(state)) return end("");
  const frameResp = await callLLM([
    {
      role: "system",
      content: "Frame the coding task: goals, files, risks. Do not call tools yet.",
    },
    { role: "user", content: `[harness:frame]\n${objective}` },
  ]);
  if (halted(state)) return end(frameResp.content);
  emitThought(state, `[frame] ${frameResp.content}`);
  budget.recordStep(state, "frame");
  transition(state, "plan", "Framed");

  const manifest = buildManifest({
    runId: state.runId,
    agentId: state.telemetry.agent_id,
    phase: "plan",
    toolContracts: toolRegistry.listTools(),
    sandbox: state.sandbox,
    policies: [],
    budget: state.budget,
  });
  state.capabilityManifest = manifest;
  const manifestText = manifestToCompactText(manifest);

  let repairCount = 0;
  let lastCritique = "";

  while (repairCount <= maxRepairs && !halted(state)) {
    if (halted(state)) return end("");

    const planResp = await callLLM([
      {
        role: "system",
        content: `You are a coding assistant. Propose concrete steps and use tools when needed.\n\n${manifestText}`,
      },
      { role: "user", content: `[harness:plan]\n${objective}` },
    ]);
    if (halted(state)) return end(planResp.content);
    const planStep = emitPlan(state, planResp.content);
    budget.recordStep(state, "plan");

    const toolCalls = lastResponse?.toolCalls ?? [];

    if (toolCalls.length === 0) {
      emitThought(state, planResp.content, planStep.id);
      lastCritique = "No tools invoked; proceeding to finalize.";
      break;
    }

    for (const tc of toolCalls) {
      if (!isPreAuthorized(tc.toolName, state.sandbox)) {
        forceStop(state, "failed", `Tool "${tc.toolName}" is not pre-authorized`);
        return end(`Tool "${tc.toolName}" is blocked or not allowlisted.`);
      }
    }

    for (let i = 0; i < toolCalls.length; i++) {
      if (halted(state)) return end("");
      const tc = toolCalls[i]!;

      if (i > 0) {
        transition(state, "plan", `Next coding tool ${i + 1}/${toolCalls.length}`);
        emitThought(state, `[plan] continue with ${tc.toolName}`);
        budget.recordStep(state, "plan");
      }

      transition(state, "execute_tool", `Execute ${tc.toolName}`);
      const inv: ToolInvocation = {
        tool_name: tc.toolName,
        arguments: tc.arguments,
        triggered_by_step: planStep.id,
      };
      const actionStep = emitAction(state, `call:${tc.toolName}`, inv, planStep.id);
      budget.recordToolCall(state, `tool:${tc.toolName}`);

      let result;
      try {
        result = await toolRegistry.call(tc.toolName, tc.arguments, state.sandbox);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        forceStop(state, "fail_safe", msg);
        return end("");
      }

      transition(state, "observe_result", "Captured tool output");
      const obs = result.error ? `Error: ${result.error}` : JSON.stringify(result.output);
      emitObservation(state, obs, actionStep.id);
      budget.recordStep(state, "observe_result");

      transition(state, "critique_verify", "Verify step output");
      if (halted(state)) return end("");
      const critiqueResp = await callLLM([
        {
          role: "system",
          content: "Critique the tool output. Say whether changes look correct or need repair.",
        },
        {
          role: "user",
          content: `[harness:critique]\nTask: ${objective}\nObservation:\n${obs}`,
        },
      ]);
      if (halted(state)) return end(critiqueResp.content);
      emitCritique(state, critiqueResp.content);
      budget.recordStep(state, "critique_verify");
      lastCritique = critiqueResp.content;
    }

    const failed =
      lastCritique.toLowerCase().includes("incorrect") ||
      lastCritique.toLowerCase().includes("failed") ||
      lastCritique.toLowerCase().includes("error");

    if (!failed) break;

    if (repairCount >= maxRepairs) {
      state.completionStatus = "failed";
      emitCritique(state, `Max repair attempts (${maxRepairs}) reached.`);
      break;
    }

    repairCount++;
    emitCritique(state, `Repair cycle ${repairCount}: re-planning after failed verification.`);
    transition(state, "plan", "Re-plan after critique");
  }

  if (halted(state)) return end("");

  transition(state, "finalize", "Summarize coding outcome");
  const summaryResp = await callLLM([
    { role: "system", content: "Summarize what was done and the final state of the code." },
    { role: "user", content: `[harness:finalize]\n${objective}` },
  ]);
  if (halted(state)) return end(summaryResp.content);
  emitSummary(state, summaryResp.content);
  budget.recordStep(state, "finalize");

  transition(
    state,
    "audit_seal",
    state.completionStatus === "failed" ? "Completed with issues" : "Coder run sealed",
  );

  return end(summaryResp.content);
}
