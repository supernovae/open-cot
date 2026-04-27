import { describe, it, expect } from "vitest";
import { MockLLMBackend } from "../src/backends/mock.js";
import type { BudgetPolicy } from "../src/schemas/budget.js";
import { createPipelineState } from "../src/core/state.js";
import { createBudgetTracker } from "../src/core/budget-tracker.js";
import { callLLMWithCircuitBreaker } from "../src/core/llm-circuit-breaker.js";

function makePolicy(maxTokens: number): BudgetPolicy {
  return {
    maxTokens,
    maxCost: 10,
    maxSteps: 50,
    maxToolCalls: 20,
    maxRetries: 5,
    enforcement: "hard",
  };
}

describe("callLLMWithCircuitBreaker", () => {
  it("stops before decode when prompt estimate exceeds remaining budget", async () => {
    const state = createPipelineState({
      objective: "tiny budget",
      budgetPolicy: makePolicy(8),
    });
    const budget = createBudgetTracker();

    const response = await callLLMWithCircuitBreaker({
      backend: new MockLLMBackend(),
      state,
      budget,
      messages: [
        {
          role: "user",
          content: "This prompt is intentionally long enough to exceed tiny budget.",
        },
      ],
    });

    expect(response.content).toBe("");
    expect(state.completionStatus).toBe("budget_exhausted");
    expect(state.phase).toBe("audit_seal");
  });

  it("interrupts streamed decoding when completion allowance is exhausted", async () => {
    const state = createPipelineState({
      objective: "mid-stream budget stop",
      budgetPolicy: makePolicy(90),
    });
    const budget = createBudgetTracker();
    const backend = new MockLLMBackend([
      {
        pattern: /stream stop test/i,
        response:
          "token ".repeat(400),
        tokensUsed: 500,
      },
    ]);

    const response = await callLLMWithCircuitBreaker({
      backend,
      state,
      budget,
      messages: [
        { role: "user", content: "stream stop test" },
      ],
      stream: true,
    });

    expect(response.model).toBe("error");
    expect(state.completionStatus).toBe("budget_exhausted");
    expect(state.phase).toBe("audit_seal");
    expect(state.budget.tokensUsed).toBeGreaterThan(0);
  });

  it("enters fail_safe when streamed output exceeds safety ceiling", async () => {
    const state = createPipelineState({
      objective: "safety ceiling stop",
      budgetPolicy: makePolicy(500),
    });
    const budget = createBudgetTracker();
    const backend = new MockLLMBackend([
      {
        pattern: /safety test/i,
        response: "safe ".repeat(200),
        tokensUsed: 300,
      },
    ]);

    await callLLMWithCircuitBreaker({
      backend,
      state,
      budget,
      messages: [{ role: "user", content: "safety test" }],
      stream: true,
      safety: {
        maxDecodedChars: 60,
      },
    });

    expect(state.completionStatus).toBe("fail_safe");
    expect(state.phase).toBe("audit_seal");
  });

  it("enters fail_safe when blocked stream pattern appears", async () => {
    const state = createPipelineState({
      objective: "pattern stop",
      budgetPolicy: makePolicy(500),
    });
    const budget = createBudgetTracker();
    const backend = new MockLLMBackend([
      {
        pattern: /pattern test/i,
        response: "normal output ... -----BEGIN PRIVATE KEY----- ... trailing",
        tokensUsed: 200,
      },
    ]);

    await callLLMWithCircuitBreaker({
      backend,
      state,
      budget,
      messages: [{ role: "user", content: "pattern test" }],
      stream: true,
      safety: {
        maxDecodedChars: 5000,
        blockedPatterns: [/-----BEGIN PRIVATE KEY-----/],
      },
    });

    expect(state.completionStatus).toBe("fail_safe");
    expect(state.phase).toBe("audit_seal");
  });
});
