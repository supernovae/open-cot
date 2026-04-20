import { createHash } from "node:crypto";
import type {
  DecidedBy,
  DelegationDecision,
  DelegationRequest,
  DelegationStatus,
  RequestedScope,
} from "../schemas/delegation.js";

export interface PolicyRule {
  rule_id: string;
  action: "allow" | "deny" | "narrow" | "require_approval";
  subject?: string;
  resource: string;
  conditions?: {
    max_risk_level?: "low" | "medium" | "high";
    require_justification?: boolean;
    validity_window?: {
      effective_at: string;
      expires_at: string;
    };
    budget_remaining_min?: number;
    [key: string]: unknown;
  };
  narrowing?: {
    allowed_fields?: string[];
    excluded_fields?: string[];
    max_results?: number;
  };
  escalation_target?: string;
  reason?: string;
}

export interface PolicySet {
  policy_id: string;
  policy_type: "safety" | "compliance" | "organizational" | "ethical" | "operational";
  rules: PolicyRule[];
  priority: number;
  effective_at?: string;
  expires_at?: string;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function subjectMatches(agentId: string, pattern: string): boolean {
  if (pattern === "*") {
    return true;
  }
  if (agentId === pattern) {
    return true;
  }
  return agentId.startsWith(`${pattern}:`);
}

function resourceMatches(scopeResource: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return scopeResource.startsWith(prefix);
  }
  return scopeResource === pattern;
}

function isWithinHalfOpenWindow(
  nowIso: string,
  effectiveAt?: string,
  expiresAt?: string,
): boolean {
  if (effectiveAt && nowIso < effectiveAt) {
    return false;
  }
  if (expiresAt && nowIso >= expiresAt) {
    return false;
  }
  return true;
}

function ruleMatches(
  rule: PolicyRule,
  agentId: string,
  requestedScope: RequestedScope,
  nowIso: string,
): boolean {
  const subjectPattern = rule.subject ?? "*";
  if (!subjectMatches(agentId, subjectPattern)) {
    return false;
  }
  if (!resourceMatches(requestedScope.resource, rule.resource)) {
    return false;
  }
  if (rule.conditions && Object.keys(rule.conditions).length > 0) {
    const validityWindow = rule.conditions.validity_window;
    if (
      validityWindow &&
      !isWithinHalfOpenWindow(
        nowIso,
        validityWindow.effective_at,
        validityWindow.expires_at,
      )
    ) {
      return false;
    }
    const scopeConstraints = requestedScope.constraints ?? {};
    for (const [key, expected] of Object.entries(rule.conditions)) {
      if (key === "validity_window") {
        continue;
      }
      if (!(key in scopeConstraints)) {
        return false;
      }
      if (stableStringify(scopeConstraints[key]) !== stableStringify(expected)) {
        return false;
      }
    }
  }
  return true;
}

function applyNarrowing(
  scope: RequestedScope,
  narrowing: PolicyRule["narrowing"],
): RequestedScope {
  if (!narrowing) {
    return {
      resource: scope.resource,
      action: scope.action,
      constraints: scope.constraints ? { ...scope.constraints } : undefined,
    };
  }
  const constraints: Record<string, unknown> = {
    ...(scope.constraints ?? {}),
  };
  if (narrowing.allowed_fields !== undefined) {
    constraints.allowed_fields = narrowing.allowed_fields;
  }
  if (narrowing.excluded_fields !== undefined) {
    constraints.excluded_fields = narrowing.excluded_fields;
  }
  if (narrowing.max_results !== undefined) {
    constraints.max_results = narrowing.max_results;
  }
  return {
    resource: scope.resource,
    action: scope.action,
    constraints: Object.keys(constraints).length ? constraints : undefined,
  };
}

type MatchHit = { policy: PolicySet; rule: PolicyRule };

export class PolicyEvaluator {
  private policies: PolicySet[] = [];

  addPolicy(policy: PolicySet): void {
    this.policies.push(policy);
  }

  removePolicy(policyId: string): void {
    this.policies = this.policies.filter((p) => p.policy_id !== policyId);
  }

  evaluate(request: DelegationRequest, agent_id: string): DelegationDecision {
    const nowIso = new Date().toISOString();
    const sorted = [...this.policies]
      .filter((p) => isWithinHalfOpenWindow(nowIso, p.effective_at, p.expires_at))
      .sort((a, b) => a.priority - b.priority);

    let firstNarrow: MatchHit | undefined;
    let firstEscalation: MatchHit | undefined;
    let firstAllow: MatchHit | undefined;

    for (const policy of sorted) {
      const rule = policy.rules.find((r) =>
        ruleMatches(r, agent_id, request.requested_scope, nowIso),
      );
      if (!rule) {
        continue;
      }

      if (rule.action === "deny") {
        return this.buildDecision({
          request,
          agent_id,
          status: "denied",
          decidedBy: { kind: "policy", policy_id: policy.policy_id },
          policyRefs: [policy.policy_id],
          narrowed_scope: undefined,
          denial_reason: rule.reason ?? "Denied by policy",
          escalation_target: undefined,
          matched: { policy, rule },
          outcomeKind: "deny",
          decidedAt: nowIso,
        });
      }

      if (rule.action === "narrow") {
        if (!firstNarrow) {
          firstNarrow = { policy, rule };
        }
      } else if (rule.action === "require_approval") {
        if (!firstEscalation) {
          firstEscalation = { policy, rule };
        }
      } else if (rule.action === "allow") {
        if (!firstAllow) {
          firstAllow = { policy, rule };
        }
      }
    }

    if (firstNarrow) {
      const narrowed = applyNarrowing(
        request.requested_scope,
        firstNarrow.rule.narrowing,
      );
      return this.buildDecision({
        request,
        agent_id,
        status: "narrowed",
        decidedBy: { kind: "policy", policy_id: firstNarrow.policy.policy_id },
        policyRefs: [firstNarrow.policy.policy_id],
        narrowed_scope: narrowed,
        denial_reason: undefined,
        escalation_target: undefined,
        matched: firstNarrow,
        outcomeKind: "narrow",
        decidedAt: nowIso,
      });
    }

    if (firstEscalation) {
      return this.buildDecision({
        request,
        agent_id,
        status: "escalated",
        decidedBy: {
          kind: "policy",
          policy_id: firstEscalation.policy.policy_id,
        },
        policyRefs: [firstEscalation.policy.policy_id],
        narrowed_scope: undefined,
        denial_reason: undefined,
        escalation_target:
          firstEscalation.rule.escalation_target ??
          firstEscalation.policy.policy_id,
        matched: firstEscalation,
        outcomeKind: "require_approval",
        decidedAt: nowIso,
      });
    }

    if (firstAllow) {
      return this.buildDecision({
        request,
        agent_id,
        status: "approved",
        decidedBy: { kind: "policy", policy_id: firstAllow.policy.policy_id },
        policyRefs: [firstAllow.policy.policy_id],
        narrowed_scope: undefined,
        denial_reason: undefined,
        escalation_target: undefined,
        matched: firstAllow,
        outcomeKind: "allow",
        decidedAt: nowIso,
      });
    }

    return this.buildDecision({
      request,
      agent_id,
      status: "denied",
      decidedBy: { kind: "harness" },
      policyRefs: [],
      narrowed_scope: undefined,
      denial_reason: "No matching policy rule (fail-closed)",
      escalation_target: undefined,
      matched: undefined,
      outcomeKind: "default_deny",
      decidedAt: nowIso,
    });
  }

  private buildDecision(args: {
    request: DelegationRequest;
    agent_id: string;
    status: DelegationStatus;
    decidedBy: DecidedBy;
    policyRefs: string[];
    narrowed_scope?: RequestedScope;
    denial_reason?: string;
    escalation_target?: string;
    matched: MatchHit | undefined;
    outcomeKind: string;
    decidedAt: string;
  }): DelegationDecision {
    const basis = stableStringify({
      request_id: args.request.request_id,
      agent_id: args.agent_id,
      scope: args.request.requested_scope,
      status: args.status,
      decided_by: args.decidedBy,
      policy_refs: args.policyRefs,
      narrowed_scope: args.narrowed_scope,
      denial_reason: args.denial_reason,
      escalation_target: args.escalation_target,
      matched: args.matched
        ? { policy_id: args.matched.policy.policy_id, rule_id: args.matched.rule.rule_id }
        : null,
      outcomeKind: args.outcomeKind,
      decided_at: args.decidedAt,
    });
    const decision_id = sha256Hex(basis);

    return {
      schema_version: "0.2",
      decision_id,
      request_id: args.request.request_id,
      status: args.status,
      decided_by: args.decidedBy,
      policy_refs: args.policyRefs,
      narrowed_scope: args.narrowed_scope,
      denial_reason: args.denial_reason,
      escalation_target: args.escalation_target,
      decided_at: args.decidedAt,
    };
  }
}
