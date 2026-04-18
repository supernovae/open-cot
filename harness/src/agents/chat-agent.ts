/**
 * Chat agent — simple governed mode with pre-authorized tool shortcut
 * (plan → execute_tool, skipping delegation when sandbox allows the tool).
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
  emitVerify,
  emitThought,
  emitCritique,
  finalizeTrace,
  resetStepCounter,
} from "../core/trace-emitter.js";
import type { Trace, ToolInvocation } from "../schemas/trace.js";
import type { BudgetPolicy } from "../schemas/budget.js";
import type { SandboxConfig } from "../schemas/sandbox.js";
import { DEFAULT_SANDBOX_CONFIG } from "../schemas/sandbox.js";
import { buildManifest, serializeManifest } from "../governance/manifest-builder.js";
import type { WireFormat } from "../governance/manifest-builder.js";

function halted(state: AgentState): boolean {
  return state.phase === "audit_seal";
}

function isPreAuthorized(toolName: string, sandbox: SandboxConfig): boolean {
  if (sandbox.blockedTools.includes(toolName)) return false;
  if (sandbox.allowedTools.includes("*")) return true;
  return sandbox.allowedTools.includes(toolName);
}

export async function runChatAgent(
  backend: LLMBackend,
  objective: string,
  toolRegistry: ToolRegistry,
  budgetPolicy?: BudgetPolicy,
  sandbox?: SandboxConfig,
  wireFormat?: WireFormat,
): Promise<Trace> {
  resetStepCounter();
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
    { role: "system", content: "Interpret the task. Do not use tools." },
    { role: "user", content: `[harness:frame]\n${objective}` },
  ]);
  if (halted(state)) return end(frameResp.content);
  emitThought(state, `[frame] ${frameResp.content}`);
  budget.recordStep(state, "frame");
  transition(state, "plan", "Framed");

  // plan (with capability manifest)
  if (halted(state)) return end("");
  const manifest = buildManifest({
    runId: state.runId,
    agentId: state.telemetry.agent_id,
    phase: "plan",
    toolContracts: toolRegistry.listTools(),
    sandbox: sb,
    policies: [],
    budget: state.budget,
  });
  state.capabilityManifest = manifest;
  const manifestText = serializeManifest(manifest, wireFormat);
  const planResp = await callLLM([
    { role: "system", content: `Plan and propose actions; use tools only if needed.\n\n${manifestText}` },
    { role: "user", content: `[harness:plan]\n${objective}` },
  ]);
  if (halted(state)) return end(planResp.content);
  const planStep = emitPlan(state, planResp.content);
  budget.recordStep(state, "plan");

  const toolCalls = lastResponse?.toolCalls ?? [];

  if (toolCalls.length === 0) {
    transition(state, "finalize", "Pure reasoning path");
    if (halted(state)) return end(planResp.content);
    const fin = await callLLM([
      { role: "system", content: "Produce the final answer for the user." },
      {
        role: "user",
        content: `[harness:finalize]\n${objective}\n\nPlan:\n${planResp.content}`,
      },
    ]);
    if (halted(state)) return end(fin.content || planResp.content);
    transition(state, "audit_seal", "Complete");
    return end(fin.content || planResp.content);
  }

  for (const tc of toolCalls) {
    if (!isPreAuthorized(tc.toolName, state.sandbox)) {
      forceStop(state, "failed", `Tool "${tc.toolName}" is not pre-authorized in sandbox`);
      return end(`Tool "${tc.toolName}" is not allowed in simple chat mode.`);
    }
  }

  for (let i = 0; i < toolCalls.length; i++) {
    if (halted(state)) return end("");
    const tc = toolCalls[i]!;

    if (i > 0) {
      transition(state, "plan", `Next tool ${i + 1}/${toolCalls.length}`);
      emitThought(state, `[plan] executing remaining tool ${tc.toolName}`);
      budget.recordStep(state, "plan");
    }

    transition(state, "execute_tool", `Pre-authorized call: ${tc.toolName}`);
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

    transition(state, "observe_result", "Tool finished");
    const obs = result.error ? `Error: ${result.error}` : JSON.stringify(result.output);
    emitObservation(state, obs, actionStep.id);
    budget.recordStep(state, "observe_result");

    transition(state, "critique_verify", "Check tool output");
    if (halted(state)) return end("");
    const critique = await callLLM([
      { role: "system", content: "Briefly verify the observation against the user goal." },
      {
        role: "user",
        content: `[harness:critique]\nObjective: ${objective}\nObservation:\n${obs}`,
      },
    ]);
    if (halted(state)) return end(critique.content);
    emitCritique(state, critique.content);
    budget.recordStep(state, "critique_verify");
  }

  if (halted(state)) return end("");
  transition(state, "finalize", "Compose final answer");
  const finalResp = await callLLM([
    { role: "system", content: "Answer the user using the plan and tool observations." },
    { role: "user", content: `[harness:finalize]\n${objective}` },
  ]);
  if (halted(state)) return end(finalResp.content || planResp.content);
  const verifyText = finalResp.content;
  const ok =
    !verifyText.toLowerCase().includes("incorrect") &&
    !verifyText.toLowerCase().includes("wrong");
  emitVerify(state, verifyText, ok ? "verified" : "unknown");
  transition(state, "audit_seal", "Chat run sealed");

  return end(finalResp.content || planResp.content);
}
