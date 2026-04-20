import { createHash } from "node:crypto";
import type {
  DecidedBy,
  DelegationDecision,
  DelegationRequest,
  DelegationStatus,
  RequestedScope,
} from "../schemas/delegation.js";
import type { Phase } from "../schemas/agent-loop.js";
import type { SandboxConfig } from "../schemas/sandbox.js";
import type { ToolContract } from "../schemas/tool-invocation.js";
import { PolicyEvaluator } from "./policy-evaluator.js";
import type { PolicySet } from "./policy-evaluator.js";

export type ManifestToolAccessLevel =
  | "pre_authorized"
  | "requires_delegation"
  | "blocked";

export interface ToolAccessPreview {
  accessLevel: ManifestToolAccessLevel;
  constraints?: Record<string, unknown>;
  reason?: string;
  policyRefs?: string[];
}

export interface ToolAccessPreviewInput {
  runId: string;
  agentId: string;
  objective: string;
  phase: Phase;
  tools: ToolContract[];
  sandbox: SandboxConfig;
  context?: Record<string, unknown>;
}

export interface PolicyPhaseConsultationInput {
  runId: string;
  agentId: string;
  objective: string;
  phase: Phase;
  context?: Record<string, unknown>;
}

export interface PolicyPhaseConsultationDecision {
  status: "allowed" | "denied";
  reason?: string;
  policyRefs?: string[];
}

export interface DelegationPolicyEngine {
  readonly name: string;
  evaluate(
    request: DelegationRequest,
    agentId: string,
  ): Promise<DelegationDecision>;
  consultPhase?(
    input: PolicyPhaseConsultationInput,
  ): Promise<PolicyPhaseConsultationDecision>;
  previewToolAccess?(
    input: ToolAccessPreviewInput,
  ): Promise<Record<string, ToolAccessPreview>>;
}

export interface DelegationDecisionDraft {
  status: DelegationStatus;
  decidedBy: DecidedBy;
  policyRefs?: string[];
  narrowedScope?: RequestedScope;
  denialReason?: string;
  escalationTarget?: string;
  decidedAt?: string;
  outcomeKind?: string;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}

export function createDelegationDecision(
  request: DelegationRequest,
  agentId: string,
  draft: DelegationDecisionDraft,
): DelegationDecision {
  const decidedAt = draft.decidedAt ?? new Date().toISOString();
  const policyRefs = draft.policyRefs ?? [];
  const basis = stableStringify({
    request_id: request.request_id,
    agent_id: agentId,
    scope: request.requested_scope,
    status: draft.status,
    decided_by: draft.decidedBy,
    policy_refs: policyRefs,
    narrowed_scope: draft.narrowedScope,
    denial_reason: draft.denialReason,
    escalation_target: draft.escalationTarget,
    outcomeKind: draft.outcomeKind ?? draft.status,
    decided_at: decidedAt,
  });
  const decision_id = sha256Hex(basis);

  return {
    schema_version: "0.2",
    decision_id,
    request_id: request.request_id,
    status: draft.status,
    decided_by: draft.decidedBy,
    policy_refs: policyRefs,
    narrowed_scope: draft.narrowedScope,
    denial_reason: draft.denialReason,
    escalation_target: draft.escalationTarget,
    decided_at: decidedAt,
  };
}

export class InProcessPolicyEngine implements DelegationPolicyEngine {
  readonly name = "in-process";
  private evaluator = new PolicyEvaluator();
  private policies: PolicySet[] = [];

  constructor(policies: PolicySet[] = []) {
    for (const policy of policies) {
      this.policies.push(policy);
      this.evaluator.addPolicy(policy);
    }
  }

  addPolicy(policy: PolicySet): void {
    this.policies.push(policy);
    this.evaluator.addPolicy(policy);
  }

  removePolicy(policyId: string): void {
    this.policies = this.policies.filter((policy) => policy.policy_id !== policyId);
    this.evaluator.removePolicy(policyId);
  }

  async evaluate(
    request: DelegationRequest,
    agentId: string,
  ): Promise<DelegationDecision> {
    return this.evaluator.evaluate(request, agentId);
  }

  async consultPhase(
    input: PolicyPhaseConsultationInput,
  ): Promise<PolicyPhaseConsultationDecision> {
    if (!this.hasApplicablePhasePolicy(input.phase)) {
      return { status: "allowed", policyRefs: [] };
    }
    const decision = this.evaluator.evaluate(
      createSyntheticRequest({
        runId: input.runId,
        requester: input.agentId,
        intent: `Consult phase ${input.phase}`,
        justification: `Policy consultation at phase ${input.phase}`,
        scope: {
          resource: `phase:${input.phase}`,
          action: "read",
          constraints: input.context,
        },
      }),
      input.agentId,
    );
    return toPhaseConsultationDecision(decision);
  }

  async previewToolAccess(
    input: ToolAccessPreviewInput,
  ): Promise<Record<string, ToolAccessPreview>> {
    const preview: Record<string, ToolAccessPreview> = {};
    for (const tool of input.tools) {
      if (!isToolAllowedBySandbox(tool.name, input.sandbox)) {
        preview[tool.name] = {
          accessLevel: "blocked",
          reason: "Blocked by sandbox policy",
          policyRefs: [],
        };
        continue;
      }
      const decision = this.evaluator.evaluate(
        createSyntheticRequest({
          runId: input.runId,
          requester: input.agentId,
          intent: `Preview tool access for ${tool.name}`,
          justification: `Manifest compilation for phase ${input.phase}`,
          scope: {
            resource: `tool:${tool.name}`,
            action: "execute",
            constraints: input.context,
          },
        }),
        input.agentId,
      );
      preview[tool.name] = toToolAccessPreview(decision);
    }
    return preview;
  }

  private hasApplicablePhasePolicy(phase: Phase): boolean {
    return this.policies.some((policy) =>
      policy.rules.some(
        (rule) =>
          rule.resource === "phase:*" || rule.resource === `phase:${phase}`,
      ),
    );
  }
}

function createSyntheticRequest(args: {
  runId: string;
  requester: string;
  intent: string;
  justification: string;
  scope: RequestedScope;
}): DelegationRequest {
  return {
    schema_version: "0.2",
    request_id: `req-synth-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    requester: args.requester,
    run_id: args.runId,
    intent: args.intent,
    justification: args.justification,
    requested_scope: args.scope,
    observed_at: new Date().toISOString(),
  };
}

function toPhaseConsultationDecision(
  decision: DelegationDecision,
): PolicyPhaseConsultationDecision {
  if (decision.status === "denied" || decision.status === "escalated") {
    return {
      status: "denied",
      reason: decision.denial_reason ?? decision.escalation_target ?? "Denied by policy",
      policyRefs: decision.policy_refs,
    };
  }
  return {
    status: "allowed",
    policyRefs: decision.policy_refs,
  };
}

function toToolAccessPreview(decision: DelegationDecision): ToolAccessPreview {
  if (decision.status === "approved") {
    return {
      accessLevel: "pre_authorized",
      policyRefs: decision.policy_refs,
    };
  }
  if (decision.status === "narrowed") {
    return {
      accessLevel: "requires_delegation",
      constraints: decision.narrowed_scope?.constraints,
      reason: "Requires delegated narrowed authority",
      policyRefs: decision.policy_refs,
    };
  }
  if (decision.status === "escalated") {
    return {
      accessLevel: "requires_delegation",
      reason: decision.escalation_target
        ? `Escalation required: ${decision.escalation_target}`
        : "Escalation required",
      policyRefs: decision.policy_refs,
    };
  }
  return {
    accessLevel: "blocked",
    reason: decision.denial_reason ?? "Denied by policy",
    policyRefs: decision.policy_refs,
  };
}

function isToolAllowedBySandbox(toolName: string, sandbox: SandboxConfig): boolean {
  if (sandbox.blockedTools.includes(toolName)) {
    return false;
  }
  if (sandbox.allowedTools.includes("*")) {
    return true;
  }
  return sandbox.allowedTools.includes(toolName);
}
