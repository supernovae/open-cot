# RFC 0050 — TOON Adapter: Token-Oriented Object Notation (v0.1)

**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-18  
**Target Version:** Schema v0.8  
**Discussion:** https://github.com/supernovae/open-cot/discussions/50

## 1. Summary

This RFC defines an optional **TOON adapter** for the Open CoT harness. TOON (Token-Oriented Object Notation) is a compact, human-readable serialization format that reduces token consumption by 20–60% compared to equivalent JSON when passing structured data through LLM context windows. The adapter translates canonical JSON Schema objects into TOON notation for model-facing injection and parses model-generated TOON back into validated JSON objects. JSON Schema remains the normative interchange and audit format; TOON is strictly an adapter-layer optimization.

## 2. Motivation and problem statement

[RFC 0049](0049-capability-manifest.md) established the pattern of maintaining canonical JSON for audit while injecting compact text at the model boundary. That pattern works well for the capability manifest but is hand-coded: each new schema that needs compact injection requires a bespoke serializer. Meanwhile, the project's token-efficiency roadmap ([`docs/token-efficiency.md`](../docs/token-efficiency.md)) identifies "Tier 2 — Structured text markers" and "Tier 3 — Alternative serializations" as research directions, with the validation boundary rule that compact formats must round-trip to canonical JSON.

TOON fills this gap with a general-purpose compact notation that:

- Uses **inline schema headers** (`items[N]{field1, field2}:`) so the model knows the shape without a separate schema payload.
- Represents **uniform arrays** as pipe-delimited tabular rows, eliminating repeated key names.
- Represents **objects** with indentation-based `key: value` pairs, eliminating braces, quotes, and commas.
- Is backed by recent benchmarks showing measurable token savings on real workloads (see §11).

The adapter generalizes what `manifestToCompactText` does today into a reusable, schema-aware translation layer.

## 3. Scope and non-goals

**In scope:**

- A bidirectional adapter: `toToon(object, schema?)` and `fromToon(toonString, schema?)`.
- Schema-to-header generation: `schemaToToonHeader(jsonSchema)`.
- A TOON serializer for capability manifests (`manifestToToon`) alongside the existing compact text.
- A `wire_format` configuration option on agent configs (`"json" | "compact-text" | "toon"`).
- Documentation, experiment card, and example fixtures.

**Non-goals:**

- TOON is **never normative**. It is never stored in audit envelopes, trace archives, or harness-to-harness interchange.
- TOON does not replace JSON Schema validation. All TOON output is validated by converting back to JSON and running Ajv.
- TOON does not define a new schema language. The inline header is a serialization hint, not a type system.
- This RFC does not mandate TOON adoption. It is opt-in per agent or backend configuration.

## 4. Normative requirements

**N1 — Round-trip fidelity.** For any object `O` that validates against a registered JSON Schema `S`, `fromToon(toToon(O, S), S)` MUST produce an object that also validates against `S` and is deeply equal to `O` (modulo key ordering).

**N2 — Validation boundary.** The harness MUST validate parsed TOON output against the original JSON Schema before trusting it. The adapter is a serialization layer, not a trust boundary.

**N3 — Opt-in configuration.** The `wire_format` setting defaults to `"compact-text"` (current behavior). Changing to `"toon"` MUST NOT alter audit artifacts, trace schemas, or policy enforcement.

**N4 — Marker convention.** TOON blocks injected into model context MUST be wrapped in `[toon:schema_name]` … `[/toon:schema_name]` markers, paralleling the `[capability_manifest]` convention from RFC 0049.

**N5 — Graceful degradation.** If `fromToon` fails to parse model output, the harness MUST surface a structured validation error that the model can repair on the next turn, consistent with the repair loop pattern described in `docs/token-efficiency.md`.

## 5. TOON notation reference

### 5.1 Objects

Key-value pairs, one per line, colon-separated. No braces, no quotes on keys or simple string values.

```
name: search
access_level: pre_authorized
idempotent: true
```

### 5.2 Arrays with inline schema headers

The header declares the array name, expected length (or `N` for variable), and field names in order.

```
tools[3]{name, access, idempotent}:
search | pre-authorized | true
write_file | requires-delegation | false
run_tests | pre-authorized | true
```

Fields are pipe-delimited. Whitespace around pipes is trimmed. The header line ends with a colon.

### 5.3 Nested objects

Indentation (two spaces) indicates nesting.

```
budget:
  steps_remaining: 8
  tool_calls_remaining: 5
  tokens_remaining: 4000
```

### 5.4 Scalar arrays

Simple comma-separated values after the header.

```
blocked[2]: shell, drop_table
```

### 5.5 Escaping

Values containing pipe characters (`|`) or leading/trailing whitespace MUST be quoted with double quotes. Newlines within values are represented as `\n`.

## 6. Schema-to-header generation

Given a JSON Schema with an `array` type whose `items` is an `object`, `schemaToToonHeader` extracts property names (respecting `required` ordering if present) and produces the header string:

```
Input schema:  { "type": "array", "items": { "properties": { "id": ..., "type": ..., "content": ... } } }
Output header: items[N]{id, type, content}
```

For non-array object schemas, the header is omitted and the object is serialized as key-value pairs.

## 7. Adapter API

```typescript
function toToon(obj: unknown, schema?: JsonSchema): string;
function fromToon(toon: string, schema?: JsonSchema): unknown;
function schemaToToonHeader(schema: JsonSchema, name?: string): string | null;
```

- `toToon` accepts any JSON-serializable value. If a schema is provided, it drives header generation and type-aware formatting. Without a schema, the adapter infers structure from the object shape.
- `fromToon` parses TOON text back to a plain object. The schema guides type coercion (e.g., `"8"` → `8` when the schema says `integer`).
- `schemaToToonHeader` returns the header line for array schemas, or `null` for non-array schemas.

## 8. Integration with capability manifest

`manifestToToon(manifest)` produces:

```
[toon:capability_manifest]
tools_available[3]{name, access, idempotent}:
search | pre-authorized | true
write_file | requires-delegation | false
run_tests | pre-authorized | true
tools_blocked: shell, drop_table
budget{steps, tool_calls, tokens, retries}: 8 | 5 | 4000 | 2
trust_level: medium
constraints: no network after step 5; read-only filesystem
[/toon:capability_manifest]
```

This replaces `manifestToCompactText` when `wire_format` is `"toon"`. The structured JSON manifest on `AgentState` is unchanged.

## 9. Configuration

```typescript
interface WireFormatConfig {
  wire_format: "json" | "compact-text" | "toon";
}
```

Added as an optional field on `GovernedAgentConfig` and as a parameter on `runChatAgent`. Default: `"compact-text"`.

The manifest heartbeat and any future schema injections select the serializer based on this setting:

| `wire_format` | Manifest serializer | Other schema injections |
|---------------|-------------------|------------------------|
| `"json"` | `JSON.stringify` (minified) | `JSON.stringify` |
| `"compact-text"` | `manifestToCompactText` (existing) | N/A (hand-coded per schema) |
| `"toon"` | `manifestToToon` | `toToon(obj, schema)` |

## 10. Security considerations

TOON inherits all security properties from [RFC 0049 §15](0049-capability-manifest.md). The adapter is non-authoritative: a model cannot elevate privileges by emitting TOON. Parsed TOON passes through the same Ajv validation as JSON. Operators SHOULD apply the same redaction policies to TOON context as to other prompt material.

## 11. Research references

The following published work supports the token-efficiency claims motivating this RFC:

1. **Abt, B. (2025).** "TOON Format: Token-Oriented Object Notation for LLM-Friendly Data Exchange." https://benjamin-abt.com/blog/2025/12/12/ai-toon-format/ — Production-focused design rationale for TOON.

2. **arXiv 2603.03306 (2026).** "Token-Oriented Object Notation vs JSON: A Benchmark of Plain and Constrained Decoding Generation." https://arxiv.org/abs/2603.03306 — Benchmarks TOON against JSON and constrained decoding; finds TOON's efficiency advantage follows a non-linear curve, becoming significant beyond a structural complexity threshold.

3. **Nandakishore, G. (2026).** "JTON: A Token-Efficient JSON Superset with Zen Grid Tabular Encoding for Large Language Models." arXiv 2604.05865. https://arxiv.org/abs/2604.05865 — Reports 15–60% token reduction (28.5% average) with 100% syntactic validity across 12 LLMs.

4. **ATON Format V2 Whitepaper (2025).** "Adaptive Token-Oriented Notation — Production-grade data serialization for LLMs." https://www.atonformat.com/whitepaper.html — Reports 56% token reduction vs JSON with native relationship support.

## 12. Cross-references

- RFC 0001 — Reasoning traces (primary schema that benefits from compact injection).
- RFC 0003 — Tool Invocation (tool payloads as a TOON target).
- RFC 0007 — Governed FSM (injection points).
- RFC 0038 — Cost-Aware Budget (token savings directly impact budget consumption).
- RFC 0049 — Capability Manifest (existing compact text pattern that TOON generalizes).

## 13. Acceptance criteria

- `toToon` and `fromToon` round-trip for all schemas in the registry without validation errors.
- `manifestToToon` output is under 200 tokens for a five-tool profile (matching RFC 0049 target).
- Governed agent demo completes successfully with `wire_format: "toon"`.
- Token count comparison (JSON vs compact-text vs TOON) is documented for capability manifest and reasoning trace fixtures.
- No change in behavior for existing users who do not set `wire_format`.
