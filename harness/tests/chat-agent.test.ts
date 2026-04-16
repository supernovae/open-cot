import { describe, it, expect, beforeEach } from "vitest";
import { runChatAgent } from "../src/agents/chat-agent.js";
import { MockLLMBackend } from "../src/backends/mock.js";
import { createMockToolRegistry } from "../src/tools/mock-tools.js";
import { resetStepCounter } from "../src/core/trace-emitter.js";
import {
  validateActionObservationPairing,
  validateTermination,
} from "../src/core/validator.js";

describe("ChatAgent (mock backend)", () => {
  beforeEach(() => {
    resetStepCounter();
  });

  it("completes a simple question with a valid trace", async () => {
    const result = await runChatAgent("What is 2 + 2? Calculate it.", {
      backend: new MockLLMBackend(),
      tools: createMockToolRegistry(),
    });

    expect(result.answer).toBeTruthy();
    expect(result.trace.version).toBe("0.1");
    expect(result.trace.final_answer).toBeTruthy();
    expect(result.trace.steps.length).toBeGreaterThan(0);
  });

  it("emits valid termination status", async () => {
    const result = await runChatAgent("Plan how to organize a project.", {
      backend: new MockLLMBackend(),
      tools: createMockToolRegistry(),
    });

    const termResult = validateTermination(result.trace);
    expect(termResult.valid).toBe(true);
  });

  it("pairs all actions with observations", async () => {
    const result = await runChatAgent("Search for the capital of France.", {
      backend: new MockLLMBackend(),
      tools: createMockToolRegistry(),
    });

    const pairingResult = validateActionObservationPairing(result.trace);
    expect(pairingResult.valid).toBe(true);
  });

  it("tracks budget usage", async () => {
    const result = await runChatAgent("Tell me about Tokyo.", {
      backend: new MockLLMBackend(),
      tools: createMockToolRegistry(),
    });

    expect(result.state.budget.tokensUsed).toBeGreaterThan(0);
    expect(result.state.budget.stepsUsed).toBeGreaterThan(0);
  });

  it("stops on budget exhaustion", async () => {
    const result = await runChatAgent("Plan a complex analysis.", {
      backend: new MockLLMBackend(),
      tools: createMockToolRegistry(),
      budgetPolicy: {
        maxTokens: 10,
        maxCost: 10,
        maxSteps: 50,
        maxToolCalls: 20,
        maxRetries: 5,
        enforcement: "hard",
      },
    });

    expect(result.state.completionStatus).toBe("budget_exhausted");
    expect(result.trace.termination).toBe("budget_exhausted");
  });

  it("trace steps have unique IDs", async () => {
    const result = await runChatAgent("Search for the speed of light.", {
      backend: new MockLLMBackend(),
      tools: createMockToolRegistry(),
    });

    const ids = result.trace.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
