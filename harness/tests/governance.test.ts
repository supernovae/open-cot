import { describe, it, expect } from "vitest";
import { PermissionManager } from "../src/governance/permission-manager.js";
import { PolicyEvaluator } from "../src/governance/policy-evaluator.js";
import type { PolicySet, PolicyRule } from "../src/governance/policy-evaluator.js";
import { AuthBroker } from "../src/governance/auth-broker.js";
import { AuditEngine } from "../src/governance/audit-engine.js";
import type { DelegationRequest, DelegationDecision } from "../src/schemas/delegation.js";
import { createAgentState } from "../src/core/state.js";

const sampleScope = {
  resource: "tool:search",
  action: "execute" as const,
};

function makeRequest(overrides?: Partial<DelegationRequest>): DelegationRequest {
  return {
    request_id: "req-test-1",
    requester: "agent-test",
    run_id: "run-test",
    intent: "Search the web",
    justification: "Need external facts",
    requested_scope: sampleScope,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("PermissionManager", () => {
  it("grant() creates an active permission", () => {
    const pm = new PermissionManager();
    const grant = pm.grant({
      granted_to: "agent-1",
      scope: sampleScope,
      ttl_seconds: 3600,
      one_shot: false,
      forwardable: false,
      granted_by: "policy:p1",
    });

    expect(grant.permission_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(grant.status).toBe("active");
    expect(Date.parse(grant.expires_at)).toBeGreaterThan(Date.now());
  });

  it("consume() marks one-shot permission as consumed", () => {
    const pm = new PermissionManager();
    const grant = pm.grant({
      granted_to: "agent-1",
      scope: sampleScope,
      ttl_seconds: 3600,
      one_shot: true,
      forwardable: false,
      granted_by: "policy:p1",
    });
    expect(pm.consume(grant.permission_id)).toBe(true);
    expect(pm.get(grant.permission_id)?.status).toBe("consumed");
  });

  it("consume() rejects non-one-shot permissions", () => {
    const pm = new PermissionManager();
    const grant = pm.grant({
      granted_to: "agent-1",
      scope: sampleScope,
      ttl_seconds: 3600,
      one_shot: false,
      forwardable: false,
      granted_by: "policy:p1",
    });
    expect(pm.consume(grant.permission_id)).toBe(false);
    expect(pm.get(grant.permission_id)?.status).toBe("active");
  });

  it("isValid() returns false for expired permissions", () => {
    const pm = new PermissionManager();
    const grant = pm.grant({
      granted_to: "agent-1",
      scope: sampleScope,
      ttl_seconds: 0,
      one_shot: false,
      forwardable: false,
      granted_by: "policy:p1",
    });
    expect(pm.isValid(grant.permission_id)).toBe(false);
    expect(pm.get(grant.permission_id)?.status).toBe("expired");
  });

  it("revoke() marks permission as revoked", () => {
    const pm = new PermissionManager();
    const grant = pm.grant({
      granted_to: "agent-1",
      scope: sampleScope,
      ttl_seconds: 3600,
      one_shot: false,
      forwardable: false,
      granted_by: "policy:p1",
    });
    expect(pm.revoke(grant.permission_id, "security review")).toBe(true);
    const updated = pm.get(grant.permission_id);
    expect(updated?.status).toBe("revoked");
    expect(updated?.revocation_reason).toBe("security review");
  });

  it("revokeAll() revokes all active permissions", () => {
    const pm = new PermissionManager();
    const a = pm.grant({
      granted_to: "agent-1",
      scope: sampleScope,
      ttl_seconds: 3600,
      one_shot: false,
      forwardable: false,
      granted_by: "policy:p1",
    });
    const b = pm.grant({
      granted_to: "agent-2",
      scope: { resource: "tool:calc", action: "execute" },
      ttl_seconds: 3600,
      one_shot: false,
      forwardable: false,
      granted_by: "policy:p1",
    });
    pm.revokeAll("batch shutdown");
    expect(pm.get(a.permission_id)?.status).toBe("revoked");
    expect(pm.get(b.permission_id)?.status).toBe("revoked");
  });

  it("getEvents() tracks lifecycle events", () => {
    const pm = new PermissionManager();
    const grant = pm.grant({
      granted_to: "agent-1",
      scope: sampleScope,
      ttl_seconds: 3600,
      one_shot: true,
      forwardable: false,
      granted_by: "policy:p1",
    });
    pm.consume(grant.permission_id);
    const events = pm.getEvents();
    expect(events.map((e) => e.event)).toEqual([
      "permission_granted",
      "permission_consumed",
    ]);
    expect(events[0]?.permission_id).toBe(grant.permission_id);
    expect(events[1]?.permission_id).toBe(grant.permission_id);
  });
});

describe("PolicyEvaluator", () => {
  const baseRequest = (): DelegationRequest => makeRequest();

  it("approve when allow rule matches", () => {
    const ev = new PolicyEvaluator();
    const policy: PolicySet = {
      policy_id: "p-allow",
      policy_type: "operational",
      priority: 1,
      rules: [
        {
          rule_id: "r1",
          action: "allow",
          resource: "tool:search",
        } satisfies PolicyRule,
      ],
    };
    ev.addPolicy(policy);
    const decision = ev.evaluate(baseRequest(), "agent-1");
    expect(decision.status).toBe("approved");
  });

  it("deny when deny rule matches", () => {
    const ev = new PolicyEvaluator();
    ev.addPolicy({
      policy_id: "p-deny",
      policy_type: "safety",
      priority: 1,
      rules: [
        {
          rule_id: "d1",
          action: "deny",
          resource: "tool:search",
          reason: "Search disabled",
        },
      ],
    });
    const decision = ev.evaluate(baseRequest(), "agent-1");
    expect(decision.status).toBe("denied");
    expect(decision.denial_reason).toBe("Search disabled");
  });

  it("narrow when narrow rule matches", () => {
    const ev = new PolicyEvaluator();
    ev.addPolicy({
      policy_id: "p-narrow",
      policy_type: "compliance",
      priority: 1,
      rules: [
        {
          rule_id: "n1",
          action: "narrow",
          resource: "tool:search",
          narrowing: { excluded_fields: ["pii", "secrets"] },
        },
      ],
    });
    const decision = ev.evaluate(baseRequest(), "agent-1");
    expect(decision.status).toBe("narrowed");
    expect(decision.narrowed_scope?.constraints?.excluded_fields).toEqual([
      "pii",
      "secrets",
    ]);
  });

  it("default deny when no rules match", () => {
    const ev = new PolicyEvaluator();
    const decision = ev.evaluate(baseRequest(), "agent-1");
    expect(decision.status).toBe("denied");
    expect(decision.denial_reason).toContain("fail-closed");
  });

  it("deny takes precedence over allow", () => {
    const ev = new PolicyEvaluator();
    ev.addPolicy({
      policy_id: "allow-first",
      policy_type: "operational",
      priority: 1,
      rules: [{ rule_id: "a1", action: "allow", resource: "tool:search" }],
    });
    ev.addPolicy({
      policy_id: "deny-second-higher-priority-number",
      policy_type: "safety",
      priority: 10,
      rules: [{ rule_id: "d1", action: "deny", resource: "tool:search", reason: "blocked" }],
    });
    const decision = ev.evaluate(baseRequest(), "agent-1");
    expect(decision.status).toBe("denied");
    expect(decision.denial_reason).toBe("blocked");
  });

  it("resource pattern matching with wildcard", () => {
    const ev = new PolicyEvaluator();
    ev.addPolicy({
      policy_id: "wildcard",
      policy_type: "operational",
      priority: 1,
      rules: [{ rule_id: "w1", action: "allow", resource: "tool:*" }],
    });
    const decision = ev.evaluate(baseRequest(), "agent-1");
    expect(decision.status).toBe("approved");
  });
});

describe("AuthBroker", () => {
  it("materialize() creates authority receipt for approved decision", () => {
    const pm = new PermissionManager();
    const broker = new AuthBroker(pm);
    const request = makeRequest({ request_id: "req-approved" });
    const ev = new PolicyEvaluator();
    ev.addPolicy({
      policy_id: "p1",
      policy_type: "operational",
      priority: 1,
      rules: [{ rule_id: "r1", action: "allow", resource: "tool:search" }],
    });
    const decision = ev.evaluate(request, request.requester);
    expect(decision.status).toBe("approved");

    const receipt = broker.materialize(decision, request);
    expect(receipt.request_id).toBe(request.request_id);
    expect(receipt.decision_id).toBe(decision.decision_id);
    expect(receipt.granted_scope).toEqual(request.requested_scope);
    expect(receipt.permission_id).toBeTruthy();
    expect(receipt.integrity.hash_algorithm).toBe("sha256");
    expect(receipt.integrity.content_hash).toMatch(/^[0-9a-f]{64}$/);
    const { integrity, ...body } = receipt;
    expect(broker.computeIntegrity(body).content_hash).toBe(integrity.content_hash);
  });

  it("materialize() uses narrowed scope when decision is narrowed", () => {
    const pm = new PermissionManager();
    const broker = new AuthBroker(pm);
    const request = makeRequest({ request_id: "req-narrow" });
    const ev = new PolicyEvaluator();
    ev.addPolicy({
      policy_id: "p-n",
      policy_type: "compliance",
      priority: 1,
      rules: [
        {
          rule_id: "n1",
          action: "narrow",
          resource: "tool:search",
          narrowing: { excluded_fields: ["internal"] },
        },
      ],
    });
    const decision = ev.evaluate(request, request.requester);
    expect(decision.status).toBe("narrowed");

    const receipt = broker.materialize(decision, request);
    expect(receipt.granted_scope.constraints?.excluded_fields).toEqual(["internal"]);
  });

  it("materialize() rejects denied decisions", () => {
    const broker = new AuthBroker(new PermissionManager());
    const request = makeRequest({ request_id: "req-denied" });
    const decision: DelegationDecision = {
      decision_id: "dec-deny",
      request_id: request.request_id,
      status: "denied",
      decided_by: { kind: "harness" },
      policy_refs: [],
      denial_reason: "no",
      timestamp: request.timestamp,
    };
    expect(() => broker.materialize(decision, request)).toThrow(
      /approved or narrowed/,
    );
  });
});

describe("AuditEngine", () => {
  it("emit() creates hash-chained events", () => {
    const engine = new AuditEngine();
    const e1 = engine.emit({
      run_id: "run-1",
      agent_id: "agent-1",
      event_type: "test.a",
      details: { n: 1 },
    });
    const e2 = engine.emit({
      run_id: "run-1",
      agent_id: "agent-1",
      event_type: "test.b",
      details: { n: 2 },
    });
    const e3 = engine.emit({
      run_id: "run-1",
      agent_id: "agent-1",
      event_type: "test.c",
      details: { n: 3 },
    });
    expect(e1.previous_event_id).toBeNull();
    expect(e2.previous_event_id).toBe(e1.event_id);
    expect(e3.previous_event_id).toBe(e2.event_id);
    expect(e1.integrity.content_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("seal() produces audit envelope", () => {
    const engine = new AuditEngine();
    const state = createAgentState({ objective: "demo task" });
    state.trace.steps.push({
      id: "s-1",
      type: "thought",
      content: "hello",
    });
    const envelope = engine.seal(state);
    expect(envelope.trace_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(envelope.integrity.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(envelope.integrity.hash_algorithm).toBe("sha256");
    expect(envelope.started_at).toBe(state.telemetry.timestamp);
    expect(Date.parse(envelope.sealed_at)).not.toBeNaN();
    expect(AuditEngine.verify(envelope)).toBe(true);
  });
});
