/**
 * Loop policy engine — configurable guardrails for cognitive pipeline behavior.
 *
 * Policies are checked before each transition. Violations produce critique
 * steps in the trace rather than throwing, unless the violation is fatal.
 */

import type { PipelineState } from "./state.js";
import type { Phase } from "../schemas/cognitive-pipeline.js";

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
  state: PipelineState,
  proposed: Phase,
  policy: LoopPolicy,
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  if (
    proposed === "finalize" &&
    policy.requireEvidenceBeforeDone &&
    state.evidenceCollected.length === 0
  ) {
    violations.push({
      rule: "requireEvidenceBeforeDone",
      message:
        "Cannot finalize without collecting at least one piece of evidence",
      severity: "error",
    });
  }

  if (
    proposed === "finalize" &&
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
    state.phase === "execute_tool" &&
    proposed !== "observe_result" &&
    proposed !== "fail_safe"
  ) {
    violations.push({
      rule: "verifyAfterChange",
      message: "Policy requires observe_result after execute_tool",
      severity: "warning",
    });
  }

  if (
    policy.summarizeOnThreshold !== null &&
    state.trace.steps.length >= policy.summarizeOnThreshold &&
    proposed !== "finalize" &&
    proposed !== "audit_seal" &&
    state.phase !== "finalize"
  ) {
    violations.push({
      rule: "summarizeOnThreshold",
      message: `Step count (${state.trace.steps.length}) exceeds threshold (${policy.summarizeOnThreshold}) — consider finalizing`,
      severity: "warning",
    });
  }

  return violations;
}

function hasVerifyStep(state: PipelineState): boolean {
  return state.trace.steps.some(
    (s) => s.type === "verify" || s.type === "critique",
  );
}
