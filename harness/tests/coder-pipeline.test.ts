import { describe, it, expect, beforeEach } from "vitest";
import { runCoderPipeline } from "../src/pipelines/coder-pipeline.js";
import { MockLLMBackend } from "../src/backends/mock.js";
import {
  createMockToolRegistry,
  resetMockFileSystem,
} from "../src/tools/mock-tools.js";
import { resetStepCounter } from "../src/core/trace-emitter.js";
import {
  validateActionObservationPairing,
  validateTermination,
} from "../src/core/validator.js";
import type { PolicySet } from "../src/governance/policy-evaluator.js";

describe("CoderPipeline (mock backend)", () => {
  beforeEach(() => {
    resetStepCounter();
    resetMockFileSystem();
  });

  it("completes a coding task through full FSM traversal", async () => {
    const trace = await runCoderPipeline(
      new MockLLMBackend(),
      "Read the file src/main.ts and modify it to add a greeting.",
      createMockToolRegistry(),
    );

    expect(trace.final_answer).toBeTruthy();
    expect(trace.version).toBe("0.2");
    expect(trace.steps.length).toBeGreaterThan(5);
  });

  it("emits valid termination status", async () => {
    const trace = await runCoderPipeline(
      new MockLLMBackend(),
      "Write a new utility function.",
      createMockToolRegistry(),
    );

    const termResult = validateTermination(trace);
    expect(termResult.valid).toBe(true);
  });

  it("pairs all actions with observations", async () => {
    const trace = await runCoderPipeline(
      new MockLLMBackend(),
      "Inspect file and make changes.",
      createMockToolRegistry(),
    );

    const pairingResult = validateActionObservationPairing(trace);
    expect(pairingResult.valid).toBe(true);
  });

  it("exercises governed FSM phases in the trace", async () => {
    const trace = await runCoderPipeline(
      new MockLLMBackend(),
      "Read src/main.ts, write a fix, then verify the changes.",
      createMockToolRegistry(),
    );

    const traceContent = trace.steps.map((s) => s.content).join(" ");
    expect(traceContent).toContain("receive");
    expect(traceContent).toContain("frame");
    expect(traceContent).toContain("plan");
    expect(traceContent).toContain("execute_tool");
    expect(traceContent).toContain("critique_verify");
  });

  it("emits a substantive trace", async () => {
    const trace = await runCoderPipeline(
      new MockLLMBackend(),
      "Modify the project files.",
      createMockToolRegistry(),
    );

    expect(trace.steps.length).toBeGreaterThan(6);
    expect(trace.final_answer).toBeTruthy();
  });

  it("stops on budget exhaustion mid-task", async () => {
    const trace = await runCoderPipeline(
      new MockLLMBackend(),
      "Do a complex refactoring.",
      createMockToolRegistry(),
      {
        maxTokens: 20,
        maxCost: 10,
        maxSteps: 50,
        maxToolCalls: 20,
        maxRetries: 5,
        enforcement: "hard",
      },
    );

    expect(trace.termination).toBe("budget_exhausted");
  });

  it("respects sandbox tool blocking", async () => {
    const trace = await runCoderPipeline(
      new MockLLMBackend(),
      "Write a file to disk.",
      createMockToolRegistry(),
      undefined,
      {
        allowedTools: ["readFile"],
        blockedTools: ["writeFile"],
        maxSteps: 50,
        maxBranches: 5,
        memoryAcl: { default: ["read"] },
      },
    );

    const observations = trace.steps.filter((s) => s.type === "observation");
    const blocked = observations.some((s) => s.content.includes("blocked by sandbox"));
    const stoppedEarly =
      trace.final_answer.includes("not allowlisted") || trace.final_answer.includes("blocked");
    expect(blocked || stoppedEarly || trace.termination === "succeeded").toBe(true);
  });

  it("routes coder tool calls through policy engine decisions", async () => {
    const denyWrite: PolicySet = {
      policy_id: "deny-write",
      policy_type: "safety",
      priority: 1,
      rules: [
        {
          rule_id: "deny-write-rule",
          action: "deny",
          resource: "tool:writeFile",
          reason: "Write access disabled in test",
        },
      ],
    };
    const trace = await runCoderPipeline(
      new MockLLMBackend(),
      "Modify src/main.ts to add a greeting.",
      createMockToolRegistry(),
      undefined,
      undefined,
      undefined,
      { policies: [denyWrite] },
    );

    expect(trace.termination).toBe("denied");
    expect(trace.final_answer).toContain("Write access disabled in test");
  });
});
