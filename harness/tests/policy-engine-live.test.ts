import { describe, expect, it } from "vitest";
import { OpaPolicyEngine } from "../src/governance/index.js";
import type { DelegationRequest } from "../src/schemas/delegation.js";

function makeRequest(overrides?: Partial<DelegationRequest>): DelegationRequest {
  return {
    schema_version: "0.2",
    request_id: "req-live-opa",
    requester: "cognitive-pipeline-live",
    run_id: "run-live",
    intent: "Live OPA integration check",
    justification: "Validate runtime OPA decision mapping",
    requested_scope: {
      resource: "tool:search",
      action: "execute",
    },
    observed_at: new Date().toISOString(),
    ...overrides,
  };
}

const opaBaseUrl = process.env["OPA_BASE_URL"];
const opaPolicyPath = process.env["OPA_POLICY_PATH"] ?? "open_cot/delegation";
const hasLiveConfig = Boolean(opaBaseUrl);
const describeLive = hasLiveConfig ? describe : describe.skip;

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

describeLive("OpaPolicyEngine live integration", () => {
  it("queries a live OPA server and returns a valid delegation decision", async () => {
    const engine = new OpaPolicyEngine({
      baseUrl: opaBaseUrl!,
      policyPath: opaPolicyPath,
      bearerToken: process.env["OPA_BEARER_TOKEN"],
      timeoutMs: parsePositiveInt(process.env["OPA_TIMEOUT_MS"]),
      inputContext: {
        policy_mode: process.env["OPA_LIVE_POLICY_MODE"] ?? "allow",
        source: "vitest-live",
      },
    });
    const request = makeRequest();
    const decision = await engine.evaluate(request, "cognitive-pipeline-live-01");

    expect(decision.request_id).toBe(request.request_id);
    expect(decision.decision_id).toMatch(/^[0-9a-f]{64}$/);
    expect(decision.status).toMatch(/^(approved|denied|narrowed|escalated)$/);
    expect(decision.decided_by.kind).toMatch(/^(policy|human|harness)$/);
    expect(Date.parse(decision.decided_at)).not.toBeNaN();
    expect(Array.isArray(decision.policy_refs)).toBe(true);

    if (decision.status === "narrowed") {
      expect(decision.narrowed_scope).toBeDefined();
    }
    if (decision.status === "denied") {
      expect(typeof decision.denial_reason).toBe("string");
      expect((decision.denial_reason ?? "").length).toBeGreaterThan(0);
    }
  });
});
