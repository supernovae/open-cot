/**
 * Governed Execution FSM — RFC 0007 v0.3.
 *
 * Defines the 14-state finite state machine for permission-aware agent
 * execution. Replaces the original 7-phase simple loop with a governed
 * model where the model proposes and the harness decides.
 */

export const ALL_PHASES = [
  "receive",
  "frame",
  "plan",
  "request_authority",
  "validate_authority",
  "delegate_narrow",
  "execute_tool",
  "observe_result",
  "critique_verify",
  "finalize",
  "audit_seal",
  "deny",
  "escalate",
  "fail_safe",
] as const;

export type Phase = (typeof ALL_PHASES)[number];

export const VALID_TRANSITIONS: Record<Phase, readonly Phase[]> = {
  receive: ["frame"],
  frame: ["plan"],
  plan: ["request_authority", "execute_tool", "finalize"],
  request_authority: ["validate_authority"],
  validate_authority: ["delegate_narrow", "deny", "escalate"],
  delegate_narrow: ["execute_tool"],
  execute_tool: ["observe_result", "fail_safe"],
  observe_result: ["critique_verify", "fail_safe"],
  critique_verify: ["plan", "request_authority", "finalize"],
  finalize: ["audit_seal"],
  audit_seal: [],
  deny: ["audit_seal"],
  escalate: ["delegate_narrow", "deny", "audit_seal"],
  fail_safe: ["audit_seal"],
} as const;

export const TERMINAL_PHASES: readonly Phase[] = ["audit_seal"] as const;

export const TOOL_EXECUTION_PHASES: readonly Phase[] = [
  "execute_tool",
] as const;

export const POLICY_CONSULTATION_PHASES: readonly Phase[] = [
  "frame",
  "plan",
  "validate_authority",
  "observe_result",
  "critique_verify",
  "finalize",
] as const;
