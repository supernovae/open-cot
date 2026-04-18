import { createHash, randomUUID } from "node:crypto";
import type {
  AuditEnvelope,
  CompletionStatus,
  DelegationSummary,
  PermissionSummary,
} from "../schemas/audit-envelope.js";
import type { AgentState } from "../core/state.js";

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

const ENVELOPE_COMPLETION: ReadonlySet<CompletionStatus> = new Set([
  "succeeded",
  "failed",
  "denied",
  "budget_exhausted",
  "external_stop",
  "escalation_timeout",
  "fail_safe",
]);

function toEnvelopeCompletion(state: AgentState): CompletionStatus {
  const s = state.completionStatus as string;
  if (ENVELOPE_COMPLETION.has(s as CompletionStatus)) {
    return s as CompletionStatus;
  }
  if (s === "running") {
    const t = state.trace.termination;
    if (t && ENVELOPE_COMPLETION.has(t)) {
      return t;
    }
    return "succeeded";
  }
  return "fail_safe";
}

function delegationSummaryFromState(state: AgentState): DelegationSummary {
  const decisions = state.delegationDecisions;
  return {
    total_requested: state.delegationRequests.length,
    total_approved: decisions.filter((d) => d.status === "approved").length,
    total_denied: decisions.filter((d) => d.status === "denied").length,
    total_narrowed: decisions.filter((d) => d.status === "narrowed").length,
    total_escalated: decisions.filter((d) => d.status === "escalated").length,
  };
}

function permissionSummaryFromState(state: AgentState): PermissionSummary {
  const grants = state.activePermissions;
  return {
    total_granted: grants.length,
    total_consumed: grants.filter((p) => p.status === "consumed").length,
    total_expired: grants.filter((p) => p.status === "expired").length,
    total_revoked: grants.filter((p) => p.status === "revoked").length,
  };
}

type AuditEventIntegrity = { hash_algorithm: "sha256"; content_hash: string };

export interface AuditEvent {
  event_id: string;
  run_id: string;
  agent_id: string;
  timestamp: string;
  event_type: string;
  details: Record<string, unknown>;
  previous_event_id: string | null;
  integrity: AuditEventIntegrity;
}

function envelopeIntegrityPayload(envelope: Omit<AuditEnvelope, "integrity">): string {
  return stableStringify(envelope);
}

export class AuditEngine {
  private events: AuditEvent[] = [];

  emit(args: {
    run_id: string;
    agent_id: string;
    event_type: string;
    details: Record<string, unknown>;
  }): AuditEvent {
    const timestamp = new Date().toISOString();
    const previous_event_id =
      this.events.length > 0 ? this.events[this.events.length - 1]!.event_id : null;
    const event_id = randomUUID();

    const hashInput = stableStringify({
      event_id,
      run_id: args.run_id,
      agent_id: args.agent_id,
      timestamp,
      event_type: args.event_type,
      details: args.details,
      previous_event_id,
    });
    const content_hash = sha256Hex(hashInput);

    const event: AuditEvent = {
      event_id,
      run_id: args.run_id,
      agent_id: args.agent_id,
      timestamp,
      event_type: args.event_type,
      details: args.details,
      previous_event_id,
      integrity: { hash_algorithm: "sha256", content_hash },
    };
    this.events.push(event);
    return event;
  }

  seal(state: AgentState): AuditEnvelope {
    const sealed_at = new Date().toISOString();
    const trace_hash = sha256Hex(stableStringify(state.trace));
    const task_hash = sha256Hex(
      stableStringify({ objective: state.objective, trace_task: state.trace.task }),
    );

    const delegation_summary = delegationSummaryFromState(state);
    const permission_summary = permissionSummaryFromState(state);

    const envelope_id = randomUUID();
    const head = this.events.length > 0 ? this.events[0]!.event_id : undefined;
    const tail =
      this.events.length > 0 ? this.events[this.events.length - 1]!.event_id : undefined;

    const started_at = state.telemetry.timestamp;

    const body: Omit<AuditEnvelope, "integrity"> = {
      envelope_id,
      run_id: state.runId,
      agent_id: state.telemetry.agent_id,
      task_hash,
      started_at,
      sealed_at,
      completion_status: toEnvelopeCompletion(state),
      trace_hash,
      event_chain_head: head,
      event_chain_tail: tail,
      event_count: this.events.length,
      delegation_requests: state.delegationRequests.map((r) => r.request_id),
      delegation_decisions: state.delegationDecisions.map((d) => d.decision_id),
      authority_receipts: state.authorityReceipts.map((r) => r.receipt_id),
      tool_execution_receipts: state.toolExecutionReceipts.map((r) => r.execution_id),
      delegation_summary,
      permission_summary,
      budget_final: state.budget,
      policy_violations: [],
    };

    const content_hash = sha256Hex(envelopeIntegrityPayload(body));

    const envelope: AuditEnvelope = {
      ...body,
      integrity: { hash_algorithm: "sha256", content_hash },
    };

    state.trace.audit_envelope = envelope.envelope_id;
    return envelope;
  }

  getEvents(): AuditEvent[] {
    return [...this.events];
  }

  static verify(envelope: AuditEnvelope): boolean {
    const { integrity, ...rest } = envelope;
    if (integrity.hash_algorithm !== "sha256") {
      return false;
    }
    const expected = sha256Hex(envelopeIntegrityPayload(rest));
    return expected === integrity.content_hash;
  }
}
