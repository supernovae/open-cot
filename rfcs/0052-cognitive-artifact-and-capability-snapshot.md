# RFC 0052 — Cognitive Artifact & Capability Snapshot (v0.1)

**Status:** Draft  
**Author:** Open CoT Community  
**Created:** 2026-04-27  
**Target Version:** Schema v0.10
**Discussion:** https://github.com/supernovae/open-cot/discussions/52

---

## 1. Summary

This RFC defines portable structures for runtimes that wrap non-deterministic
cognitive functions with deterministic validation and execution boundaries.

The core structure is a **Cognitive Artifact**: a typed proposal emitted by a
model or model-like system. It is untrusted input. A runtime validates and
reconciles it against an immutable **Capability Snapshot** before performing
any side effect.

## 2. Core concepts

- `capability_snapshot`: immutable inventory of endpoints available to the
  cognitive step.
- `cognitive_artifact`: typed proposal emitted from the cognitive step.
- `execution_intent`: requested endpoint execution tied to a snapshot and
  capability digest.
- `observation`: structured evidence recorded during reconciliation.

## 3. Normative requirements

- A cognitive artifact MUST NOT be treated as authorization.
- Every execution intent MUST reference the exact snapshot used for generation.
- A runtime MUST verify endpoint name, capability name, and capability digest
  before execution.
- A runtime MUST validate arguments against the original capability input
  schema.
- Reasoning traces are explanatory audit material only. They are not proof,
  authorization, or trusted state.

## 4. Runtime neutrality

This RFC does not require a specific durable execution engine, MCP transport,
model provider, or TypeScript implementation. Those are implementation choices.

## 5. Schema

Machine-readable schema: `schemas/rfc-0052-cognitive-artifact.json`.
