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
- `reasoning_trace`: cognitive evidence explaining the path from objective to
  proposal. It can carry detailed evidence, an audit-safe summary, or a
  redacted evidence record.
- `observation`: structured evidence recorded during reconciliation.

## 3. Normative requirements

- A cognitive artifact MUST NOT be treated as authorization.
- Every execution intent MUST reference the exact snapshot used for generation.
- A runtime MUST verify endpoint name, capability name, and capability digest
  before execution.
- A runtime MUST validate arguments against the original capability input
  schema.
- Reasoning traces are evidentiary audit material. They help reviewers
  understand how the cognitive step reached a proposal, but they are not proof,
  authorization, or trusted state.
- A reasoning trace SHOULD declare whether it contains detailed evidence,
  audit-safe summary material, or redacted evidence. Redaction metadata SHOULD
  explain why detail is unavailable.
- A runtime MUST NOT infer permission from reasoning content. Permission comes
  only from policy gates, validated capability snapshots, and reconciliation.

## 4. Runtime neutrality

This RFC does not require a specific durable execution engine, MCP transport,
model provider, or TypeScript implementation. Those are implementation choices.

## 5. Schema

Machine-readable schema: `schemas/rfc-0052-cognitive-artifact.json`.
