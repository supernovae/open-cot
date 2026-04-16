/**
 * Budget tracker — RFC 0038 (Cost-Aware Reasoning Budget).
 *
 * Maintains running totals for token, cost, step, tool-call, and retry budgets.
 * When any hard-enforced budget is exhausted the tracker signals that the agent
 * must stop.
 */

import type {
  BudgetPolicy,
  BudgetSnapshot,
  BudgetChangeEvent,
} from "../schemas/budget.js";
import type { AgentState } from "./state.js";
import { forceStop } from "./transitions.js";

export interface BudgetTracker {
  recordTokens(state: AgentState, count: number, reason: string): void;
  recordCost(state: AgentState, amount: number, reason: string): void;
  recordStep(state: AgentState, reason: string): void;
  recordToolCall(state: AgentState, reason: string): void;
  recordRetry(state: AgentState, reason: string): void;
  isExhausted(snapshot: BudgetSnapshot, policy: BudgetPolicy): string | null;
  getEvents(): readonly BudgetChangeEvent[];
}

export function createBudgetTracker(): BudgetTracker {
  const events: BudgetChangeEvent[] = [];

  function emit(
    field: keyof BudgetSnapshot,
    prev: number,
    next: number,
    reason: string,
  ): void {
    events.push({
      field,
      previousValue: prev,
      newValue: next,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  function checkExhaustion(state: AgentState): void {
    const reason = isExhausted(state.budget, state.budgetPolicy);
    if (reason && state.budgetPolicy.enforcement === "hard") {
      forceStop(state, "budget_exhausted", reason);
    }
  }

  function isExhausted(
    snap: BudgetSnapshot,
    policy: BudgetPolicy,
  ): string | null {
    if (snap.tokensRemaining <= 0 && policy.maxTokens > 0)
      return "Token budget exhausted";
    if (snap.costRemaining <= 0 && policy.maxCost > 0)
      return "Cost budget exhausted";
    if (snap.stepsRemaining <= 0 && policy.maxSteps > 0)
      return "Step budget exhausted";
    if (snap.toolCallsRemaining <= 0 && policy.maxToolCalls > 0)
      return "Tool-call budget exhausted";
    if (snap.retriesRemaining <= 0 && policy.maxRetries > 0)
      return "Retry budget exhausted";
    return null;
  }

  return {
    recordTokens(state, count, reason) {
      const prev = state.budget.tokensUsed;
      state.budget.tokensUsed += count;
      state.budget.tokensRemaining -= count;
      emit("tokensUsed", prev, state.budget.tokensUsed, reason);
      checkExhaustion(state);
    },

    recordCost(state, amount, reason) {
      const prev = state.budget.costUsed;
      state.budget.costUsed += amount;
      state.budget.costRemaining -= amount;
      emit("costUsed", prev, state.budget.costUsed, reason);
      checkExhaustion(state);
    },

    recordStep(state, reason) {
      const prev = state.budget.stepsUsed;
      state.budget.stepsUsed += 1;
      state.budget.stepsRemaining -= 1;
      emit("stepsUsed", prev, state.budget.stepsUsed, reason);
      checkExhaustion(state);
    },

    recordToolCall(state, reason) {
      const prev = state.budget.toolCallsUsed;
      state.budget.toolCallsUsed += 1;
      state.budget.toolCallsRemaining -= 1;
      emit("toolCallsUsed", prev, state.budget.toolCallsUsed, reason);
      state.telemetry.metrics.tool_calls++;
      checkExhaustion(state);
    },

    recordRetry(state, reason) {
      const prev = state.budget.retriesUsed;
      state.budget.retriesUsed += 1;
      state.budget.retriesRemaining -= 1;
      emit("retriesUsed", prev, state.budget.retriesUsed, reason);
      checkExhaustion(state);
    },

    isExhausted,
    getEvents: () => events,
  };
}
