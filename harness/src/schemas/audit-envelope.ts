/**
 * Audit envelope types — RFC 0043 v0.3 / RFC 0048 v0.2.
 *
 * Sealed summary of a complete governed execution run. Immutable after
 * creation — any modification is detectable via hash verification.
 */

import type { BudgetSnapshot } from "./budget.js";
import type { ReceiptIntegrity } from "./delegation.js";

export type CompletionStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "denied"
  | "budget_exhausted"
  | "external_stop"
  | "escalation_timeout"
  | "fail_safe";

export interface DelegationSummary {
  total_requested: number;
  total_granted: number;
  total_denied: number;
  total_narrowed: number;
  total_escalated: number;
}

export interface PermissionSummary {
  total_granted: number;
  total_consumed: number;
  total_expired: number;
  total_revoked: number;
}

export interface PolicyViolationRecord {
  violation_id: string;
  policy_id: string;
  rule_id: string;
  description: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  observed_at: string;
}

export interface AuditEnvelope {
  schema_version: "0.2" | "0.3";
  envelope_id: string;
  run_id: string;
  requester_id: string;
  task_hash: string;
  started_at: string;
  completed_at: string;
  completion_status: CompletionStatus;
  trace_hash: string;
  event_chain_head?: string;
  event_chain_tail?: string;
  event_count: number;
  delegation_requests: string[];
  delegation_decisions: string[];
  authority_receipts: string[];
  tool_execution_receipts: string[];
  delegation_summary: DelegationSummary;
  permission_summary: PermissionSummary;
  budget_final?: BudgetSnapshot;
  policy_violations: PolicyViolationRecord[];
  integrity: ReceiptIntegrity;
}
