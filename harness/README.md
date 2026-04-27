# Open CoT Core Reference Package

A TypeScript reference implementation that **proves the Open CoT standard is executable, testable, and operational**. The core package emits, consumes, and validates RFC-compliant reasoning traces — making the schema feel like a contract, not just documentation.

## Bidirectional verification

The core package and the schema verify each other:

| Direction | What it proves |
|-----------|----------------|
| **Schema verifies package output** | Forces valid event structure, consistent state transitions, budget accounting, tool result shape, completion criteria, and replayability |
| **Package verifies schema** | Proves the schema is sufficient, ergonomic, debuggable, and works under real cognitive pipelines |

This feedback loop catches schema gaps early — if the core package can't express a real-world pattern, the schema needs updating.

## Architecture

```
src/
  schemas/        TypeScript types mirroring the JSON Schemas (RFC 0001, 0003, 0007, 0017, 0031, 0038)
  core/
    state.ts        Cognitive pipeline state: objective, phase, budgets, evidence, trace
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
  pipelines/
    chat-pipeline.ts   Conversational loop with policy-mediated authority checks
    coder-pipeline.ts  Coder loop with policy-mediated authority + repair
    governed-pipeline.ts Full RFC 0007 governed flow with receipts + audit sealing
```

## Quick start

### Run tests (mock backend, zero external deps)

```bash
cd harness
npm install
npm test
```

### Run the chat cognitive pipeline demo

```bash
npx tsx examples/chat-pipeline-demo.ts
```

### Run the coder cognitive pipeline demo

```bash
npx tsx examples/coder-pipeline-demo.ts
```

### Run the governed cognitive pipeline demo

```bash
npx tsx examples/governed-pipeline-demo.ts
```

Policy modes:

```bash
npx tsx examples/governed-pipeline-demo.ts --deny "search for info"
npx tsx examples/governed-pipeline-demo.ts --narrow "search for info"
```

### Choose a policy engine for governed demo

Use `POLICY_ENGINE`:

- `inprocess` (default): uses the built-in evaluator
- `opa`: sends delegation requests to OPA and maps decisions into Open CoT objects

```bash
POLICY_ENGINE=inprocess npx tsx examples/governed-pipeline-demo.ts
```

```bash
POLICY_ENGINE=opa \
OPA_BASE_URL=http://127.0.0.1:8181 \
OPA_POLICY_PATH=open_cot/delegation \
npx tsx examples/governed-pipeline-demo.ts
```

Optional OPA env vars:

- `OPA_BEARER_TOKEN`
- `OPA_TIMEOUT_MS` (default `2000`)
- `OPA_FALLBACK_INPROCESS` (`true` by default)

Starter OPA policy package: `examples/opa/README.md`

Live OPA integration test (targets `http://127.0.0.1:8181` by default):

```bash
npm run test:opa-live
```

Override defaults if needed:

```bash
OPA_BASE_URL=http://127.0.0.1:8181 \
OPA_POLICY_PATH=open_cot/delegation \
OPA_LIVE_POLICY_MODE=allow \
npm run test:opa-live
```

`npm test` still auto-skips the live OPA suite when `OPA_BASE_URL` is not set.

## Runtime governance guarantees

Current core package behavior (runtime, not just schema/docs):

- **Policy mediation for all shipped pipelines**: `chat-pipeline`, `coder-pipeline`, and `governed-pipeline` route tool execution through a `DelegationPolicyEngine` before dispatch.
- **Dispatch-time least privilege enforcement**: tool arguments are schema-validated and checked against delegated scope constraints (`allowed_fields`, `excluded_fields`, `max_results`) in `ToolRegistry`.
- **Phase consultation checks**: policy consultation hooks are enforced at `frame`, `plan`, `observe_result`, `critique_verify`, and `finalize`.
- **Manifest/policy reconciliation**: capability manifests can be compiled from policy-engine tool previews (including OPA-backed decisions), so model-visible tool posture reflects live policy outcomes.

`chat-pipeline` and `coder-pipeline` default to an in-process policy derived from sandbox allow/block lists. You can override this by passing explicit `policies` and/or a custom `policyEngine`.

### Use a real LLM (Ollama example)

```bash
# Start Ollama with a model
ollama serve &
ollama pull qwen2.5:1.5b

# Point the core package at Ollama
OPENAI_BASE_URL=http://localhost:11434/v1 npx tsx examples/chat-pipeline-demo.ts "What is the capital of France?"
```

### Use OpenAI

```bash
OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-4o-mini npx tsx examples/chat-pipeline-demo.ts "Explain recursion"
```

## FSM transition map

Every cognitive pipeline follows this finite state machine. Every transition emits a trace event.

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

When any hard-enforced budget hits zero, the cognitive pipeline is force-stopped with `budget_exhausted` status and the trace records why.

### Streaming decode circuit breaker

The core package now enforces token/safety limits during streamed decoding (not only after full responses):

- **Preflight budget gate**: estimate prompt token cost before each model call; if insufficient remaining budget, stop before decode starts.
- **Mid-stream token breaker**: stream callbacks track emitted completion tokens and abort decode once the remaining completion allowance is exhausted.
- **Mid-stream safety breaker**: stream callbacks can stop runaway or unsafe output patterns and route to `fail_safe`.
- **FSM-first shutdown**: on breaker trip, the run is forced into terminal state (`budget_exhausted`, `fail_safe`, or `external_stop`) before any subsequent tool side effects.

This keeps authority in the core package FSM even when a model ignores budget instructions.

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
import { ToolRegistry, defineToolContract } from "@open-cot/core";

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

## Adding new pipelines

Create a new file in `src/pipelines/` that:

1. Creates state with `createPipelineState()`
2. Uses `transition()` to move through FSM phases
3. Uses `emitPlan/emitAction/emitObservation/emitVerify/emitSummary` to build the trace
4. Uses `createBudgetTracker()` to track resource usage
5. Calls `finalizeTrace()` at the end

The FSM engine prevents invalid transitions and the validator confirms the output trace is schema-compliant.

## Cross-language validation

Traces emitted by the TypeScript core package can be validated by the Python tooling:

```bash
# Save a trace from the core package
npx tsx examples/chat-pipeline-demo.ts > trace.json

# Validate with the Python validator
python tools/validate.py --trace trace.json
```

This proves the schema contract works across implementations.

## What the core package demonstrates

- Standard-compliant trace emission (RFC 0001 + RFC 0007)
- Tool call / observation pairing (RFC 0003)
- Budget tracking and exhaustion (RFC 0038)
- Sandbox policy enforcement (RFC 0017)
- Telemetry metrics (RFC 0031)
- FSM transition validation
- Loop policy guardrails
- Bidirectional schema verification
