import { describe, it, expect } from "vitest";
import {
  buildManifest,
  manifestToCompactText,
} from "../src/governance/manifest-builder.js";
import type { PolicySet } from "../src/governance/policy-evaluator.js";
import { defineToolContract } from "../src/tools/tool-types.js";
import { DEFAULT_SANDBOX_CONFIG } from "../src/schemas/sandbox.js";
import { createInitialSnapshot, DEFAULT_BUDGET_POLICY } from "../src/schemas/budget.js";
import type { SandboxConfig } from "../src/schemas/sandbox.js";

const searchContract = defineToolContract({
  name: "search",
  description: "Search a knowledge base",
  inputSchema: { type: "object", properties: { query: { type: "string" } } },
  idempotent: true,
  retryable: true,
  failureTypes: ["not_found"],
});

const calcContract = defineToolContract({
  name: "calculator",
  description: "Evaluate math expressions",
  inputSchema: { type: "object", properties: { expression: { type: "string" } } },
  idempotent: true,
  retryable: false,
  failureTypes: ["invalid_input"],
});

const writeContract = defineToolContract({
  name: "writeFile",
  description: "Write content to a file",
  inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } } },
  idempotent: false,
  retryable: false,
  failureTypes: ["permission_denied"],
});

const shellContract = defineToolContract({
  name: "shell",
  description: "Execute shell commands",
  inputSchema: { type: "object", properties: { command: { type: "string" } } },
  idempotent: false,
  retryable: false,
  failureTypes: ["permission_denied"],
});

const allTools = [searchContract, calcContract, writeContract, shellContract];
const budget = createInitialSnapshot(DEFAULT_BUDGET_POLICY);

describe("buildManifest", () => {
  it("classifies sandbox-allowed tools as pre_authorized", () => {
    const manifest = buildManifest({
      runId: "run-1",
      agentId: "agent-1",
      phase: "frame",
      toolContracts: allTools,
      sandbox: DEFAULT_SANDBOX_CONFIG,
      policies: [],
      budget,
    });

    expect(manifest.tools.available).toHaveLength(4);
    expect(manifest.tools.blocked).toHaveLength(0);
    for (const tool of manifest.tools.available) {
      expect(tool.access_level).toBe("pre_authorized");
    }
  });

  it("moves blocked tools to the blocked list", () => {
    const sandbox: SandboxConfig = {
      ...DEFAULT_SANDBOX_CONFIG,
      blockedTools: ["shell"],
    };

    const manifest = buildManifest({
      runId: "run-1",
      agentId: "agent-1",
      phase: "frame",
      toolContracts: allTools,
      sandbox,
      policies: [],
      budget,
    });

    expect(manifest.tools.available).toHaveLength(3);
    expect(manifest.tools.blocked).toContain("shell");
    expect(manifest.tools.available.find((t) => t.name === "shell")).toBeUndefined();
  });

  it("marks tools as requires_delegation when policy narrows", () => {
    const narrowPolicy: PolicySet = {
      policy_id: "narrow-search",
      policy_type: "compliance",
      rules: [
        {
          rule_id: "narrow-search",
          action: "narrow",
          resource: "tool:search",
          narrowing: { max_results: 5, excluded_fields: ["raw_html"] },
        },
      ],
      priority: 10,
    };

    const manifest = buildManifest({
      runId: "run-1",
      agentId: "agent-1",
      phase: "frame",
      toolContracts: allTools,
      sandbox: DEFAULT_SANDBOX_CONFIG,
      policies: [narrowPolicy],
      budget,
    });

    const searchTool = manifest.tools.available.find((t) => t.name === "search");
    expect(searchTool).toBeDefined();
    expect(searchTool!.access_level).toBe("requires_delegation");
    expect(searchTool!.constraints).toEqual({
      max_results: 5,
      excluded_fields: ["raw_html"],
    });
    expect(manifest.active_constraints).toHaveLength(2);
  });

  it("blocks tools when policy denies them", () => {
    const denyPolicy: PolicySet = {
      policy_id: "deny-shell",
      policy_type: "safety",
      rules: [
        { rule_id: "deny-shell", action: "deny", resource: "tool:shell" },
      ],
      priority: 1,
    };

    const manifest = buildManifest({
      runId: "run-1",
      agentId: "agent-1",
      phase: "frame",
      toolContracts: allTools,
      sandbox: DEFAULT_SANDBOX_CONFIG,
      policies: [denyPolicy],
      budget,
    });

    expect(manifest.tools.blocked).toContain("shell");
    expect(manifest.tools.available.find((t) => t.name === "shell")).toBeUndefined();
  });

  it("includes budget snapshot", () => {
    const manifest = buildManifest({
      runId: "run-1",
      agentId: "agent-1",
      phase: "frame",
      toolContracts: allTools,
      sandbox: DEFAULT_SANDBOX_CONFIG,
      policies: [],
      budget,
    });

    expect(manifest.budget.steps_remaining).toBe(DEFAULT_BUDGET_POLICY.maxSteps);
    expect(manifest.budget.tokens_remaining).toBe(DEFAULT_BUDGET_POLICY.maxTokens);
    expect(manifest.budget.tool_calls_remaining).toBe(DEFAULT_BUDGET_POLICY.maxToolCalls);
  });

  it("uses provided trust level", () => {
    const manifest = buildManifest({
      runId: "run-1",
      agentId: "agent-1",
      phase: "frame",
      toolContracts: allTools,
      sandbox: DEFAULT_SANDBOX_CONFIG,
      policies: [],
      budget,
      trustLevel: "high",
    });

    expect(manifest.trust_level).toBe("high");
  });

  it("stores phase and IDs correctly", () => {
    const manifest = buildManifest({
      runId: "run-42",
      agentId: "agent-planner",
      phase: "critique_verify",
      toolContracts: allTools,
      sandbox: DEFAULT_SANDBOX_CONFIG,
      policies: [],
      budget,
    });

    expect(manifest.run_id).toBe("run-42");
    expect(manifest.agent_id).toBe("agent-planner");
    expect(manifest.phase).toBe("critique_verify");
    expect(manifest.manifest_id).toBeTruthy();
    expect(manifest.timestamp).toBeTruthy();
  });
});

describe("manifestToCompactText", () => {
  it("produces readable text with markers", () => {
    const manifest = buildManifest({
      runId: "run-1",
      agentId: "agent-1",
      phase: "frame",
      toolContracts: [searchContract, calcContract],
      sandbox: DEFAULT_SANDBOX_CONFIG,
      policies: [],
      budget,
    });

    const text = manifestToCompactText(manifest);

    expect(text).toContain("[capability_manifest]");
    expect(text).toContain("[/capability_manifest]");
    expect(text).toContain("tools_available:");
    expect(text).toContain("search");
    expect(text).toContain("calculator");
    expect(text).toContain("budget:");
    expect(text).toContain("trust_level: medium");
  });

  it("lists blocked tools", () => {
    const sandbox: SandboxConfig = {
      ...DEFAULT_SANDBOX_CONFIG,
      blockedTools: ["shell"],
    };

    const manifest = buildManifest({
      runId: "run-1",
      agentId: "agent-1",
      phase: "frame",
      toolContracts: allTools,
      sandbox,
      policies: [],
      budget,
    });

    const text = manifestToCompactText(manifest);
    expect(text).toContain("tools_blocked: shell");
  });

  it("includes active constraints", () => {
    const narrowPolicy: PolicySet = {
      policy_id: "narrow",
      policy_type: "compliance",
      rules: [
        {
          rule_id: "n1",
          action: "narrow",
          resource: "tool:search",
          narrowing: { max_results: 3 },
        },
      ],
      priority: 10,
    };

    const manifest = buildManifest({
      runId: "run-1",
      agentId: "agent-1",
      phase: "frame",
      toolContracts: [searchContract],
      sandbox: DEFAULT_SANDBOX_CONFIG,
      policies: [narrowPolicy],
      budget,
    });

    const text = manifestToCompactText(manifest);
    expect(text).toContain("constraints:");
    expect(text).toContain("max 3 results");
  });

  it("compact text is reasonably token-efficient", () => {
    const manifest = buildManifest({
      runId: "run-1",
      agentId: "agent-1",
      phase: "frame",
      toolContracts: allTools,
      sandbox: { ...DEFAULT_SANDBOX_CONFIG, blockedTools: ["shell"] },
      policies: [],
      budget,
    });

    const text = manifestToCompactText(manifest);
    const wordCount = text.split(/\s+/).length;
    expect(wordCount).toBeLessThan(100);
  });
});
