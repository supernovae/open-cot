# RFC 0009 — Requester Identity & Governance Context (v1.0)

**Status:** Draft
**Author:** Open CoT Community
**Created:** 2026-04-27
**Target Version:** Core v1.0
**Discussion:** https://github.com/supernovae/open-cot/discussions/9

---

## Summary

Defines requester identity as the authenticated principal attached to a cognitive operation.

Open CoT means **Cognitive Operations Theory** in this core reset. The standard defines portable artifacts at the boundary between cognition and execution. The model-facing artifact is untrusted input until validated and reconciled by runtime code.

## Normative Requirements

- Implementations MUST treat model output as untrusted structured input.
- Implementations MUST validate artifacts against the schema embedded in this RFC.
- Implementations MUST keep execution authority outside reasoning text.
- Implementations MUST record enough evidence for replay, audit, and conformance testing.

## Schema

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0009 - Requester Identity and Governance Context",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "requester_id": {
      "type": "string",
      "minLength": 1
    },
    "kind": {
      "type": "string",
      "enum": [
        "model",
        "service",
        "human",
        "runtime"
      ]
    },
    "display_name": {
      "type": "string"
    },
    "trust_level": {
      "type": "string",
      "enum": [
        "untrusted",
        "low",
        "medium",
        "high",
        "system"
      ]
    },
    "governance_context": {
      "type": "object",
      "additionalProperties": true
    }
  },
  "required": [
    "requester_id",
    "kind",
    "trust_level"
  ]
}
```
<!-- opencot:schema:end -->

## Notes

This RFC is part of the compact core. Training, dataset packaging, reward modeling, benchmark execution, and model adaptation are intentionally out of scope for this repository reset.
