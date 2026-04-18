/**
 * Permission grant types — RFC 0042 v0.2.
 *
 * First-class permission objects with full lifecycle tracking.
 * The model cannot create these — only the harness/policy engine can.
 */

import type { RequestedScope } from "./delegation.js";

export type PermissionStatus = "active" | "consumed" | "expired" | "revoked";

export interface PermissionGrant {
  permission_id: string;
  granted_to: string;
  scope: RequestedScope;
  audience?: string;
  ttl_seconds: number;
  expires_at: string;
  one_shot: boolean;
  forwardable: boolean;
  granted_by: string;
  policy_ref?: string;
  request_ref?: string;
  decision_ref?: string;
  granted_at: string;
  consumed_at?: string;
  revoked_at?: string;
  revocation_reason?: string;
  status: PermissionStatus;
}

export type PermissionEvent =
  | "permission_granted"
  | "permission_consumed"
  | "permission_expired"
  | "permission_revoked";

export interface PermissionLifecycleEvent {
  event: PermissionEvent;
  permission_id: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
