/**
 * Delegation types — RFC 0047 v0.2.
 *
 * Typed schema objects for the authority request/decision/receipt flow.
 * Model-provided fields are clearly separated from harness-provided fields.
 */

export interface RequestedScope {
  resource: string;
  action: "read" | "write" | "execute" | "delete" | "list";
  constraints?: Record<string, unknown>;
}

export interface DelegationProvenance {
  trace_step_id: string;
  plan_version: number;
}

/**
 * A formal request for authority, created during the `request_authority` FSM
 * state. The model provides intent and scope; the harness provides identity,
 * timing, and provenance.
 */
export interface DelegationRequest {
  schema_version: "0.2";
  request_id: string;
  /** Harness-verified agent identity — never model-provided. */
  requester: string;
  run_id: string;
  /** Model-provided: what the agent wants to accomplish. */
  intent: string;
  /** Model-provided: why this capability is needed. */
  justification: string;
  requested_scope: RequestedScope;
  preferred_ttl_seconds?: number;
  preferred_audience?: string;
  task_context_ref?: string;
  observed_at: string;
  provenance?: DelegationProvenance;
}

export type DelegationStatus =
  | "approved"
  | "denied"
  | "narrowed"
  | "escalated";

export interface DecidedBy {
  kind: "policy" | "human" | "harness";
  policy_id?: string;
  human_approver?: string;
}

/**
 * The harness/policy engine's response to a delegation request.
 * All fields are harness-provided — the model does not participate.
 */
export interface DelegationDecision {
  schema_version: "0.2";
  decision_id: string;
  request_id: string;
  status: DelegationStatus;
  decided_by: DecidedBy;
  policy_refs: string[];
  narrowed_scope?: RequestedScope;
  denial_reason?: string;
  escalation_target?: string;
  decided_at: string;
}

export interface ReceiptIntegrity {
  hash_algorithm: "sha256";
  content_hash: string;
  signature?: string;
  signing_key_id?: string;
}

/**
 * Proof that authority was granted, linking the request, decision, and
 * materialized permission. Tamper-evident via integrity hash.
 */
export interface AuthorityReceipt {
  schema_version: "0.2";
  receipt_id: string;
  decision_id: string;
  request_id: string;
  permission_id: string;
  granted_scope: RequestedScope;
  effective_at: string;
  expires_at: string;
  one_shot: boolean;
  forwardable: boolean;
  audience: string;
  integrity: ReceiptIntegrity;
}
