import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InProcessPolicyEngine,
  OpaPolicyEngine,
  createDelegationDecision,
  type DelegationPolicyEngine,
} from "../src/governance/index.js";
import type { PolicySet } from "../src/governance/policy-evaluator.js";
import type { DelegationRequest } from "../src/schemas/delegation.js";

function makeRequest(overrides?: Partial<DelegationRequest>): DelegationRequest {
  return {
    schema_version: "0.2",
    request_id: "req-policy-test",
    requester: "agent-test",
    run_id: "run-test",
    intent: "Search for data",
    justification: "Need external evidence",
    requested_scope: {
      resource: "tool:search",
      action: "execute",
    },
    observed_at: new Date().toISOString(),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("InProcessPolicyEngine", () => {
  it("evaluates policies with existing evaluator semantics", async () => {
    const allowSearch: PolicySet = {
      policy_id: "allow-search",
      policy_type: "operational",
      priority: 1,
      rules: [
        {
          rule_id: "allow-search-tool",
          action: "allow",
          resource: "tool:search",
        },
      ],
    };
    const engine = new InProcessPolicyEngine([allowSearch]);

    const decision = await engine.evaluate(makeRequest(), "agent-1");
    expect(decision.status).toBe("approved");
    expect(decision.policy_refs).toEqual(["allow-search"]);
  });

  it("allows phase consultation when no phase policies are configured", async () => {
    const engine = new InProcessPolicyEngine([]);
    const decision = await engine.consultPhase?.({
      runId: "run-1",
      agentId: "agent-1",
      objective: "Summarize docs",
      phase: "frame",
    });
    expect(decision).toEqual({
      status: "allowed",
      policyRefs: [],
    });
  });

  it("denies phase consultation when a matching phase rule denies", async () => {
    const denyFinalize: PolicySet = {
      policy_id: "deny-finalize",
      policy_type: "safety",
      priority: 1,
      rules: [
        {
          rule_id: "deny-finalize-phase",
          action: "deny",
          resource: "phase:finalize",
          reason: "Finalization requires human approval",
        },
      ],
    };
    const engine = new InProcessPolicyEngine([denyFinalize]);
    const decision = await engine.consultPhase?.({
      runId: "run-1",
      agentId: "agent-1",
      objective: "Complete task",
      phase: "finalize",
    });
    expect(decision?.status).toBe("denied");
    expect(decision?.reason).toContain("Finalization requires human approval");
  });

  it("previews tool access for manifest reconciliation", async () => {
    const policy: PolicySet = {
      policy_id: "tool-policy",
      policy_type: "operational",
      priority: 10,
      rules: [
        {
          rule_id: "allow-search",
          action: "allow",
          resource: "tool:search",
        },
        {
          rule_id: "narrow-calc",
          action: "narrow",
          resource: "tool:calculator",
          narrowing: { max_results: 2 },
        },
      ],
    };
    const engine = new InProcessPolicyEngine([policy]);
    const preview = await engine.previewToolAccess?.({
      runId: "run-1",
      agentId: "agent-1",
      objective: "Research and compute",
      phase: "plan",
      tools: [
        {
          name: "search",
          description: "Search docs",
          inputSchema: { type: "object" },
          expectedSideEffects: [],
          timeoutMs: 1_000,
          idempotent: true,
          retryable: true,
          failureTypes: ["not_found"],
        },
        {
          name: "calculator",
          description: "Compute values",
          inputSchema: { type: "object" },
          expectedSideEffects: [],
          timeoutMs: 1_000,
          idempotent: true,
          retryable: false,
          failureTypes: ["invalid_input"],
        },
        {
          name: "shell",
          description: "Run shell",
          inputSchema: { type: "object" },
          expectedSideEffects: ["filesystem"],
          timeoutMs: 1_000,
          idempotent: false,
          retryable: false,
          failureTypes: ["permission_denied"],
        },
      ],
      sandbox: {
        allowedTools: ["*"],
        blockedTools: ["shell"],
        maxSteps: 20,
        maxBranches: 3,
        memoryAcl: { default: ["read"] },
      },
    });

    expect(preview?.search?.accessLevel).toBe("pre_authorized");
    expect(preview?.calculator?.accessLevel).toBe("requires_delegation");
    expect(preview?.calculator?.constraints).toEqual({ max_results: 2 });
    expect(preview?.shell?.accessLevel).toBe("blocked");
  });
});

describe("OpaPolicyEngine", () => {
  it("maps a valid OPA decision result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            status: "narrowed",
            policy_refs: ["opa.search.policy"],
            narrowed_scope: {
              resource: "tool:search",
              action: "execute",
              constraints: { max_results: 3 },
            },
          },
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
    const decision = await engine.evaluate(makeRequest(), "agent-1");

    expect(decision.status).toBe("narrowed");
    expect(decision.policy_refs).toEqual(["opa.search.policy"]);
    expect(decision.narrowed_scope?.constraints?.max_results).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://opa.example/v1/data/open_cot/delegation");
    const body = JSON.parse(String(init.body));
    expect(body.input.agent_id).toBe("agent-1");
    expect(body.input.request.request_id).toBe("req-policy-test");
  });

  it("fails closed when OPA result is invalid", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: { foo: "bar" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const engine = new OpaPolicyEngine({
      baseUrl: "https://opa.example",
      policyPath: "open_cot/delegation",
    });
    const decision = await engine.evaluate(makeRequest(), "agent-1");

    expect(decision.status).toBe("denied");
    expect(decision.denial_reason).toContain("OPA policy evaluation failed");
  });

  it("uses fallback engine when OPA request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetchMock);

    const fallback: DelegationPolicyEngine = {
      name: "fallback",
      evaluate: async (request, agentId) =>
        createDelegationDecision(request, agentId, {
          status: "approved",
          decidedBy: { kind: "harness" },
          policyRefs: ["fallback-policy"],
          outcomeKind: "fallback_allow",
        }),
    };

    const engine = new OpaPolicyEngine({
      baseUrl: "https://opa.example",
      policyPath: "open_cot/delegation",
      fallbackEngine: fallback,
    });
    const decision = await engine.evaluate(makeRequest(), "agent-1");

    expect(decision.status).toBe("approved");
    expect(decision.policy_refs).toEqual(["fallback-policy"]);
  });

  it("forwards configured inputContext to OPA input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            status: "approved",
            policy_refs: ["opa.allow"],
          },
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
      inputContext: { policy_mode: "deny", request_source: "demo" },
    });
    await engine.evaluate(makeRequest(), "agent-1");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.input.context).toEqual({
      policy_mode: "deny",
      request_source: "demo",
    });
  });
});
