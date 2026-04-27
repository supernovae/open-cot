import { describe, it, expect } from "vitest";
import { createPipelineState } from "../src/core/state.js";
import { createBudgetTracker } from "../src/core/budget-tracker.js";

describe("BudgetTracker", () => {
  it("records token usage", () => {
    const state = createPipelineState({ objective: "budget test" });
    const tracker = createBudgetTracker();
    tracker.recordTokens(state, 100, "LLM call");
    expect(state.budget.tokensUsed).toBe(100);
    expect(state.budget.tokensRemaining).toBe(99_900);
  });

  it("records cost", () => {
    const state = createPipelineState({ objective: "cost test" });
    const tracker = createBudgetTracker();
    tracker.recordCost(state, 0.5, "API call");
    expect(state.budget.costUsed).toBeCloseTo(0.5);
    expect(state.budget.costRemaining).toBeCloseTo(9.5);
  });

  it("records steps", () => {
    const state = createPipelineState({ objective: "step test" });
    const tracker = createBudgetTracker();
    tracker.recordStep(state, "plan");
    tracker.recordStep(state, "act");
    expect(state.budget.stepsUsed).toBe(2);
    expect(state.budget.stepsRemaining).toBe(48);
  });

  it("records tool calls and updates telemetry", () => {
    const state = createPipelineState({ objective: "tool test" });
    const tracker = createBudgetTracker();
    tracker.recordToolCall(state, "search");
    expect(state.budget.toolCallsUsed).toBe(1);
    expect(state.telemetry.metrics.tool_calls).toBe(1);
  });

  it("records retries", () => {
    const state = createPipelineState({ objective: "retry test" });
    const tracker = createBudgetTracker();
    tracker.recordRetry(state, "failed verification");
    expect(state.budget.retriesUsed).toBe(1);
    expect(state.budget.retriesRemaining).toBe(4);
  });

  it("force-stops when step budget is exhausted with hard enforcement", () => {
    const state = createPipelineState({
      objective: "exhaust test",
      budgetPolicy: {
        maxTokens: 100_000,
        maxCost: 10,
        maxSteps: 3,
        maxToolCalls: 20,
        maxRetries: 5,
        enforcement: "hard",
      },
    });
    const tracker = createBudgetTracker();
    tracker.recordStep(state, "s1");
    tracker.recordStep(state, "s2");
    tracker.recordStep(state, "s3");
    expect(state.completionStatus).toBe("budget_exhausted");
    expect(state.phase).toBe("audit_seal");
  });

  it("does NOT force-stop with soft enforcement", () => {
    const state = createPipelineState({
      objective: "soft test",
      budgetPolicy: {
        maxTokens: 100_000,
        maxCost: 10,
        maxSteps: 2,
        maxToolCalls: 20,
        maxRetries: 5,
        enforcement: "soft",
      },
    });
    const tracker = createBudgetTracker();
    tracker.recordStep(state, "s1");
    tracker.recordStep(state, "s2");
    expect(state.completionStatus).toBe("running");
    expect(state.phase).toBe("receive");
  });

  it("keeps events log", () => {
    const state = createPipelineState({ objective: "events test" });
    const tracker = createBudgetTracker();
    tracker.recordTokens(state, 50, "call 1");
    tracker.recordTokens(state, 75, "call 2");
    const events = tracker.getEvents();
    expect(events.length).toBe(2);
    expect(events[0].reason).toBe("call 1");
    expect(events[1].reason).toBe("call 2");
  });

  it("isExhausted returns reason when budget is empty", () => {
    const state = createPipelineState({
      objective: "check test",
      budgetPolicy: {
        maxTokens: 100,
        maxCost: 10,
        maxSteps: 50,
        maxToolCalls: 20,
        maxRetries: 5,
        enforcement: "hard",
      },
    });
    const tracker = createBudgetTracker();
    expect(tracker.isExhausted(state.budget, state.budgetPolicy)).toBeNull();
    tracker.recordTokens(state, 100, "drain");
    expect(
      tracker.isExhausted(state.budget, state.budgetPolicy),
    ).toBe("Token budget exhausted");
  });
});
