/**
 * Finite state machine transition engine — RFC 0007 (Governed Execution FSM).
 *
 * Every phase transition is validated against the adjacency map and emits a
 * structured trace step so the full history is replayable.
 */

import type { Phase } from "../schemas/agent-loop.js";
import { VALID_TRANSITIONS, TERMINAL_PHASES } from "../schemas/agent-loop.js";
import type { CompletionStatus } from "../schemas/audit-envelope.js";
import type { AgentState } from "./state.js";

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: Phase,
    public readonly to: Phase,
    public readonly allowed: readonly Phase[],
  ) {
    super(
      `Invalid transition: ${from} -> ${to}. Allowed from ${from}: [${allowed.join(", ")}]`,
    );
    this.name = "InvalidTransitionError";
  }
}

export class TerminalStateError extends Error {
  constructor(public readonly phase: Phase) {
    super(
      `Agent is in terminal phase "${phase}" — no further transitions allowed`,
    );
    this.name = "TerminalStateError";
  }
}

export function canTransition(from: Phase, to: Phase): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: Phase, to: Phase): void {
  if (TERMINAL_PHASES.includes(from)) {
    throw new TerminalStateError(from);
  }
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to, VALID_TRANSITIONS[from]);
  }
}

/**
 * Transition the agent to a new phase. Mutates state in place and appends a
 * trace step documenting the transition.
 */
export function transition(
  state: AgentState,
  to: Phase,
  reason: string,
): void {
  assertTransition(state.phase, to);

  const stepId = `t-${state.trace.steps.length + 1}`;
  state.trace.steps.push({
    id: stepId,
    type: "thought",
    content: `[transition] ${state.phase} -> ${to}: ${reason}`,
  });

  state.phase = to;
  state.nextAllowedPhases = [...VALID_TRANSITIONS[to]];
  state.telemetry.metrics.steps++;

  if (to === "audit_seal") {
    if (state.completionStatus === "running") {
      state.completionStatus = "succeeded";
    }
    state.trace.termination = state.completionStatus;
  }
}

/**
 * Force-stop the agent with a given status. Used for budget exhaustion,
 * safety violations, and external stop signals.
 */
export function forceStop(
  state: AgentState,
  status: CompletionStatus,
  reason: string,
): void {
  state.completionStatus = status;
  if (state.phase !== "audit_seal") {
    const stepId = `t-${state.trace.steps.length + 1}`;
    state.trace.steps.push({
      id: stepId,
      type: "thought",
      content: `[force-stop] ${state.phase} -> fail_safe -> audit_seal: ${reason}`,
    });
    state.phase = "audit_seal";
    state.nextAllowedPhases = [];
    state.trace.termination = status;
  }
}
