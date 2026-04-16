import { describe, it, expect, beforeEach } from "vitest";
import { VALID_TRANSITIONS, ALL_PHASES } from "../src/schemas/agent-loop.js";
import {
  canTransition,
  assertTransition,
  transition,
  forceStop,
  InvalidTransitionError,
  TerminalStateError,
  createAgentState,
} from "../src/core/index.js";

describe("FSM transitions", () => {
  it("defines transitions for every phase", () => {
    for (const phase of ALL_PHASES) {
      expect(VALID_TRANSITIONS[phase]).toBeDefined();
      expect(Array.isArray(VALID_TRANSITIONS[phase])).toBe(true);
    }
  });

  it("stop has no valid transitions", () => {
    expect(VALID_TRANSITIONS.stop).toEqual([]);
  });

  it("canTransition returns true for valid transitions", () => {
    expect(canTransition("plan", "act")).toBe(true);
    expect(canTransition("plan", "inspect")).toBe(true);
    expect(canTransition("plan", "stop")).toBe(true);
    expect(canTransition("act", "verify")).toBe(true);
  });

  it("canTransition returns false for invalid transitions", () => {
    expect(canTransition("plan", "repair")).toBe(false);
    expect(canTransition("plan", "verify")).toBe(false);
    expect(canTransition("act", "plan")).toBe(false);
    expect(canTransition("act", "summarize")).toBe(false);
  });

  it("assertTransition throws for invalid transitions", () => {
    expect(() => assertTransition("plan", "repair")).toThrow(
      InvalidTransitionError,
    );
  });

  it("assertTransition throws for terminal state", () => {
    expect(() => assertTransition("stop", "plan")).toThrow(
      TerminalStateError,
    );
  });

  describe("transition()", () => {
    it("moves state to the target phase", () => {
      const state = createAgentState({ objective: "test" });
      expect(state.phase).toBe("plan");
      transition(state, "act", "starting work");
      expect(state.phase).toBe("act");
    });

    it("appends a trace step", () => {
      const state = createAgentState({ objective: "test" });
      const before = state.trace.steps.length;
      transition(state, "act", "starting work");
      expect(state.trace.steps.length).toBe(before + 1);
      expect(state.trace.steps.at(-1)!.content).toContain("plan -> act");
    });

    it("updates nextAllowedPhases", () => {
      const state = createAgentState({ objective: "test" });
      transition(state, "act", "go");
      expect(state.nextAllowedPhases).toEqual(
        expect.arrayContaining(["verify", "stop"]),
      );
    });

    it("sets completionStatus to succeeded when stopping normally", () => {
      const state = createAgentState({ objective: "test" });
      transition(state, "act", "go");
      transition(state, "stop", "done");
      expect(state.completionStatus).toBe("succeeded");
    });
  });

  describe("forceStop()", () => {
    it("forces state to stop with the given status", () => {
      const state = createAgentState({ objective: "test" });
      forceStop(state, "budget_exhausted", "tokens ran out");
      expect(state.phase).toBe("stop");
      expect(state.completionStatus).toBe("budget_exhausted");
      expect(state.trace.termination).toBe("budget_exhausted");
    });

    it("is idempotent on already-stopped state", () => {
      const state = createAgentState({ objective: "test" });
      forceStop(state, "external_stop", "user abort");
      const stepCount = state.trace.steps.length;
      forceStop(state, "failed", "double stop");
      expect(state.trace.steps.length).toBe(stepCount);
      expect(state.completionStatus).toBe("failed");
    });
  });

  describe("full FSM path", () => {
    it("supports plan -> inspect -> act -> verify -> summarize -> stop", () => {
      const state = createAgentState({ objective: "full path" });
      transition(state, "inspect", "gather context");
      transition(state, "act", "make changes");
      transition(state, "verify", "run tests");
      transition(state, "summarize", "wrap up");
      transition(state, "stop", "done");
      expect(state.phase).toBe("stop");
      expect(state.completionStatus).toBe("succeeded");
    });

    it("supports verify -> repair -> act -> verify loop", () => {
      const state = createAgentState({ objective: "repair loop" });
      transition(state, "act", "initial");
      transition(state, "verify", "first check");
      transition(state, "repair", "fix bug");
      transition(state, "act", "re-apply");
      transition(state, "verify", "re-check");
      transition(state, "stop", "all good");
      expect(state.completionStatus).toBe("succeeded");
    });
  });
});
