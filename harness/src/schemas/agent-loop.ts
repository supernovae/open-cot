/**
 * Agent loop protocol types — RFC 0007.
 *
 * Defines the FSM phases, transition rules, and agent state envelope.
 */

export const ALL_PHASES = [
  "plan",
  "inspect",
  "act",
  "verify",
  "repair",
  "summarize",
  "stop",
] as const;

export type Phase = (typeof ALL_PHASES)[number];

export const VALID_TRANSITIONS: Record<Phase, readonly Phase[]> = {
  plan: ["inspect", "act", "stop"],
  inspect: ["plan", "act", "stop"],
  act: ["verify", "stop"],
  verify: ["act", "repair", "summarize", "stop"],
  repair: ["act", "verify", "stop"],
  summarize: ["plan", "stop"],
  stop: [],
} as const;

export const TERMINAL_PHASES: readonly Phase[] = ["stop"] as const;
