/**
 * Trace emitter — structured event logging for every agent action.
 *
 * Every transition, budget change, tool call, and completion decision appends
 * a Step to the running trace. The emitter guarantees monotonically increasing
 * step IDs and consistent parent linkage.
 */

import type { Step, StepType, Trace, ToolInvocation } from "../schemas/trace.js";
import type { AgentState } from "./state.js";

let _counter = 0;

function nextStepId(prefix: string): string {
  _counter++;
  return `${prefix}-${_counter}`;
}

export function resetStepCounter(): void {
  _counter = 0;
}

export function emitThought(
  state: AgentState,
  content: string,
  parent?: string,
): Step {
  const step = makeStep("thought", content, parent);
  state.trace.steps.push(step);
  return step;
}

export function emitPlan(
  state: AgentState,
  content: string,
  parent?: string,
): Step {
  const step = makeStep("plan", content, parent);
  state.trace.steps.push(step);
  state.planVersion++;
  return step;
}

export function emitAction(
  state: AgentState,
  content: string,
  toolInvocation: ToolInvocation,
  parent?: string,
): Step {
  const step: Step = {
    ...makeStep("action", content, parent),
    tool_invocation: toolInvocation,
  };
  state.trace.steps.push(step);
  state.lastAction = step.id;
  return step;
}

export function emitObservation(
  state: AgentState,
  content: string,
  parentActionId: string,
): Step {
  const step = makeStep("observation", content, parentActionId);
  state.trace.steps.push(step);
  state.evidenceCollected.push(step.id);
  return step;
}

export function emitCritique(
  state: AgentState,
  content: string,
  parent?: string,
): Step {
  const step = makeStep("critique", content, parent);
  state.trace.steps.push(step);
  return step;
}

export function emitVerify(
  state: AgentState,
  content: string,
  verificationStatus: "verified" | "failed" | "unknown",
  parent?: string,
): Step {
  const step: Step = {
    ...makeStep("verify", content, parent),
    verification_status: verificationStatus,
  };
  state.trace.steps.push(step);
  return step;
}

export function emitSummary(
  state: AgentState,
  content: string,
  parent?: string,
): Step {
  const step = makeStep("summarize", content, parent);
  state.trace.steps.push(step);
  return step;
}

export function finalizeTrace(state: AgentState, answer: string): Trace {
  state.trace.final_answer = answer;
  state.trace.termination = state.completionStatus;
  const startedAt = Date.parse(state.telemetry.observed_at);
  const endedAt = Date.now();
  state.telemetry.metrics.latency_ms = Number.isFinite(startedAt)
    ? Math.max(0, endedAt - startedAt)
    : endedAt;
  return state.trace;
}

function makeStep(type: StepType, content: string, parent?: string): Step {
  const step: Step = {
    id: nextStepId(`s`),
    type,
    content,
  };
  if (parent) {
    step.parent = parent;
  }
  return step;
}
