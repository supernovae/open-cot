import { randomUUID } from "node:crypto";
import type {
  PermissionGrant,
  PermissionLifecycleEvent,
} from "../schemas/permission.js";
import type { RequestedScope } from "../schemas/delegation.js";

export interface GrantParams {
  granted_to: string;
  scope: RequestedScope;
  audience: string;
  ttl_seconds: number;
  one_shot: boolean;
  forwardable: boolean;
  granted_by: string;
  policy_ref?: string;
  request_ref?: string;
  decision_ref?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isPastExpiry(expiresAt: string, now: string): boolean {
  return expiresAt <= now;
}

function isBeforeEffective(effectiveAt: string, now: string): boolean {
  return now < effectiveAt;
}

export class PermissionManager {
  private permissions = new Map<string, PermissionGrant>();
  private events: PermissionLifecycleEvent[] = [];

  private pushEvent(event: PermissionLifecycleEvent): void {
    this.events.push(event);
  }

  grant(params: GrantParams): PermissionGrant {
    const permission_id = randomUUID();
    const effective_at = nowIso();
    const expires_at = new Date(
      Date.parse(effective_at) + params.ttl_seconds * 1000,
    ).toISOString();

    const grant: PermissionGrant = {
      permission_id,
      granted_to: params.granted_to,
      scope: params.scope,
      audience: params.audience,
      ttl_seconds: params.ttl_seconds,
      effective_at,
      expires_at,
      one_shot: params.one_shot,
      forwardable: params.forwardable,
      granted_by: params.granted_by,
      policy_ref: params.policy_ref,
      request_ref: params.request_ref,
      decision_ref: params.decision_ref,
      status: "active",
    };

    this.permissions.set(permission_id, grant);
    this.pushEvent({
      event: "permission_granted",
      permission_id,
      observed_at: effective_at,
      details: { scope: params.scope, ttl_seconds: params.ttl_seconds },
    });

    return grant;
  }

  consume(permission_id: string): boolean {
    this.checkExpiry();
    const grant = this.permissions.get(permission_id);
    if (!grant || grant.status !== "active" || !grant.one_shot) {
      return false;
    }
    const now = nowIso();
    if (
      isBeforeEffective(grant.effective_at, now) ||
      isPastExpiry(grant.expires_at, now)
    ) {
      return false;
    }

    const consumed_at = nowIso();
    const updated: PermissionGrant = {
      ...grant,
      status: "consumed",
      consumed_at,
    };
    this.permissions.set(permission_id, updated);
    this.pushEvent({
      event: "permission_consumed",
      permission_id,
      observed_at: consumed_at,
    });
    return true;
  }

  revoke(permission_id: string, reason: string): boolean {
    this.checkExpiry();
    const grant = this.permissions.get(permission_id);
    if (!grant || grant.status !== "active") {
      return false;
    }

    const revoked_at = nowIso();
    const updated: PermissionGrant = {
      ...grant,
      status: "revoked",
      revoked_at,
      revocation_reason: reason,
    };
    this.permissions.set(permission_id, updated);
    this.pushEvent({
      event: "permission_revoked",
      permission_id,
      observed_at: revoked_at,
      details: { reason },
    });
    return true;
  }

  revokeAll(reason: string): void {
    for (const id of [...this.permissions.keys()]) {
      const grant = this.permissions.get(id);
      if (grant?.status === "active") {
        this.revoke(id, reason);
      }
    }
  }

  isValid(permission_id: string): boolean {
    this.checkExpiry();
    const grant = this.permissions.get(permission_id);
    if (!grant || grant.status !== "active") {
      return false;
    }
    const now = nowIso();
    return (
      !isBeforeEffective(grant.effective_at, now) &&
      !isPastExpiry(grant.expires_at, now)
    );
  }

  get(permission_id: string): PermissionGrant | undefined {
    return this.permissions.get(permission_id);
  }

  getEvents(): PermissionLifecycleEvent[] {
    return [...this.events];
  }

  checkExpiry(): void {
    const now = nowIso();
    for (const [id, grant] of this.permissions) {
      if (grant.status !== "active") {
        continue;
      }
      if (isPastExpiry(grant.expires_at, now)) {
        const updated: PermissionGrant = {
          ...grant,
          status: "expired",
        };
        this.permissions.set(id, updated);
        this.pushEvent({
          event: "permission_expired",
          permission_id: id,
          observed_at: now,
          details: { expires_at: grant.expires_at },
        });
      }
    }
  }
}
