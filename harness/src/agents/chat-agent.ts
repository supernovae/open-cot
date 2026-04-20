/**
 * Chat agent — policy-governed conversational loop with optional tool use.
 */

import { randomUUID } from "node:crypto";
import type { LLMBackend, LLMMessage, LLMResponseWithTools } from "../backends/types.js";
import type { AgentState } from "../core/state.js";
import { createAgentState } from "../core/state.js";
import { transition, forceStop } from "../core/transitions.js";
import { createBudgetTracker } from "../core/budget-tracker.js";
import { callLLMWithCircuitBreaker } from "../core/llm-circuit-breaker.js";
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
import { toLLMToolDefinitions } from "../tools/llm-tools.js";
import type { PolicySet } from "../governance/policy-evaluator.js";
import type {
  DelegationPolicyEngine,
} from "../governance/policy-engine.js";
import { InProcessPolicyEngine } from "../governance/policy-engine.js";
import { buildSandboxPolicySets } from "../governance/sandbox-policies.js";
import type { DelegationRequest } from "../schemas/delegation.js";
import type { Phase } from "../schemas/agent-loop.js";

function halted(state: AgentState): boolean {
  return state.phase === "audit_seal";
}

export interface ChatGovernanceOptions {
  policies?: PolicySet[];
  policyEngine?: DelegationPolicyEngine;
}

export async function runChatAgent(
  backend: LLMBackend,
  objective: string,
  toolRegistry: ToolRegistry,
  budgetPolicy?: BudgetPolicy,
  sandbox?: SandboxConfig,
  wireFormat?: WireFormat,
  governance?: ChatGovernanceOptions,
): Promise<Trace> {
  resetStepCounter();
  const budget = createBudgetTracker();
  const sb = sandbox ?? DEFAULT_SANDBOX_CONFIG;
  const toolContracts = toolRegistry.listTools();
  const defaultPolicies = buildSandboxPolicySets(sb);
  const effectivePolicies = governance?.policies ?? defaultPolicies;
  const policyEngine =
    governance?.policyEngine ?? new InProcessPolicyEngine(effectivePolicies);
  const state = createAgentState({
    objective,
    budgetPolicy,
    sandbox: sb,
  });

  let lastResponse: LLMResponseWithTools | undefined;

  const callLLM = async (
    messages: LLMMessage[],
    modelVisibleTools = toLLMToolDefinitions(toolContracts),
  ): Promise<LLMResponseWithTools> => {
    const response = await callLLMWithCircuitBreaker({
      backend,
      messages,
      state,
      budget,
      llmReason: `LLM (${backend.name})`,
      stream: true,
      safety: {
        maxDecodedChars: 12_000,
      },
      tools: modelVisibleTools,
      toolChoice: "auto",
    });
    lastResponse = response;
    return response;
  };

  const end = (answer: string): Trace => {
    finalizeTrace(state, answer || state.trace.final_answer || String(state.completionStatus));
    return state.trace;
  };

  const consultPhase = async (
    phase: Phase,
    context?: Record<string, unknown>,
  ): Promise<boolean> => {
    if (!policyEngine.consultPhase) {
      return true;
    }
    const decision = await policyEngine.consultPhase({
      runId: state.runId,
      agentId: state.telemetry.agent_id,
      objective,
      phase,
      context,
    });
    if (decision.status === "allowed") {
      return true;
    }
    forceStop(
      state,
      "denied",
      `Policy denied at phase ${phase}: ${decision.reason ?? "Denied by policy"}`,
    );
    return false;
  };

  const manifestHeartbeat = async (phase: Phase) => {
    let toolOverrides:
      | Record<
          string,
          {
            accessLevel: "pre_authorized" | "requires_delegation" | "blocked";
            constraints?: Record<string, unknown>;
            reason?: string;
          }
        >
      | undefined;
    if (policyEngine.previewToolAccess) {
      const preview = await policyEngine.previewToolAccess({
        runId: state.runId,
        agentId: state.telemetry.agent_id,
        objective,
        phase,
        tools: toolContracts,
        sandbox: state.sandbox,
        context: { phase },
      });
      toolOverrides = Object.fromEntries(
        Object.entries(preview).map(([name, result]) => [
          name,
          {
            accessLevel: result.accessLevel,
            constraints: result.constraints,
            reason: result.reason,
          },
        ]),
      );
    }
    const manifest = buildManifest({
      runId: state.runId,
      agentId: state.telemetry.agent_id,
      phase,
      toolContracts,
      sandbox: sb,
      policies: effectivePolicies,
      budget: state.budget,
      toolOverrides,
    });
    state.capabilityManifest = manifest;
    return {
      manifestText: serializeManifest(manifest, wireFormat),
      modelVisibleTools: toLLMToolDefinitions(
        toolContracts,
        new Set(manifest.tools.available.map((tool) => tool.name)),
      ),
    };
  };

  // receive
  emitThought(state, `[receive] ${objective}`);
  budget.recordStep(state, "receive");
  transition(state, "frame", "Begin framing");

  // frame
  if (halted(state)) return end("");
  if (!(await consultPhase("frame"))) {
    return end("Request denied by policy.");
  }
  const frameResp = await callLLM([
    { role: "system", content: "Interpret the task. Do not use tools." },
    { role: "user", content: `[harness:frame]\n${objective}` },
  ], []);
  if (halted(state)) return end(frameResp.content);
  emitThought(state, `[frame] ${frameResp.content}`);
  budget.recordStep(state, "frame");
  transition(state, "plan", "Framed");

  // plan (with capability manifest)
  if (halted(state)) return end("");
  if (!(await consultPhase("plan"))) {
    return end("Request denied by policy.");
  }
  const planHeartbeat = await manifestHeartbeat("plan");
  const planResp = await callLLM([
    {
      role: "system",
      content: `Plan and propose actions; use tools only if needed.\n\n${planHeartbeat.manifestText}`,
    },
    { role: "user", content: `[harness:plan]\n${objective}` },
  ], planHeartbeat.modelVisibleTools);
  if (halted(state)) return end(planResp.content);
  const planStep = emitPlan(state, planResp.content);
  budget.recordStep(state, "plan");

  const toolCalls = lastResponse?.toolCalls ?? [];

  if (toolCalls.length === 0) {
    transition(state, "finalize", "Pure reasoning path");
    if (halted(state)) return end(planResp.content);
    if (!(await consultPhase("finalize"))) {
      return end("Request denied by policy.");
    }
    const noToolFinalizeHeartbeat = await manifestHeartbeat("finalize");
    const fin = await callLLM([
      {
        role: "system",
        content: `Produce the final answer for the user.\n\n${noToolFinalizeHeartbeat.manifestText}`,
      },
      {
        role: "user",
        content: `[harness:finalize]\n${objective}\n\nPlan:\n${planResp.content}`,
      },
    ], noToolFinalizeHeartbeat.modelVisibleTools);
    if (halted(state)) return end(fin.content || planResp.content);
    transition(state, "audit_seal", "Complete");
    return end(fin.content || planResp.content);
  }

  for (let i = 0; i < toolCalls.length; i++) {
    if (halted(state)) return end("");
    const tc = toolCalls[i]!;

    if (i > 0) {
      transition(state, "plan", `Next tool ${i + 1}/${toolCalls.length}`);
      emitThought(state, `[plan] executing remaining tool ${tc.toolName}`);
      budget.recordStep(state, "plan");
    }
    if (
      !(await consultPhase("plan", {
        tool_name: tc.toolName,
      }))
    ) {
      return end("Request denied by policy.");
    }

    transition(state, "request_authority", `Evaluate authority for ${tc.toolName}`);
    budget.recordStep(state, "request_authority");
    const delegationRequest: DelegationRequest = {
      schema_version: "0.2",
      request_id: `req-${randomUUID()}`,
      requester: state.telemetry.agent_id,
      run_id: state.runId,
      intent: `Use ${tc.toolName} to support objective`,
      justification: `Model selected tool ${tc.toolName}`,
      requested_scope: {
        resource: `tool:${tc.toolName}`,
        action: "execute",
        constraints:
          tc.arguments && typeof tc.arguments === "object"
            ? (tc.arguments as Record<string, unknown>)
            : undefined,
      },
      observed_at: new Date().toISOString(),
    };
    transition(state, "validate_authority", "Policy evaluation complete");
    const decision = await policyEngine.evaluate(
      delegationRequest,
      state.telemetry.agent_id,
    );
    budget.recordStep(state, "validate_authority");
    if (decision.status === "denied") {
      state.completionStatus = "denied";
      transition(
        state,
        "deny",
        decision.denial_reason ?? "Denied by policy engine",
      );
      transition(state, "audit_seal", "Denied");
      return end(
        decision.denial_reason ??
          `Tool "${tc.toolName}" denied by policy engine.`,
      );
    }
    if (decision.status === "escalated") {
      state.completionStatus = "escalation_timeout";
      transition(
        state,
        "escalate",
        decision.escalation_target ?? "Escalation required",
      );
      transition(state, "audit_seal", "Escalated");
      return end(
        decision.escalation_target
          ? `Escalation required: ${decision.escalation_target}`
          : `Tool "${tc.toolName}" requires escalation.`,
      );
    }
    transition(state, "delegate_narrow", "Authority granted");
    emitThought(
      state,
      decision.status === "narrowed"
        ? `[delegate_narrow] ${tc.toolName} narrowed by policy`
        : `[delegate_narrow] ${tc.toolName} approved by policy`,
    );
    budget.recordStep(state, "delegate_narrow");

    const grantedScope =
      decision.status === "narrowed" && decision.narrowed_scope
        ? decision.narrowed_scope
        : delegationRequest.requested_scope;

    transition(state, "execute_tool", `Policy-authorized call: ${tc.toolName}`);
    const inv: ToolInvocation = {
      tool_name: tc.toolName,
      arguments: tc.arguments,
      triggered_by_step: planStep.id,
    };
    const actionStep = emitAction(state, `call:${tc.toolName}`, inv, planStep.id);
    budget.recordToolCall(state, `tool:${tc.toolName}`);

    let result;
    try {
      result = await toolRegistry.call(tc.toolName, tc.arguments, state.sandbox, {
        kind: "receipt",
        permissionId: decision.decision_id,
        grantedScope,
        isPermissionValid: (permissionId: string) =>
          permissionId === decision.decision_id,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      forceStop(state, "fail_safe", msg);
      return end("");
    }

    transition(state, "observe_result", "Tool finished");
    if (
      !(await consultPhase("observe_result", {
        tool_name: tc.toolName,
        result_status: result.error ? "error" : "success",
      }))
    ) {
      return end("Request denied by policy.");
    }
    const obs = result.error ? `Error: ${result.error}` : JSON.stringify(result.output);
    emitObservation(state, obs, actionStep.id);
    budget.recordStep(state, "observe_result");

    transition(state, "critique_verify", "Check tool output");
    if (halted(state)) return end("");
    if (
      !(await consultPhase("critique_verify", {
        tool_name: tc.toolName,
      }))
    ) {
      return end("Request denied by policy.");
    }
    const critiqueHeartbeat = await manifestHeartbeat("critique_verify");
    const critique = await callLLM([
      {
        role: "system",
        content: `Briefly verify the observation against the user goal.\n\n${critiqueHeartbeat.manifestText}`,
      },
      {
        role: "user",
        content: `[harness:critique]\nObjective: ${objective}\nObservation:\n${obs}`,
      },
    ], critiqueHeartbeat.modelVisibleTools);
    if (halted(state)) return end(critique.content);
    emitCritique(state, critique.content);
    budget.recordStep(state, "critique_verify");
  }

  if (halted(state)) return end("");
  transition(state, "finalize", "Compose final answer");
  if (!(await consultPhase("finalize"))) {
    return end("Request denied by policy.");
  }
  const finalizeHeartbeat = await manifestHeartbeat("finalize");
  const finalResp = await callLLM([
    {
      role: "system",
      content: `Answer the user using the plan and tool observations.\n\n${finalizeHeartbeat.manifestText}`,
    },
    { role: "user", content: `[harness:finalize]\n${objective}` },
  ], finalizeHeartbeat.modelVisibleTools);
  if (halted(state)) return end(finalResp.content || planResp.content);
  const verifyText = finalResp.content;
  const ok =
    !verifyText.toLowerCase().includes("incorrect") &&
    !verifyText.toLowerCase().includes("wrong");
  emitVerify(state, verifyText, ok ? "verified" : "unknown");
  transition(state, "audit_seal", "Chat run sealed");

  return end(finalResp.content || planResp.content);
}
