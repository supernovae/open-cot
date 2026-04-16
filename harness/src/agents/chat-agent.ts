/**
 * Chat agent — LangGraph-style conversational agent.
 *
 * Demonstrates: plan -> act (optional tool calls) -> verify -> respond.
 * Uses the core FSM, budget tracker, tool registry, and trace emitter.
 */

import type { LLMBackend, LLMResponseWithTools } from "../backends/types.js";
import type { BudgetTracker } from "../core/budget-tracker.js";
import { createBudgetTracker } from "../core/budget-tracker.js";
import type { LoopPolicy } from "../core/loop-policy.js";
import { DEFAULT_LOOP_POLICY, checkPolicy } from "../core/loop-policy.js";
import type { AgentState } from "../core/state.js";
import { createAgentState } from "../core/state.js";
import {
  emitPlan,
  emitAction,
  emitObservation,
  emitVerify,
  emitThought,
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

export interface ChatAgentConfig {
  backend: LLMBackend;
  tools: ToolRegistry;
  budgetPolicy?: BudgetPolicy;
  loopPolicy?: LoopPolicy;
  sandbox?: SandboxConfig;
}

export interface ChatResult {
  answer: string;
  trace: Trace;
  state: AgentState;
}

export async function runChatAgent(
  userMessage: string,
  config: ChatAgentConfig,
): Promise<ChatResult> {
  resetStepCounter();
  const policy = config.loopPolicy ?? DEFAULT_LOOP_POLICY;
  const budget = createBudgetTracker();
  const state = createAgentState({
    objective: userMessage,
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

  // Phase 1: Plan
  const planResponse = await callLLM([
    { role: "system", content: "You are a helpful assistant. Plan your approach step by step." },
    { role: "user", content: userMessage },
  ]);
  if (isStopped(state)) return finish(state, planResponse);

  const planStep = emitPlan(state, planResponse);
  budget.recordStep(state, "plan");

  // Phase 2: Act (tool calls if the LLM requests them)
  transition(state, "act", "Executing plan actions");
  const actResponse = await callLLM([
    { role: "system", content: "Execute the plan. If you need tools, request them." },
    { role: "user", content: userMessage },
    { role: "assistant", content: planResponse },
  ]);
  if (isStopped(state)) return finish(state, actResponse);

  if (lastLLMResponse?.toolCalls && lastLLMResponse.toolCalls.length > 0) {
    for (const tc of lastLLMResponse.toolCalls) {
      const invocation: ToolInvocation = {
        tool_name: tc.toolName,
        arguments: tc.arguments,
        triggered_by_step: planStep.id,
      };
      const actionStep = emitAction(state, `call:${tc.toolName}`, invocation, planStep.id);
      budget.recordToolCall(state, `tool:${tc.toolName}`);
      if (isStopped(state)) return finish(state, "");

      const result = await config.tools.call(tc.toolName, tc.arguments, state.sandbox);
      const obsContent = result.error
        ? `Error: ${result.error}`
        : JSON.stringify(result.output);
      emitObservation(state, obsContent, actionStep.id);
    }
  } else {
    emitThought(state, actResponse, planStep.id);
  }
  budget.recordStep(state, "act");

  // Phase 3: Verify
  const violations = checkPolicy(state, "verify", policy);
  transition(state, "verify", "Verifying results");
  const verifyResponse = await callLLM([
    { role: "system", content: "Verify the results. Are they correct?" },
    { role: "user", content: userMessage },
    { role: "assistant", content: actResponse },
  ]);
  if (isStopped(state)) return finish(state, verifyResponse);

  const isVerified = !verifyResponse.toLowerCase().includes("incorrect") &&
    !verifyResponse.toLowerCase().includes("wrong");
  emitVerify(state, verifyResponse, isVerified ? "verified" : "failed");
  budget.recordStep(state, "verify");

  if (violations.length > 0) {
    for (const v of violations) {
      emitThought(state, `[policy:${v.rule}] ${v.message}`);
    }
  }

  // Phase 4: Stop
  transition(state, "stop", "Delivering final answer");
  return finish(state, verifyResponse);
}

function finish(state: AgentState, lastContent: string): ChatResult {
  const answer = lastContent || state.trace.final_answer || "No answer produced";
  finalizeTrace(state, answer);
  return { answer, trace: state.trace, state };
}
