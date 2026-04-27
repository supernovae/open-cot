import { describe, it, expect, beforeEach } from "vitest";
import { runGovernedPipeline } from "../src/pipelines/governed-pipeline.js";
import type { GovernedPipelineConfig } from "../src/pipelines/governed-pipeline.js";
import { MockLLMBackend } from "../src/backends/mock.js";
import { createMockToolRegistry } from "../src/tools/mock-tools.js";
import { resetStepCounter } from "../src/core/trace-emitter.js";
import type { PolicySet } from "../src/governance/policy-evaluator.js";
import { AuditEngine } from "../src/governance/audit-engine.js";

/** Fail-closed evaluator denies everything unless explicitly allowed. */
const allowAllTools: PolicySet = {
  policy_id: "test-allow-tools",
  policy_type: "operational",
  priority: 100,
  rules: [{ rule_id: "allow-tool-star", action: "allow", resource: "tool:*" }],
};

describe("runGovernedPipeline (mock backend)", () => {
  beforeEach(() => {
    resetStepCounter();
  });

  function config(overrides: Partial<GovernedPipelineConfig> = {}): GovernedPipelineConfig {
    const { policies, ...rest } = overrides;
    return {
      objective: "What is 2+2? Calculate it.",
      backend: new MockLLMBackend(),
      toolRegistry: createMockToolRegistry(),
      policies: policies ?? [allowAllTools],
      ...rest,
    };
  }

  it("runs through governed FSM with tool calls", async () => {
    const result = await runGovernedPipeline(config());

    const hasDelegationSignal = result.trace.steps.some(
      (s) =>
        s.type === "delegation_request" ||
        s.content.includes("[request_authority]"),
    );
    const hasToolExecution = result.trace.steps.some(
      (s) => s.type === "action" && s.tool_invocation,
    );
    expect(hasDelegationSignal).toBe(true);
    expect(hasToolExecution).toBe(true);

    expect(result.envelope.integrity.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(AuditEngine.verify(result.envelope)).toBe(true);
  });

  it("handles no-tool reasoning", async () => {
    const result = await runGovernedPipeline(
      config({
        objective: "Summarize the benefits of clear documentation.",
      }),
    );

    expect(result.trace.steps.some((s) => s.content.includes("[transition]"))).toBe(
      true,
    );
    const sawFinalize = result.trace.steps.some((s) =>
      s.content.includes("-> finalize:"),
    );
    expect(sawFinalize).toBe(true);
    expect(result.state.phase).toBe("audit_seal");
    expect(result.envelope.completion_status).toBe("succeeded");
  });

  it("denies when policy blocks tool", async () => {
    const denySearch: PolicySet = {
      policy_id: "no-search",
      policy_type: "safety",
      priority: 1,
      rules: [
        {
          rule_id: "block-search",
          action: "deny",
          resource: "tool:search",
          reason: "Search is disabled in this environment",
        },
      ],
    };

    const result = await runGovernedPipeline(
      config({
        objective: "Search for open source libraries.",
        policies: [denySearch, allowAllTools],
      }),
    );

    expect(result.state.completionStatus).toBe("denied");
    const sawDeny = result.trace.steps.some(
      (s) =>
        s.type === "denial" ||
        s.content.includes("[deny]") ||
        s.content.includes("-> deny:"),
    );
    expect(sawDeny).toBe(true);
  });

  it("narrows scope when policy requires it", async () => {
    const narrowSearch: PolicySet = {
      policy_id: "narrow-search",
      policy_type: "compliance",
      priority: 1,
      rules: [
        {
          rule_id: "redact-search",
          action: "narrow",
          resource: "tool:search",
          narrowing: { excluded_fields: ["user_email", "api_token"] },
        },
      ],
    };

    const result = await runGovernedPipeline(
      config({
        objective: "Search for open source design patterns.",
        policies: [narrowSearch],
      }),
    );

    expect(result.state.authorityReceipts.length).toBeGreaterThan(0);
    const receipt = result.state.authorityReceipts[0]!;
    expect(receipt.granted_scope.constraints?.excluded_fields).toEqual([
      "user_email",
      "api_token",
    ]);
  });

  it("produces valid audit envelope", async () => {
    const result = await runGovernedPipeline(config());
    expect(result.envelope.trace_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.envelope.integrity.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(AuditEngine.verify(result.envelope)).toBe(true);
  });

  it("tracks delegation requests in state", async () => {
    const result = await runGovernedPipeline(config());
    expect(result.state.delegationRequests.length).toBeGreaterThan(0);
    expect(result.state.delegationDecisions.length).toBe(
      result.state.delegationRequests.length,
    );
  });

  it("enforces narrowed constraints at dispatch time", async () => {
    const backend = new MockLLMBackend([
      {
        pattern: /./,
        response: "I need to call search.",
        toolCalls: [
          {
            toolName: "search",
            arguments: { query: "tokyo", user_email: "user@example.com" },
          },
        ],
      },
    ]);
    const narrowSearch: PolicySet = {
      policy_id: "narrow-search",
      policy_type: "compliance",
      priority: 1,
      rules: [
        {
          rule_id: "exclude-email",
          action: "narrow",
          resource: "tool:search",
          narrowing: { excluded_fields: ["user_email"] },
        },
      ],
    };

    const result = await runGovernedPipeline(
      config({
        objective: "Search records.",
        backend,
        policies: [narrowSearch],
      }),
    );

    expect(result.state.toolExecutionReceipts.length).toBe(1);
    expect(result.state.toolExecutionReceipts[0]?.status).toBe("error");
    expect(result.state.toolExecutionReceipts[0]?.error_category).toBe(
      "permission_denied",
    );
    const deniedObservation = result.trace.steps.find(
      (step) =>
        step.type === "observation" && step.content.includes("excluded_fields"),
    );
    expect(deniedObservation).toBeDefined();
  });

  it("enforces policy consultation hooks at finalize", async () => {
    const denyFinalize: PolicySet = {
      policy_id: "deny-finalize",
      policy_type: "safety",
      priority: 1,
      rules: [
        {
          rule_id: "deny-finalize-phase",
          action: "deny",
          resource: "phase:finalize",
          reason: "Final responses require explicit approval",
        },
      ],
    };

    const result = await runGovernedPipeline(
      config({
        objective: "Explain this architecture in one paragraph.",
        policies: [denyFinalize, allowAllTools],
      }),
    );

    expect(result.state.completionStatus).toBe("denied");
    expect(result.trace.final_answer).toContain("Request denied by policy");
    const sawFinalizeDenial = result.trace.steps.some((step) =>
      step.content.includes("Policy denied at phase finalize"),
    );
    expect(sawFinalizeDenial).toBe(true);
  });
});
