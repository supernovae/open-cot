# Open CoT Reference Harness

A TypeScript reference implementation that **proves the Open CoT standard is executable, testable, and operational**. The harness emits, consumes, and validates RFC-compliant reasoning traces — making the schema feel like a contract, not just documentation.

## Bidirectional verification

The harness and the schema verify each other:

| Direction | What it proves |
|-----------|----------------|
| **Schema verifies harness** | Forces valid event structure, consistent state transitions, budget accounting, tool result shape, completion criteria, and replayability |
| **Harness verifies schema** | Proves the schema is sufficient, ergonomic, debuggable, and works under real agent loops |

This feedback loop catches schema gaps early — if the harness can't express a real-world pattern, the schema needs updating.

## Architecture

```
src/
  schemas/        TypeScript types mirroring the JSON Schemas (RFC 0001, 0003, 0007, 0017, 0031, 0038)
  core/
    state.ts        Agent state: objective, phase, budgets, evidence, trace
    transitions.ts  FSM engine: plan -> inspect -> act -> verify -> repair -> summarize -> stop
    budget-tracker   Token, cost, step, tool-call, retry budgets with exhaustion handling
    trace-emitter    Structured step emission for every transition and action
    tool-registry    Tool contracts with timeout, idempotence, sandbox enforcement
    loop-policy      Configurable guardrails (max retries, verify-after-change, etc.)
    validator        Runtime trace validation against repo JSON Schemas using Ajv
  backends/
    mock.ts         Deterministic responses for CI (zero external deps)
    openai-compat   Any OpenAI-compatible API: OpenAI, Ollama, vLLM, LiteLLM
  tools/
    mock-tools.ts   search, calculator, readFile, writeFile, runTests
  agents/
    chat-agent.ts   LangGraph-style conversational agent (plan -> act -> verify)
    coder-agent.ts  Plan-do-act coder (plan -> inspect -> act -> verify -> repair -> summarize)
```

## Quick start

### Run tests (mock backend, zero external deps)

```bash
cd harness
npm install
npm test
```

### Run the chat agent demo

```bash
npx tsx examples/chat-demo.ts
```

### Run the coder agent demo

```bash
npx tsx examples/coder-demo.ts
```

### Use a real LLM (Ollama example)

```bash
# Start Ollama with a model
ollama serve &
ollama pull qwen2.5:1.5b

# Point the harness at Ollama
OPENAI_BASE_URL=http://localhost:11434/v1 npx tsx examples/chat-demo.ts "What is the capital of France?"
```

### Use OpenAI

```bash
OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-4o-mini npx tsx examples/chat-demo.ts "Explain recursion"
```

## FSM transition map

Every agent follows this finite state machine. Every transition emits a trace event.

```
plan ──┬──> inspect ──┬──> act ──> verify ──┬──> summarize ──> plan (loop)
       │              │                     │
       └──> act       └──> plan             ├──> repair ──> act (retry)
       │                                    │
       └──> stop      (any) ──> stop        └──> stop
```

Valid transitions:

| From | To |
|------|----|
| plan | inspect, act, stop |
| inspect | plan, act, stop |
| act | verify, stop |
| verify | act, repair, summarize, stop |
| repair | act, verify, stop |
| summarize | plan, stop |
| stop | (terminal) |

## Budget enforcement

The budget tracker (RFC 0038) enforces:

- **Token budget** — total input + output tokens across all LLM calls
- **Cost budget** — dollar cost accumulator
- **Step budget** — maximum loop iterations
- **Tool-call budget** — maximum tool invocations
- **Retry budget** — maximum repair attempts

When any hard-enforced budget hits zero, the agent is force-stopped with `budget_exhausted` status and the trace records why.

### Streaming decode circuit breaker

The harness now enforces token/safety limits during streamed decoding (not only after full responses):

- **Preflight budget gate**: estimate prompt token cost before each model call; if insufficient remaining budget, stop before decode starts.
- **Mid-stream token breaker**: stream callbacks track emitted completion tokens and abort decode once the remaining completion allowance is exhausted.
- **Mid-stream safety breaker**: stream callbacks can stop runaway or unsafe output patterns and route to `fail_safe`.
- **FSM-first shutdown**: on breaker trip, the run is forced into terminal state (`budget_exhausted`, `fail_safe`, or `external_stop`) before any subsequent tool side effects.

This keeps authority in the harness FSM even when a model ignores budget instructions.

## Tool contracts

Every tool is registered with a contract (RFC 0003 + RFC 0018):

```typescript
{
  name: "search",
  description: "Search a knowledge base",
  inputSchema: { type: "object", properties: { query: { type: "string" } } },
  expectedSideEffects: [],
  timeoutMs: 10000,
  idempotent: true,
  retryable: true,
  failureTypes: ["not_found", "timeout"]
}
```

Sandbox policy (RFC 0017) controls which tools are allowed/blocked at runtime.

## Adding new tools

```typescript
import { ToolRegistry, defineToolContract } from "@open-cot/harness";

const registry = new ToolRegistry();
registry.register(
  defineToolContract({
    name: "myTool",
    description: "Does something useful",
    inputSchema: { type: "object", properties: { input: { type: "string" } } },
  }),
  async (args) => {
    return { output: { result: `processed: ${args.input}` } };
  },
);
```

## Adding new agents

Create a new file in `src/agents/` that:

1. Creates state with `createAgentState()`
2. Uses `transition()` to move through FSM phases
3. Uses `emitPlan/emitAction/emitObservation/emitVerify/emitSummary` to build the trace
4. Uses `createBudgetTracker()` to track resource usage
5. Calls `finalizeTrace()` at the end

The FSM engine prevents invalid transitions and the validator confirms the output trace is schema-compliant.

## Cross-language validation

Traces emitted by the TypeScript harness can be validated by the Python tooling:

```bash
# Save a trace from the harness
npx tsx examples/chat-demo.ts > trace.json

# Validate with the Python validator
python tools/validate.py --trace trace.json
```

This proves the schema contract works across implementations.

## What the harness demonstrates

- Standard-compliant trace emission (RFC 0001 + RFC 0007)
- Tool call / observation pairing (RFC 0003)
- Budget tracking and exhaustion (RFC 0038)
- Sandbox policy enforcement (RFC 0017)
- Telemetry metrics (RFC 0031)
- FSM transition validation
- Loop policy guardrails
- Bidirectional schema verification
