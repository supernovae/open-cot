import { describe, it, expect } from "vitest";
import {
  validateTrace,
  validateActionObservationPairing,
  validateTermination,
  validateFull,
} from "../src/core/validator.js";
import type { Trace } from "../src/schemas/trace.js";

function makeValidTrace(): Trace {
  return {
    version: "0.1",
    task: "test task",
    steps: [
      { id: "s1", type: "thought", content: "thinking..." },
      {
        id: "s2",
        type: "action",
        content: "call:search",
        tool_invocation: {
          tool_name: "search",
          arguments: { query: "test" },
          triggered_by_step: "s1",
        },
      },
      {
        id: "s3",
        type: "observation",
        content: '{"result": "found"}',
        parent: "s2",
      },
    ],
    final_answer: "The answer is 42",
    termination: "succeeded",
  };
}

describe("validateTrace (JSON Schema)", () => {
  it("accepts a valid trace", async () => {
    const result = await validateTrace(makeValidTrace());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a trace missing required fields", async () => {
    const bad = { version: "0.1" } as unknown as Trace;
    const result = await validateTrace(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("validateActionObservationPairing", () => {
  it("passes when all actions have matching observations", () => {
    const result = validateActionObservationPairing(makeValidTrace());
    expect(result.valid).toBe(true);
  });

  it("fails when an action has no matching observation", () => {
    const trace = makeValidTrace();
    trace.steps = trace.steps.filter((s) => s.type !== "observation");
    const result = validateActionObservationPairing(trace);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("no matching observation");
  });
});

describe("validateTermination", () => {
  it("passes with a valid termination status", () => {
    const result = validateTermination(makeValidTrace());
    expect(result.valid).toBe(true);
  });

  it("fails when termination is missing", () => {
    const trace = makeValidTrace();
    delete trace.termination;
    const result = validateTermination(trace);
    expect(result.valid).toBe(false);
  });

  it("fails when termination is 'running'", () => {
    const trace = makeValidTrace();
    trace.termination = "running";
    const result = validateTermination(trace);
    expect(result.valid).toBe(false);
  });
});

describe("validateFull", () => {
  it("passes for a complete valid trace", async () => {
    const result = await validateFull(makeValidTrace());
    expect(result.valid).toBe(true);
  });

  it("collects all errors from sub-validators", async () => {
    const trace = makeValidTrace();
    trace.steps = trace.steps.filter((s) => s.type !== "observation");
    delete trace.termination;
    const result = await validateFull(trace);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
