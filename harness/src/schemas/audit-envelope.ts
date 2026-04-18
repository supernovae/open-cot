/**
 * Audit envelope types — RFC 0043 v0.2 / RFC 0048.
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
  total_approved: number;
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
  severity: "low" | "medium" | "high" | "critical";
  timestamp: string;
}

export interface AuditEnvelope {
  envelope_id: string;
  run_id: string;
  agent_id: string;
  task_hash: string;
  started_at: string;
  sealed_at: string;
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
