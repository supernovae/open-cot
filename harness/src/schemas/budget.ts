/**
 * Budget types — RFC 0038 (Cost-Aware Reasoning Budget).
 *
 * Defines budget policies and runtime snapshots for token, cost, tool-call,
 * step, and retry budgets.
 */

export type EnforcementMode = "hard" | "soft" | "warn";

export interface BudgetPolicy {
  maxTokens: number;
  maxCost: number;
  maxSteps: number;
  maxToolCalls: number;
  maxRetries: number;
  enforcement: EnforcementMode;
}

export interface BudgetSnapshot {
  tokensUsed: number;
  tokensRemaining: number;
  costUsed: number;
  costRemaining: number;
  stepsUsed: number;
  stepsRemaining: number;
  toolCallsUsed: number;
  toolCallsRemaining: number;
  retriesUsed: number;
  retriesRemaining: number;
}

export interface BudgetChangeEvent {
  field: keyof BudgetSnapshot;
  previousValue: number;
  newValue: number;
  reason: string;
  timestamp: string;
}

export function createInitialSnapshot(policy: BudgetPolicy): BudgetSnapshot {
  return {
    tokensUsed: 0,
    tokensRemaining: policy.maxTokens,
    costUsed: 0,
    costRemaining: policy.maxCost,
    stepsUsed: 0,
    stepsRemaining: policy.maxSteps,
    toolCallsUsed: 0,
    toolCallsRemaining: policy.maxToolCalls,
    retriesUsed: 0,
    retriesRemaining: policy.maxRetries,
  };
}

export const DEFAULT_BUDGET_POLICY: BudgetPolicy = {
  maxTokens: 100_000,
  maxCost: 10.0,
  maxSteps: 50,
  maxToolCalls: 20,
  maxRetries: 5,
  enforcement: "hard",
};
