import { describe, it, expect, beforeEach } from "vitest";
import { createAgentState } from "../src/core/state.js";
import {
  emitThought,
  emitPlan,
  emitAction,
  emitObservation,
  emitCritique,
  emitVerify,
  emitSummary,
  finalizeTrace,
  resetStepCounter,
} from "../src/core/trace-emitter.js";

describe("TraceEmitter", () => {
  beforeEach(() => {
    resetStepCounter();
  });

  it("emitThought appends a thought step", () => {
    const state = createAgentState({ objective: "test" });
    const step = emitThought(state, "thinking...");
    expect(step.type).toBe("thought");
    expect(step.content).toBe("thinking...");
    expect(state.trace.steps).toContain(step);
  });

  it("emitPlan increments planVersion", () => {
    const state = createAgentState({ objective: "test" });
    expect(state.planVersion).toBe(0);
    emitPlan(state, "plan v1");
    expect(state.planVersion).toBe(1);
    emitPlan(state, "plan v2");
    expect(state.planVersion).toBe(2);
  });

  it("emitAction records tool invocation and sets lastAction", () => {
    const state = createAgentState({ objective: "test" });
    const step = emitAction(state, "call:search", {
      tool_name: "search",
      arguments: { query: "test" },
      triggered_by_step: "s1",
    });
    expect(step.type).toBe("action");
    expect(step.tool_invocation!.tool_name).toBe("search");
    expect(state.lastAction).toBe(step.id);
  });

  it("emitObservation sets parent and adds to evidence", () => {
    const state = createAgentState({ objective: "test" });
    const action = emitAction(state, "call:search", {
      tool_name: "search",
      arguments: {},
      triggered_by_step: "s1",
    });
    const obs = emitObservation(state, "result data", action.id);
    expect(obs.parent).toBe(action.id);
    expect(state.evidenceCollected).toContain(obs.id);
  });

  it("emitCritique adds a critique step", () => {
    const state = createAgentState({ objective: "test" });
    const step = emitCritique(state, "something is wrong");
    expect(step.type).toBe("critique");
  });

  it("emitVerify sets verification_status", () => {
    const state = createAgentState({ objective: "test" });
    const step = emitVerify(state, "looks good", "verified");
    expect(step.verification_status).toBe("verified");
  });

  it("emitSummary adds a summarize step", () => {
    const state = createAgentState({ objective: "test" });
    const step = emitSummary(state, "done with everything");
    expect(step.type).toBe("summarize");
  });

  it("finalizeTrace sets final_answer and termination", () => {
    const state = createAgentState({ objective: "test" });
    state.completionStatus = "succeeded";
    const trace = finalizeTrace(state, "42");
    expect(trace.final_answer).toBe("42");
    expect(trace.termination).toBe("succeeded");
  });

  it("step IDs are unique and monotonically increasing", () => {
    const state = createAgentState({ objective: "test" });
    const s1 = emitThought(state, "a");
    const s2 = emitThought(state, "b");
    const s3 = emitThought(state, "c");
    expect(s1.id).not.toBe(s2.id);
    expect(s2.id).not.toBe(s3.id);
    const ids = new Set([s1.id, s2.id, s3.id]);
    expect(ids.size).toBe(3);
  });
});
