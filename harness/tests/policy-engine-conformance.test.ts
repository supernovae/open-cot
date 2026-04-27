import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpaPolicyEngine } from "../src/governance/index.js";
import type {
  DecidedBy,
  DelegationRequest,
  DelegationStatus,
  RequestedScope,
} from "../src/schemas/delegation.js";

interface FixtureExpected {
  status: DelegationStatus;
  policy_refs?: string[];
  narrowed_scope?: RequestedScope;
  denial_reason?: string;
  denial_reason_contains?: string;
  decided_by?: Partial<DecidedBy>;
}

interface FixtureCase {
  name: string;
  request?: Partial<DelegationRequest>;
  opa_result: Record<string, unknown>;
  expected: FixtureExpected;
}

interface FixtureFile {
  cases: FixtureCase[];
}

function loadFixtureFile(): FixtureFile {
  const filePath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "fixtures/opa-decision-conformance.json",
  );
  return JSON.parse(readFileSync(filePath, "utf8")) as FixtureFile;
}

function makeRequest(overrides?: Partial<DelegationRequest>): DelegationRequest {
  const base: DelegationRequest = {
    schema_version: "0.2",
    request_id: "req-conformance",
    requester: "cognitive-pipeline-conformance",
    run_id: "run-conformance",
    intent: "Conformance policy check",
    justification: "Verify OPA decision mapping contract",
    requested_scope: {
      resource: "tool:search",
      action: "execute",
    },
    observed_at: "2026-01-01T00:00:00.000Z",
  };
  return {
    ...base,
    ...overrides,
    requested_scope: overrides?.requested_scope ?? base.requested_scope,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("OPA decision conformance fixtures", () => {
  const fixtures = loadFixtureFile();

  for (const fixtureCase of fixtures.cases) {
    it(fixtureCase.name, async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            result: fixtureCase.opa_result,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const engine = new OpaPolicyEngine({
        baseUrl: "https://opa.example",
        policyPath: "open_cot/delegation",
      });
      const request = makeRequest(fixtureCase.request);
      const decision = await engine.evaluate(request, "cognitive-pipeline-1");

      expect(decision.request_id).toBe(request.request_id);
      expect(decision.decision_id).toMatch(/^[0-9a-f]{64}$/);
      expect(decision.status).toBe(fixtureCase.expected.status);

      if (fixtureCase.expected.policy_refs !== undefined) {
        expect(decision.policy_refs).toEqual(fixtureCase.expected.policy_refs);
      }
      if (fixtureCase.expected.narrowed_scope !== undefined) {
        expect(decision.narrowed_scope).toEqual(fixtureCase.expected.narrowed_scope);
      }
      if (fixtureCase.expected.denial_reason !== undefined) {
        expect(decision.denial_reason).toBe(fixtureCase.expected.denial_reason);
      }
      if (fixtureCase.expected.denial_reason_contains !== undefined) {
        expect(decision.denial_reason ?? "").toContain(
          fixtureCase.expected.denial_reason_contains,
        );
      }
      if (fixtureCase.expected.decided_by !== undefined) {
        expect(decision.decided_by).toMatchObject(fixtureCase.expected.decided_by);
      }
    });
  }
});
