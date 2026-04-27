import type {
  DecidedBy,
  DelegationDecision,
  DelegationRequest,
  DelegationStatus,
  RequestedScope,
} from "../schemas/delegation.js";
import type { SandboxConfig } from "../schemas/sandbox.js";
import type {
  DelegationPolicyEngine,
  PolicyPhaseConsultationDecision,
  PolicyPhaseConsultationInput,
  ToolAccessPreview,
  ToolAccessPreviewInput,
} from "./policy-engine.js";
import { createDelegationDecision } from "./policy-engine.js";

type OpaResult = {
  status?: DelegationStatus;
  policy_refs?: string[];
  narrowed_scope?: RequestedScope;
  denial_reason?: string;
  escalation_target?: string;
  decided_by?: Partial<DecidedBy>;
};

interface OpaResponseEnvelope {
  result?: unknown;
}

export interface OpaPolicyEngineConfig {
  baseUrl: string;
  policyPath: string;
  bearerToken?: string;
  timeoutMs?: number;
  inputContext?: Record<string, unknown>;
  fallbackEngine?: DelegationPolicyEngine;
}

const DEFAULT_TIMEOUT_MS = 2_000;

export class OpaPolicyEngine implements DelegationPolicyEngine {
  readonly name = "opa";
  private config: OpaPolicyEngineConfig;

  constructor(config: OpaPolicyEngineConfig) {
    this.config = config;
  }

  async evaluate(
    request: DelegationRequest,
    requesterId: string,
  ): Promise<DelegationDecision> {
    try {
      const result = await this.queryOpa(request, requesterId);
      return this.toDecision(request, requesterId, result);
    } catch (err) {
      if (this.config.fallbackEngine) {
        return this.config.fallbackEngine.evaluate(request, requesterId);
      }
      const message = err instanceof Error ? err.message : String(err);
      return createDelegationDecision(request, requesterId, {
        status: "denied",
        decidedBy: { kind: "harness" },
        policyRefs: [],
        denialReason: `OPA policy evaluation failed: ${message}`,
        outcomeKind: "opa_error",
      });
    }
  }

  async consultPhase(
    input: PolicyPhaseConsultationInput,
  ): Promise<PolicyPhaseConsultationDecision> {
    const decision = await this.evaluate(
      createSyntheticRequest({
        runId: input.runId,
        requester: input.requesterId,
        scope: {
          resource: `phase:${input.phase}`,
          action: "read",
          constraints: input.context,
        },
        intent: `Consult policy hook for phase ${input.phase}`,
        justification: `Runtime policy consultation at ${input.phase}`,
      }),
      input.requesterId,
    );
    if (decision.status === "denied" || decision.status === "escalated") {
      return {
        status: "denied",
        reason:
          decision.denial_reason ??
          decision.escalation_target ??
          "Denied by OPA policy",
        policyRefs: decision.policy_refs,
      };
    }
    return {
      status: "allowed",
      policyRefs: decision.policy_refs,
    };
  }

  async previewToolAccess(
    input: ToolAccessPreviewInput,
  ): Promise<Record<string, ToolAccessPreview>> {
    const entries = await Promise.all(
      input.tools.map(async (tool) => {
        if (!isToolAllowedBySandbox(tool.name, input.sandbox)) {
          return [
            tool.name,
            {
              accessLevel: "blocked",
              reason: "Blocked by sandbox policy",
              policyRefs: [],
            } satisfies ToolAccessPreview,
          ] as const;
        }
        const decision = await this.evaluate(
          createSyntheticRequest({
            runId: input.runId,
            requester: input.requesterId,
            scope: {
              resource: `tool:${tool.name}`,
              action: "execute",
              constraints: input.context,
            },
            intent: `Preview tool access for ${tool.name}`,
            justification: `Manifest compilation for phase ${input.phase}`,
          }),
          input.requesterId,
        );
        return [tool.name, toToolAccessPreview(decision)] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  private async queryOpa(
    request: DelegationRequest,
    requesterId: string,
  ): Promise<OpaResult> {
    const controller = new AbortController();
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const path = trimLeadingSlashes(this.config.policyPath);
      const url = `${trimTrailingSlashes(this.config.baseUrl)}/v1/data/${path}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.bearerToken
            ? { Authorization: `Bearer ${this.config.bearerToken}` }
            : {}),
        },
        body: JSON.stringify({
          input: {
            request,
            requester_id: requesterId,
            context: this.config.inputContext ?? {},
          },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `OPA HTTP ${response.status}: ${text.slice(0, 500)}`,
        );
      }
      const data = (await response.json()) as OpaResponseEnvelope;
      if (!data.result || typeof data.result !== "object") {
        throw new Error("OPA response missing decision object in result");
      }
      return data.result as OpaResult;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private toDecision(
    request: DelegationRequest,
    requesterId: string,
    result: OpaResult,
  ): DelegationDecision {
    if (!result.status) {
      throw new Error("OPA response missing status");
    }

    const policyRefs = normalizePolicyRefs(result.policy_refs);
    const decidedBy = normalizeDecidedBy(result.decided_by, policyRefs);
    const denialReason =
      result.status === "denied"
        ? result.denial_reason ?? "Denied by OPA policy"
        : result.denial_reason;

    return createDelegationDecision(request, requesterId, {
      status: result.status,
      decidedBy,
      policyRefs,
      narrowedScope: result.narrowed_scope,
      denialReason,
      escalationTarget: result.escalation_target,
      outcomeKind: `opa_${result.status}`,
    });
  }
}

function normalizePolicyRefs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeDecidedBy(
  value: unknown,
  policyRefs: string[],
): DecidedBy {
  if (value && typeof value === "object") {
    const maybe = value as Partial<DecidedBy>;
    if (
      maybe.kind === "policy" ||
      maybe.kind === "human" ||
      maybe.kind === "harness"
    ) {
      return {
        kind: maybe.kind,
        policy_id: maybe.policy_id,
        human_approver: maybe.human_approver,
      };
    }
  }
  return {
    kind: "policy",
    policy_id: policyRefs[0],
  };
}

function createSyntheticRequest(args: {
  runId: string;
  requester: string;
  scope: RequestedScope;
  intent: string;
  justification: string;
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
    reason: decision.denial_reason ?? "Denied by OPA policy",
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

function trimLeadingSlashes(value: string): string {
  let start = 0;
  while (start < value.length && value.charCodeAt(start) === 47) {
    start += 1;
  }
  return value.slice(start);
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return value.slice(0, end);
}
