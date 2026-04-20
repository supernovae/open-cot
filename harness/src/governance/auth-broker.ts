import { createHash, randomUUID } from "node:crypto";
import type {
  AuthorityReceipt,
  DelegationDecision,
  DelegationRequest,
  ReceiptIntegrity,
  RequestedScope,
} from "../schemas/delegation.js";
import type { PermissionManager } from "./permission-manager.js";

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

function decidedByLabel(decision: DelegationDecision): string {
  const d = decision.decided_by;
  if (d.kind === "human" && d.human_approver) {
    return d.human_approver;
  }
  if (d.policy_id) {
    return `policy:${d.policy_id}`;
  }
  return d.kind;
}

function readConstraintBool(
  scope: RequestedScope,
  key: string,
  defaultValue: boolean,
): boolean {
  const v = scope.constraints?.[key];
  if (typeof v === "boolean") {
    return v;
  }
  return defaultValue;
}

export class AuthBroker {
  constructor(private permissionManager: PermissionManager) {}

  computeIntegrity(
    payload: Omit<AuthorityReceipt, "integrity">,
  ): ReceiptIntegrity {
    const body = stableStringify(payload);
    const content_hash = createHash("sha256").update(body, "utf8").digest("hex");
    return { hash_algorithm: "sha256", content_hash };
  }

  materialize(
    decision: DelegationDecision,
    request: DelegationRequest,
  ): AuthorityReceipt {
    if (decision.status !== "approved" && decision.status !== "narrowed") {
      throw new Error(
        `AuthBroker.materialize requires an approved or narrowed decision, got ${decision.status}`,
      );
    }
    if (decision.request_id !== request.request_id) {
      throw new Error("DelegationDecision.request_id does not match DelegationRequest");
    }

    const granted_scope: RequestedScope =
      decision.status === "narrowed" && decision.narrowed_scope
        ? decision.narrowed_scope
        : request.requested_scope;

    const ttl_seconds =
      request.preferred_ttl_seconds !== undefined && request.preferred_ttl_seconds > 0
        ? request.preferred_ttl_seconds
        : 900;

    const one_shot = readConstraintBool(granted_scope, "one_shot", false);
    const forwardable = readConstraintBool(granted_scope, "forwardable", false);

    const audience = request.preferred_audience ?? granted_scope.resource;
    const grant = this.permissionManager.grant({
      granted_to: request.requester,
      scope: granted_scope,
      audience,
      ttl_seconds,
      one_shot,
      forwardable,
      granted_by: decidedByLabel(decision),
      policy_ref: decision.policy_refs[0],
      request_ref: request.request_id,
      decision_ref: decision.decision_id,
    });

    const effective_at = grant.effective_at;
    const expires_at = grant.expires_at;

    const receiptBody: Omit<AuthorityReceipt, "integrity"> = {
      schema_version: "0.2",
      receipt_id: randomUUID(),
      decision_id: decision.decision_id,
      request_id: request.request_id,
      permission_id: grant.permission_id,
      granted_scope,
      effective_at,
      expires_at,
      one_shot: grant.one_shot,
      forwardable: grant.forwardable,
      audience: grant.audience,
    };

    const integrity = this.computeIntegrity(receiptBody);

    return {
      ...receiptBody,
      integrity,
    };
  }
}
