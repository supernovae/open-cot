#!/usr/bin/env npx tsx
/**
 * Chat agent demo — run with `npx tsx examples/chat-demo.ts`
 *
 * By default uses the mock backend (zero external deps).
 * Set OPENAI_BASE_URL and OPENAI_API_KEY to use a real LLM.
 *
 * Examples:
 *   npx tsx examples/chat-demo.ts                     # mock backend
 *   OPENAI_BASE_URL=http://localhost:11434/v1 \
 *     npx tsx examples/chat-demo.ts                   # Ollama
 */

import { runChatAgent } from "../src/agents/chat-agent.js";
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
  const question =
    process.argv[2] ?? "Search for the population of Tokyo and calculate its square root.";

  console.log(`\n--- Chat Agent Demo ---`);
  console.log(`Question: ${question}\n`);

  const backend = pickBackend();
  const trace = await runChatAgent(backend, question, createMockToolRegistry());

  console.log(`Answer: ${trace.final_answer}`);
  console.log(`\nCompletion: ${trace.termination ?? "unknown"}`);
  console.log(`Steps: ${trace.steps.length}`);

  console.log(`\n--- Trace (JSON) ---`);
  console.log(JSON.stringify(trace, null, 2));

  console.log(`\n--- Validation ---`);
  const validation = await validateFull(trace);
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
