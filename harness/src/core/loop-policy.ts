/**
 * Loop policy engine — configurable guardrails for agent loop behavior.
 *
 * Policies are checked before each transition. Violations produce critique
 * steps in the trace rather than throwing, unless the violation is fatal.
 */

import type { AgentState } from "./state.js";
import type { Phase } from "../schemas/agent-loop.js";

export interface LoopPolicy {
  maxRetries: number;
  noDuplicateProbes: boolean;
  requireEvidenceBeforeDone: boolean;
  requireTestsBeforeCompletion: boolean;
  summarizeOnThreshold: number | null;
  patchOnlyEdits: boolean;
  oneActionPerTurn: boolean;
  verifyAfterChange: boolean;
}

export const DEFAULT_LOOP_POLICY: LoopPolicy = {
  maxRetries: 3,
  noDuplicateProbes: true,
  requireEvidenceBeforeDone: true,
  requireTestsBeforeCompletion: false,
  summarizeOnThreshold: 30,
  patchOnlyEdits: false,
  oneActionPerTurn: true,
  verifyAfterChange: true,
};

export interface PolicyViolation {
  rule: string;
  message: string;
  severity: "warning" | "error";
}

/**
 * Check the policy against the current state for a proposed transition.
 * Returns an empty array if all checks pass.
 */
export function checkPolicy(
  state: AgentState,
  proposed: Phase,
  policy: LoopPolicy,
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  if (
    proposed === "stop" &&
    policy.requireEvidenceBeforeDone &&
    state.evidenceCollected.length === 0
  ) {
    violations.push({
      rule: "requireEvidenceBeforeDone",
      message: "Cannot stop without collecting at least one piece of evidence",
      severity: "error",
    });
  }

  if (
    proposed === "stop" &&
    policy.requireTestsBeforeCompletion &&
    !hasVerifyStep(state)
  ) {
    violations.push({
      rule: "requireTestsBeforeCompletion",
      message: "Cannot complete without at least one verify step",
      severity: "error",
    });
  }

  if (
    policy.verifyAfterChange &&
    state.phase === "act" &&
    proposed !== "verify" &&
    proposed !== "stop"
  ) {
    violations.push({
      rule: "verifyAfterChange",
      message: "Policy requires verify phase after act",
      severity: "warning",
    });
  }

  if (
    policy.summarizeOnThreshold !== null &&
    state.trace.steps.length >= policy.summarizeOnThreshold &&
    proposed !== "summarize" &&
    proposed !== "stop" &&
    state.phase !== "summarize"
  ) {
    violations.push({
      rule: "summarizeOnThreshold",
      message: `Step count (${state.trace.steps.length}) exceeds threshold (${policy.summarizeOnThreshold}) — consider summarizing`,
      severity: "warning",
    });
  }

  if (
    policy.noDuplicateProbes &&
    proposed === "inspect" &&
    hasDuplicateInspect(state)
  ) {
    violations.push({
      rule: "noDuplicateProbes",
      message: "Duplicate inspect detected — same subtask was already inspected",
      severity: "warning",
    });
  }

  return violations;
}

function hasVerifyStep(state: AgentState): boolean {
  return state.trace.steps.some((s) => s.type === "verify");
}

function hasDuplicateInspect(state: AgentState): boolean {
  const inspects = state.trace.steps.filter(
    (s) => s.type === "thought" && s.content.includes("[transition]") && s.content.includes("inspect"),
  );
  return inspects.length > 1;
}
