# Experiment Card: TOON Format Token Efficiency

**RFC:** [0050 — TOON Adapter](../../rfcs/0050-toon-adapter.md)  
**Status:** Planned  
**Related schemas:** `capability_manifest`, `reasoning`, `tool_invocation`

---

## Hypothesis

TOON (Token-Oriented Object Notation) reduces model-facing token consumption by 20–40% compared to equivalent JSON for structured harness payloads, without degrading parse success rate or task completion quality. The savings should be most pronounced for schemas with uniform arrays of objects (tool lists, reasoning steps) and least for flat scalar objects.

## Background

Published research supports the hypothesis:

- arXiv 2603.03306 reports TOON's efficiency follows a non-linear curve — advantageous beyond a structural complexity threshold.
- arXiv 2604.05865 (JTON) reports 15–60% reduction with 100% syntactic validity across 12 LLMs.
- ATON V2 whitepaper reports 56% reduction vs JSON.

The harness already uses hand-coded compact text for capability manifests (~200 tokens for a five-tool profile). This experiment measures whether the general-purpose TOON adapter achieves comparable or better efficiency while being reusable across schemas.

## Method

### 1. Static token count comparison

For each schema in the fixture set, serialize the same object as:

- **(a)** Pretty JSON (`JSON.stringify(obj, null, 2)`)
- **(b)** Minified JSON (`JSON.stringify(obj)`)
- **(c)** Compact text (where available — currently only capability manifest)
- **(d)** TOON (`toToon(obj, schema)`)

Measure token count using `tiktoken` (cl100k_base for GPT-4 class, o200k_base for GPT-4o class). Report absolute counts and percentage reduction vs (a) and (b).

### 2. Round-trip validation

For each fixture, verify: `fromToon(toToon(obj, schema), schema)` deeply equals `obj` and validates against the JSON Schema via Ajv.

### 3. Model generation test (live)

Prompt a model (at least one small 7B–13B, one large GPT-4 class) to generate TOON output given:

- A TOON header + 1-shot example
- A natural language instruction

Measure:

- **Parse success rate:** Does `fromToon` produce a valid object?
- **Repair loops:** How many re-prompts needed for a valid parse?
- **Token consumption:** prompt + completion tokens per successful generation.

### 4. End-to-end cognitive pipeline run

Run the governed cognitive pipeline demo with `wireFormat: "toon"` vs `wireFormat: "compact-text"` vs `wireFormat: "json"` on the same objective. Compare:

- Total prompt tokens across all LLM calls
- Total completion tokens
- Task success (same final answer quality)
- Number of wasted delegation cycles

## Fixture set

| Schema | Description | Expected TOON advantage |
|--------|-------------|------------------------|
| `capability_manifest` | 5 tools, 1 blocked, medium trust, 2 constraints | Moderate (tabular tool list) |
| `reasoning` (5 steps) | Multi-step reasoning trace | High (uniform step array) |
| `tool_invocation` | Single tool call with nested arguments | Low (mostly flat) |
| `reasoning` (15 steps) | Long reasoning trace | Very high (amortized header cost) |

Fixture files: [`examples/toon/`](../../examples/toon/)

## Metrics

| Metric | Unit | Collection |
|--------|------|-----------|
| Token count (prompt side) | integer | tiktoken on serialized string |
| Token count (completion side) | integer | API response or tiktoken |
| Reduction vs JSON (pretty) | percentage | `(json_tokens - toon_tokens) / json_tokens * 100` |
| Reduction vs JSON (minified) | percentage | same formula |
| Parse success rate | percentage | `fromToon` success / total attempts |
| Repair loop count | integer | re-prompts until valid parse |
| Task completion rate | percentage | cognitive pipeline runs with correct final answer |
| Total tokens per successful run | integer | sum of all LLM calls |

## Expected failure modes

- TOON parse failures on model output with misaligned pipes or missing fields.
- Small models (7B) may struggle with the TOON header convention without fine-tuning.
- The "prompt tax" (arXiv 2603.03306) — instructional overhead for TOON may negate savings on very small payloads.

## Run commands

```bash
# Static comparison (once fixture scripts are ready)
npx tsx harness/examples/toon-benchmark.ts

# Governed cognitive pipeline with TOON
WIRE_FORMAT=toon npx tsx harness/examples/governed-pipeline-demo.ts

# Governed cognitive pipeline with compact-text (baseline)
WIRE_FORMAT=compact-text npx tsx harness/examples/governed-pipeline-demo.ts
```

## Success criteria

- TOON achieves at least 20% token reduction vs minified JSON for the capability manifest fixture.
- TOON achieves at least 30% token reduction vs minified JSON for multi-step reasoning traces.
- Round-trip validation passes for 100% of fixtures.
- Parse success rate on model-generated TOON is at least 90% for GPT-4 class models without repair loops.
- No regression in task completion quality when governed cognitive pipeline uses `wireFormat: "toon"`.
