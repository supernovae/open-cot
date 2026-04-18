import { describe, it, expect } from "vitest";
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

  it("audit_seal has no valid transitions", () => {
    expect(VALID_TRANSITIONS.audit_seal).toEqual([]);
  });

  it("canTransition returns true for valid transitions", () => {
    expect(canTransition("receive", "frame")).toBe(true);
    expect(canTransition("frame", "plan")).toBe(true);
    expect(canTransition("plan", "execute_tool")).toBe(true);
    expect(canTransition("plan", "finalize")).toBe(true);
    expect(canTransition("execute_tool", "observe_result")).toBe(true);
    expect(canTransition("finalize", "audit_seal")).toBe(true);
  });

  it("canTransition returns false for invalid transitions", () => {
    expect(canTransition("plan", "observe_result")).toBe(false);
    expect(canTransition("receive", "plan")).toBe(false);
    expect(canTransition("execute_tool", "finalize")).toBe(false);
  });

  it("assertTransition throws for invalid transitions", () => {
    expect(() => assertTransition("plan", "observe_result")).toThrow(
      InvalidTransitionError,
    );
  });

  it("assertTransition throws for terminal state", () => {
    expect(() => assertTransition("audit_seal", "plan")).toThrow(
      TerminalStateError,
    );
  });

  describe("transition()", () => {
    it("moves state to the target phase", () => {
      const state = createAgentState({ objective: "test" });
      expect(state.phase).toBe("receive");
      transition(state, "frame", "start");
      transition(state, "plan", "ready");
      transition(state, "finalize", "no tools");
      expect(state.phase).toBe("finalize");
    });

    it("appends a trace step", () => {
      const state = createAgentState({ objective: "test" });
      const before = state.trace.steps.length;
      transition(state, "frame", "starting work");
      expect(state.trace.steps.length).toBe(before + 1);
      expect(state.trace.steps.at(-1)!.content).toContain("receive -> frame");
    });

    it("updates nextAllowedPhases", () => {
      const state = createAgentState({ objective: "test" });
      transition(state, "frame", "go");
      expect(state.nextAllowedPhases).toEqual(expect.arrayContaining(["plan"]));
    });

    it("sets completionStatus to succeeded when sealing normally", () => {
      const state = createAgentState({ objective: "test" });
      transition(state, "frame", "go");
      transition(state, "plan", "go");
      transition(state, "finalize", "wrap");
      transition(state, "audit_seal", "done");
      expect(state.completionStatus).toBe("succeeded");
      expect(state.phase).toBe("audit_seal");
    });
  });

  describe("forceStop()", () => {
    it("forces state to audit_seal with the given status", () => {
      const state = createAgentState({ objective: "test" });
      forceStop(state, "budget_exhausted", "tokens ran out");
      expect(state.phase).toBe("audit_seal");
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
    it("supports receive -> frame -> plan -> finalize -> audit_seal", () => {
      const state = createAgentState({ objective: "full path" });
      transition(state, "frame", "gather context");
      transition(state, "plan", "decide");
      transition(state, "finalize", "wrap up");
      transition(state, "audit_seal", "done");
      expect(state.phase).toBe("audit_seal");
      expect(state.completionStatus).toBe("succeeded");
    });

    it("supports critique_verify -> plan -> execute_tool -> observe_result loop", () => {
      const state = createAgentState({ objective: "repair loop" });
      transition(state, "frame", "f");
      transition(state, "plan", "p");
      transition(state, "execute_tool", "run");
      transition(state, "observe_result", "seen");
      transition(state, "critique_verify", "check");
      transition(state, "plan", "re-plan");
      transition(state, "finalize", "done");
      transition(state, "audit_seal", "seal");
      expect(state.completionStatus).toBe("succeeded");
    });
  });
});
