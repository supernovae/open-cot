#!/usr/bin/env npx tsx
/**
 * Coder agent demo — run with `npx tsx examples/coder-demo.ts`
 *
 * Demonstrates the full plan-do-act FSM: plan -> inspect -> act -> verify ->
 * (repair loop) -> summarize -> stop.
 *
 * By default uses the mock backend (zero external deps).
 * Set OPENAI_BASE_URL and OPENAI_API_KEY to use a real LLM.
 *
 * Examples:
 *   npx tsx examples/coder-demo.ts                     # mock backend
 *   OPENAI_BASE_URL=http://localhost:11434/v1 \
 *     npx tsx examples/coder-demo.ts                   # Ollama
 */

import { runCoderAgent } from "../src/agents/coder-agent.js";
import { MockLLMBackend } from "../src/backends/mock.js";
import { OpenAICompatBackend } from "../src/backends/openai-compat.js";
import { createMockToolRegistry } from "../src/tools/mock-tools.js";
import { validateFull } from "../src/core/validator.js";
import type { LLMBackend } from "../src/backends/types.js";

function pickBackend(): LLMBackend {
  if (process.env["OPENAI_BASE_URL"] || process.env["OPENAI_API_KEY"]) {
    console.log("Using OpenAI-compatible backend");
    return new OpenAICompatBackend();
  }
  console.log("Using mock backend (set OPENAI_BASE_URL for real LLM)");
  return new MockLLMBackend();
}

async function main() {
  const task =
    process.argv[2] ??
    "Read the file src/main.ts, add error handling, write the changes, and verify with tests.";

  console.log(`\n--- Coder Agent Demo ---`);
  console.log(`Task: ${task}\n`);

  const result = await runCoderAgent(task, {
    backend: pickBackend(),
    tools: createMockToolRegistry(),
  });

  console.log(`Answer: ${result.answer}`);
  console.log(`\nCompletion: ${result.state.completionStatus}`);
  console.log(`Phase history (via trace steps):`);

  const phases = result.trace.steps
    .filter((s) => s.content.startsWith("[transition]"))
    .map((s) => s.content.replace("[transition] ", ""));
  for (const p of phases) {
    console.log(`  ${p}`);
  }

  console.log(`\nTotal steps: ${result.trace.steps.length}`);
  console.log(`Tokens used: ${result.state.budget.tokensUsed}`);
  console.log(`Tool calls: ${result.state.budget.toolCallsUsed}`);
  console.log(`Plan versions: ${result.state.planVersion}`);

  console.log(`\n--- Trace (JSON) ---`);
  console.log(JSON.stringify(result.trace, null, 2));

  console.log(`\n--- Validation ---`);
  const validation = await validateFull(result.trace);
  if (validation.valid) {
    console.log("Trace is VALID against Open CoT schemas.");
  } else {
    console.log("Trace VALIDATION FAILED:");
    for (const err of validation.errors) {
      console.log(`  - ${err}`);
    }
  }
}

main().catch(console.error);
