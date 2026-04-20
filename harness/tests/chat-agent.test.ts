import { describe, it, expect, beforeEach } from "vitest";
import { runChatAgent } from "../src/agents/chat-agent.js";
import { MockLLMBackend } from "../src/backends/mock.js";
import { createMockToolRegistry } from "../src/tools/mock-tools.js";
import { resetStepCounter } from "../src/core/trace-emitter.js";
import {
  validateActionObservationPairing,
  validateTermination,
} from "../src/core/validator.js";
import type { PolicySet } from "../src/governance/policy-evaluator.js";

describe("ChatAgent (mock backend)", () => {
  beforeEach(() => {
    resetStepCounter();
  });

  it("completes a simple question with a valid trace", async () => {
    const trace = await runChatAgent(
      new MockLLMBackend(),
      "What is 2 + 2? Calculate it.",
      createMockToolRegistry(),
    );

    expect(trace.final_answer).toBeTruthy();
    expect(trace.version).toBe("0.2");
    expect(trace.steps.length).toBeGreaterThan(0);
  });

  it("emits valid termination status", async () => {
    const trace = await runChatAgent(
      new MockLLMBackend(),
      "Plan how to organize a project.",
      createMockToolRegistry(),
    );

    const termResult = validateTermination(trace);
    expect(termResult.valid).toBe(true);
  });

  it("pairs all actions with observations", async () => {
    const trace = await runChatAgent(
      new MockLLMBackend(),
      "Search for the capital of France.",
      createMockToolRegistry(),
    );

    const pairingResult = validateActionObservationPairing(trace);
    expect(pairingResult.valid).toBe(true);
  });

  it("records LLM usage in trace steps", async () => {
    const trace = await runChatAgent(
      new MockLLMBackend(),
      "Tell me about Tokyo.",
      createMockToolRegistry(),
    );

    expect(trace.steps.length).toBeGreaterThan(3);
    expect(trace.final_answer).toBeTruthy();
  });

  it("stops on budget exhaustion", async () => {
    const trace = await runChatAgent(
      new MockLLMBackend(),
      "Plan a complex analysis.",
      createMockToolRegistry(),
      {
        maxTokens: 10,
        maxCost: 10,
        maxSteps: 50,
        maxToolCalls: 20,
        maxRetries: 5,
        enforcement: "hard",
      },
    );

    expect(trace.termination).toBe("budget_exhausted");
  });

  it("trace steps have unique IDs", async () => {
    const trace = await runChatAgent(
      new MockLLMBackend(),
      "Search for the speed of light.",
      createMockToolRegistry(),
    );

    const ids = trace.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("routes tool calls through policy engine decisions", async () => {
    const denySearch: PolicySet = {
      policy_id: "deny-search",
      policy_type: "safety",
      priority: 1,
      rules: [
        {
          rule_id: "deny-search-rule",
          action: "deny",
          resource: "tool:search",
          reason: "Search denied for test",
        },
      ],
    };
    const trace = await runChatAgent(
      new MockLLMBackend(),
      "Search for weather alerts.",
      createMockToolRegistry(),
      undefined,
      undefined,
      undefined,
      { policies: [denySearch] },
    );

    expect(trace.termination).toBe("denied");
    expect(trace.final_answer).toContain("Search denied for test");
  });
});
