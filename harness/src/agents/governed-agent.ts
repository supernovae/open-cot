/**
 * Governed agent — demonstrates the full governed execution FSM with
 * delegation, policy evaluation, permission management, and audit sealing.
 */

import { createHash, randomUUID } from "node:crypto";
import type { LLMBackend, LLMMessage, LLMResponseWithTools } from "../backends/types.js";
import type { AgentState } from "../core/state.js";
import { createAgentState } from "../core/state.js";
import { transition, forceStop } from "../core/transitions.js";
import { createBudgetTracker } from "../core/budget-tracker.js";
import type { ToolRegistry } from "../core/tool-registry.js";
import { PermissionManager } from "../governance/permission-manager.js";
import { PolicyEvaluator } from "../governance/policy-evaluator.js";
import type { PolicySet } from "../governance/policy-evaluator.js";
import { AuthBroker } from "../governance/auth-broker.js";
import { AuditEngine } from "../governance/audit-engine.js";
import * as emit from "../core/trace-emitter.js";
import type { Trace } from "../schemas/trace.js";
import type { AuditEnvelope } from "../schemas/audit-envelope.js";
import type { DelegationRequest } from "../schemas/delegation.js";
import type { ToolInvocation } from "../schemas/trace.js";
import type { ToolExecutionReceipt } from "../schemas/receipt.js";
import type { BudgetPolicy } from "../schemas/budget.js";
import type { SandboxConfig } from "../schemas/sandbox.js";
import { buildManifest, serializeManifest } from "../governance/manifest-builder.js";
import type { WireFormat } from "../governance/manifest-builder.js";

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function halted(state: AgentState): boolean {
  return state.phase === "audit_seal";
}

export interface GovernedAgentConfig {
  objective: string;
  backend: LLMBackend;
  toolRegistry: ToolRegistry;
  policies?: PolicySet[];
  agentId?: string;
  budgetPolicy?: BudgetPolicy;
  sandbox?: SandboxConfig;
  wireFormat?: WireFormat;
}

export interface GovernedAgentResult {
  trace: Trace;
  envelope: AuditEnvelope;
  state: AgentState;
}

export async function runGovernedAgent(
  config: GovernedAgentConfig,
): Promise<GovernedAgentResult> {
  emit.resetStepCounter();
  const budget = createBudgetTracker();
  const state = createAgentState({
    objective: config.objective,
    budgetPolicy: config.budgetPolicy,
    sandbox: config.sandbox,
    agentId: config.agentId,
  });

  const permissionMgr = new PermissionManager();
  const policyEval = new PolicyEvaluator();
  for (const p of config.policies ?? []) {
    policyEval.addPolicy(p);
  }
  const broker = new AuthBroker(permissionMgr);
  const audit = new AuditEngine();
  let lastResponse: LLMResponseWithTools | undefined;

  const callLLM = async (
    messages: LLMMessage[],
  ): Promise<LLMResponseWithTools> => {
    if (halted(state)) {
      return { content: "", tokensUsed: 0, model: "noop", finishReason: "stop" };
    }
    try {
      const response = await config.backend.chat(messages);
      budget.recordTokens(
        state,
        response.tokensUsed,
        `LLM (${config.backend.name})`,
      );
      lastResponse = response;
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      forceStop(state, "fail_safe", `LLM failure: ${msg}`);
      return { content: "", tokensUsed: 0, model: "error", finishReason: "stop" };
    }
  };

  const finish = (answer: string): GovernedAgentResult => {
    permissionMgr.revokeAll("run finalized");
    emit.finalizeTrace(
      state,
      answer || state.trace.final_answer || String(state.completionStatus),
    );
    const envelope = audit.seal(state);
    return { trace: state.trace, envelope, state };
  };

  /**
   * Capability manifest heartbeat: re-compiles and returns a fresh compact
   * manifest every time the harness is about to call the LLM.  Budget numbers,
   * permission state, and tool availability can all change between calls, so
   * the model always sees the current truth rather than stale context from an
   * earlier phase.
   */
  const manifestHeartbeat = () => {
    const manifest = buildManifest({
      runId: state.runId,
      agentId: state.telemetry.agent_id,
      phase: state.phase,
      toolContracts: config.toolRegistry.listTools(),
      sandbox: state.sandbox,
      policies: config.policies ?? [],
      budget: state.budget,
    });
    state.capabilityManifest = manifest;
    return serializeManifest(manifest, config.wireFormat);
  };

  // --- receive ---
  emit.emitThought(state, `[receive] Task: ${config.objective}`);
  budget.recordStep(state, "receive");
  transition(state, "frame", "Log task and begin framing");

  // --- frame ---
  if (halted(state)) return finish("");
  const frameResp = await callLLM([
    {
      role: "system",
      content: `Interpret and frame the user's task. Do not call tools.\n\n${manifestHeartbeat()}`,
    },
    { role: "user", content: `[harness:frame]\n${config.objective}` },
  ]);
  if (halted(state)) return finish(frameResp.content);
  emit.emitThought(state, `[frame] ${frameResp.content}`);
  budget.recordStep(state, "frame");
  transition(state, "plan", "Framing complete");

  // --- plan ---
  if (halted(state)) return finish("");
  const planResp = await callLLM([
    {
      role: "system",
      content: `Propose concrete actions. You may request tools via tool_calls when needed.\n\n${manifestHeartbeat()}`,
    },
    { role: "user", content: `[harness:plan]\n${config.objective}` },
  ]);
  if (halted(state)) return finish(planResp.content);
  const planStep = emit.emitPlan(state, planResp.content);
  budget.recordStep(state, "plan");

  const toolCalls = lastResponse?.toolCalls ?? [];

  // --- no tools: finalize directly ---
  if (toolCalls.length === 0) {
    transition(state, "finalize", "No tools required");
    if (halted(state)) return finish(planResp.content);
    const fin = await callLLM([
      { role: "system", content: `Produce the final user-facing answer.\n\n${manifestHeartbeat()}` },
      {
        role: "user",
        content: `[harness:finalize]\n${config.objective}\n\nPlan:\n${planResp.content}`,
      },
    ]);
    if (halted(state)) return finish(fin.content || planResp.content);
    transition(state, "audit_seal", "Run complete");
    return finish(fin.content || planResp.content);
  }

  // --- delegation flow for each tool ---
  transition(state, "request_authority", "Model requested tools");

  for (let i = 0; i < toolCalls.length; i++) {
    if (halted(state)) return finish("");
    const tc = toolCalls[i]!;

    if (i > 0) {
      transition(state, "plan", `Authorize tool ${i + 1}/${toolCalls.length}`);
      emit.emitThought(state, `[plan] re-plan for tool ${tc.toolName}`);
      budget.recordStep(state, "plan");
      transition(
        state,
        "request_authority",
        `Request capability for ${tc.toolName}`,
      );
    }

    // --- request_authority ---
    const request: DelegationRequest = {
      request_id: `req-${randomUUID().slice(0, 8)}`,
      requester: state.telemetry.agent_id,
      run_id: state.runId,
      intent: `Execute tool ${tc.toolName}`,
      justification: planResp.content.slice(0, 500),
      requested_scope: { resource: `tool:${tc.toolName}`, action: "execute" },
      timestamp: new Date().toISOString(),
      provenance: {
        trace_step_id: planStep.id,
        plan_version: state.planVersion,
      },
    };
    state.delegationRequests.push(request);
    emit.emitThought(state, `[request_authority] ${tc.toolName}`);
    budget.recordStep(state, "request_authority");

    // --- validate_authority ---
    transition(state, "validate_authority", `Validate ${tc.toolName}`);
    const decision = policyEval.evaluate(
      request,
      state.telemetry.agent_id,
    );
    state.delegationDecisions.push(decision);
    budget.recordStep(state, "validate_authority");

    if (decision.status === "denied") {
      state.completionStatus = "denied";
      transition(state, "deny", "Policy denied tool request");
      emit.emitThought(
        state,
        `[deny] ${decision.denial_reason ?? "Denied by policy"}`,
      );
      transition(state, "audit_seal", "Sealing after denial");
      return finish("Request denied by policy.");
    }

    if (decision.status === "escalated") {
      state.completionStatus = "escalation_timeout";
      transition(state, "escalate", "Escalation required");
      emit.emitThought(
        state,
        `[escalate] Requires approval from ${decision.escalation_target}`,
      );
      transition(state, "audit_seal", "No escalation handler available");
      return finish("Escalation required — no handler available.");
    }

    // --- delegate_narrow ---
    transition(
      state,
      "delegate_narrow",
      `Issuing authority for ${tc.toolName}`,
    );
    const receipt = broker.materialize(decision, request);
    state.authorityReceipts.push(receipt);
    const permission = permissionMgr.get(receipt.permission_id);
    if (permission) {
      state.activePermissions.push(permission);
    }
    budget.recordStep(state, "delegate_narrow");

    // --- execute_tool ---
    transition(state, "execute_tool", `Execute ${tc.toolName}`);
    const inv: ToolInvocation = {
      tool_name: tc.toolName,
      arguments: tc.arguments,
      triggered_by_step: planStep.id,
    };
    const actionStep = emit.emitAction(
      state,
      `call:${tc.toolName}`,
      inv,
      planStep.id,
    );
    budget.recordToolCall(state, `tool:${tc.toolName}`);

    let toolResult;
    try {
      toolResult = await config.toolRegistry.call(
        tc.toolName,
        tc.arguments,
        state.sandbox,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      forceStop(state, "fail_safe", `Tool error: ${msg}`);
      return finish("");
    }

    // Consume one-shot permission
    if (receipt.one_shot) {
      permissionMgr.consume(receipt.permission_id);
    }

    // --- observe_result ---
    transition(state, "observe_result", "Tool returned");
    const obsText = toolResult.error
      ? `Error: ${toolResult.error}`
      : JSON.stringify(toolResult.output);
    emit.emitObservation(state, obsText, actionStep.id);
    budget.recordStep(state, "observe_result");

    const execReceipt: ToolExecutionReceipt = {
      execution_id: `exec-${randomUUID().slice(0, 8)}`,
      run_id: state.runId,
      tool_name: tc.toolName,
      permission_id: receipt.permission_id,
      authority_receipt_id: receipt.receipt_id,
      input_hash: sha256(JSON.stringify(tc.arguments)),
      output_hash: sha256(obsText),
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: toolResult.latencyMs,
      status: toolResult.error ? "error" : "success",
      error_category: toolResult.errorCategory,
      postcondition_check: "skipped",
      integrity: {
        hash_algorithm: "sha256",
        content_hash: sha256(`${actionStep.id}|${obsText}`),
      },
    };
    state.toolExecutionReceipts.push(execReceipt);

    // --- critique_verify ---
    transition(state, "critique_verify", "Evaluate tool output");
    if (halted(state)) return finish("");
    const critique = await callLLM([
      {
        role: "system",
        content: `Critique tool results for correctness and safety.\n\n${manifestHeartbeat()}`,
      },
      {
        role: "user",
        content: `[harness:critique]\nTool: ${tc.toolName}\nObservation:\n${obsText}`,
      },
    ]);
    if (halted(state)) return finish(critique.content);
    emit.emitCritique(state, critique.content);
    budget.recordStep(state, "critique_verify");
  }

  // --- finalize ---
  if (halted(state)) return finish("");
  transition(state, "finalize", "Synthesize final answer");
  const finalResp = await callLLM([
    {
      role: "system",
      content: `Produce the final user-facing answer from the plan and observations.\n\n${manifestHeartbeat()}`,
    },
    { role: "user", content: `[harness:finalize]\n${config.objective}` },
  ]);
  if (halted(state)) return finish(finalResp.content);
  transition(state, "audit_seal", "Governed run complete");
  return finish(finalResp.content);
}
