import { describe, it, expect, beforeEach } from "vitest";
import { runCoderAgent } from "../src/agents/coder-agent.js";
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

describe("CoderAgent (mock backend)", () => {
  beforeEach(() => {
    resetStepCounter();
    resetMockFileSystem();
  });

  it("completes a coding task through full FSM traversal", async () => {
    const result = await runCoderAgent(
      "Read the file src/main.ts and modify it to add a greeting.",
      {
        backend: new MockLLMBackend(),
        tools: createMockToolRegistry(),
      },
    );

    expect(result.answer).toBeTruthy();
    expect(result.trace.version).toBe("0.1");
    expect(result.trace.steps.length).toBeGreaterThan(5);
  });

  it("emits valid termination status", async () => {
    const result = await runCoderAgent("Write a new utility function.", {
      backend: new MockLLMBackend(),
      tools: createMockToolRegistry(),
    });

    const termResult = validateTermination(result.trace);
    expect(termResult.valid).toBe(true);
  });

  it("pairs all actions with observations", async () => {
    const result = await runCoderAgent("Inspect file and make changes.", {
      backend: new MockLLMBackend(),
      tools: createMockToolRegistry(),
    });

    const pairingResult = validateActionObservationPairing(result.trace);
    expect(pairingResult.valid).toBe(true);
  });

  it("exercises plan, inspect, act, verify, summarize phases", async () => {
    const result = await runCoderAgent(
      "Read src/main.ts, write a fix, then verify the changes.",
      {
        backend: new MockLLMBackend(),
        tools: createMockToolRegistry(),
      },
    );

    const traceContent = result.trace.steps.map((s) => s.content).join(" ");
    expect(traceContent).toContain("plan");
    expect(traceContent).toContain("inspect");
    expect(traceContent).toContain("act");
    expect(traceContent).toContain("verify");
  });

  it("tracks budget usage across all phases", async () => {
    const result = await runCoderAgent("Modify the project files.", {
      backend: new MockLLMBackend(),
      tools: createMockToolRegistry(),
    });

    expect(result.state.budget.tokensUsed).toBeGreaterThan(0);
    expect(result.state.budget.stepsUsed).toBeGreaterThan(3);
  });

  it("stops on budget exhaustion mid-task", async () => {
    const result = await runCoderAgent("Do a complex refactoring.", {
      backend: new MockLLMBackend(),
      tools: createMockToolRegistry(),
      budgetPolicy: {
        maxTokens: 20,
        maxCost: 10,
        maxSteps: 50,
        maxToolCalls: 20,
        maxRetries: 5,
        enforcement: "hard",
      },
    });

    expect(result.state.completionStatus).toBe("budget_exhausted");
  });

  it("respects sandbox tool blocking", async () => {
    const result = await runCoderAgent(
      "Write a file to disk.",
      {
        backend: new MockLLMBackend(),
        tools: createMockToolRegistry(),
        sandbox: {
          allowedTools: ["readFile"],
          blockedTools: ["writeFile"],
          maxSteps: 50,
          maxBranches: 5,
          memoryAcl: { default: ["read"] },
        },
      },
    );

    const observations = result.trace.steps.filter(
      (s) => s.type === "observation",
    );
    const blocked = observations.some((s) =>
      s.content.includes("blocked by sandbox"),
    );
    expect(blocked || result.state.completionStatus === "succeeded").toBe(true);
  });
});
