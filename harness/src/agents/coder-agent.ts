/**
 * Coder agent — policy-governed plan / execute / observe / critique with repair loop.
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

export interface CoderGovernanceOptions {
  policies?: PolicySet[];
  policyEngine?: DelegationPolicyEngine;
}

export async function runCoderAgent(
  backend: LLMBackend,
  objective: string,
  toolRegistry: ToolRegistry,
  budgetPolicy?: BudgetPolicy,
  sandbox?: SandboxConfig,
  maxRepairAttempts?: number,
  governance?: CoderGovernanceOptions,
): Promise<Trace> {
  resetStepCounter();
  const maxRepairs = maxRepairAttempts ?? 3;
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
        maxDecodedChars: 20_000,
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
      sandbox: state.sandbox,
      policies: effectivePolicies,
      budget: state.budget,
      toolOverrides,
    });
    state.capabilityManifest = manifest;
    return {
      manifestText: manifestToCompactText(manifest),
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
    {
      role: "system",
      content: "Frame the coding task: goals, files, risks. Do not call tools yet.",
    },
    { role: "user", content: `[harness:frame]\n${objective}` },
  ], []);
  if (halted(state)) return end(frameResp.content);
  emitThought(state, `[frame] ${frameResp.content}`);
  budget.recordStep(state, "frame");
  transition(state, "plan", "Framed");

  let repairCount = 0;
  let lastCritique = "";

  while (repairCount <= maxRepairs && !halted(state)) {
    if (halted(state)) return end("");
    if (!(await consultPhase("plan", { repair_cycle: repairCount }))) {
      return end("Request denied by policy.");
    }
    const planHeartbeat = await manifestHeartbeat("plan");

    const planResp = await callLLM([
      {
        role: "system",
        content: `You are a coding assistant. Propose concrete steps and use tools when needed.\n\n${planHeartbeat.manifestText}`,
      },
      { role: "user", content: `[harness:plan]\n${objective}` },
    ], planHeartbeat.modelVisibleTools);
    if (halted(state)) return end(planResp.content);
    const planStep = emitPlan(state, planResp.content);
    budget.recordStep(state, "plan");

    const toolCalls = lastResponse?.toolCalls ?? [];

    if (toolCalls.length === 0) {
      emitThought(state, planResp.content, planStep.id);
      lastCritique = "No tools invoked; proceeding to finalize.";
      break;
    }

    for (let i = 0; i < toolCalls.length; i++) {
      if (halted(state)) return end("");
      const tc = toolCalls[i]!;

      if (i > 0) {
        transition(state, "plan", `Next coding tool ${i + 1}/${toolCalls.length}`);
        emitThought(state, `[plan] continue with ${tc.toolName}`);
        budget.recordStep(state, "plan");
      }
      if (
        !(await consultPhase("plan", {
          tool_name: tc.toolName,
          tool_index: i,
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
        intent: `Use ${tc.toolName} for coding objective`,
        justification: `Model selected ${tc.toolName}`,
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

      transition(state, "observe_result", "Captured tool output");
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

      transition(state, "critique_verify", "Verify step output");
      if (halted(state)) return end("");
      if (
        !(await consultPhase("critique_verify", {
          tool_name: tc.toolName,
        }))
      ) {
        return end("Request denied by policy.");
      }
      const critiqueHeartbeat = await manifestHeartbeat("critique_verify");
      const critiqueResp = await callLLM([
        {
          role: "system",
          content: `Critique the tool output. Say whether changes look correct or need repair.\n\n${critiqueHeartbeat.manifestText}`,
        },
        {
          role: "user",
          content: `[harness:critique]\nTask: ${objective}\nObservation:\n${obs}`,
        },
      ], critiqueHeartbeat.modelVisibleTools);
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
  if (!(await consultPhase("finalize"))) {
    return end("Request denied by policy.");
  }
  const finalizeHeartbeat = await manifestHeartbeat("finalize");
  const summaryResp = await callLLM([
    {
      role: "system",
      content: `Summarize what was done and the final state of the code.\n\n${finalizeHeartbeat.manifestText}`,
    },
    { role: "user", content: `[harness:finalize]\n${objective}` },
  ], finalizeHeartbeat.modelVisibleTools);
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
