# RFC 0003 — Execution Intent & Endpoint Invocation (v1.0)

**Status:** Draft
**Author:** Open CoT Community
**Created:** 2026-04-27
**Target Version:** Core v1.0
**Discussion:** https://github.com/supernovae/open-cot/discussions/3

---

## Summary

Defines execution intent as a typed request for a known endpoint capability, bound to a snapshot and digest.

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
  "title": "Open CoT RFC 0003 - Execution Intent and Endpoint Invocation",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "intent_id": {
      "type": "string",
      "minLength": 1
    },
    "snapshot_id": {
      "type": "string",
      "minLength": 1
    },
    "endpoint_id": {
      "type": "string",
      "minLength": 1
    },
    "capability_name": {
      "type": "string",
      "minLength": 1
    },
    "capability_digest": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    },
    "risk_level": {
      "type": "string",
      "enum": [
        "read",
        "write",
        "destructive",
        "external_side_effect"
      ]
    },
    "requires_approval": {
      "type": "boolean"
    },
    "idempotency_key": {
      "type": "string",
      "minLength": 1
    },
    "arguments": {
      "type": "object"
    },
    "preconditions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "expected_result_shape": {
      "type": "object",
      "additionalProperties": true
    },
    "postconditions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "intent_id",
    "snapshot_id",
    "endpoint_id",
    "capability_name",
    "capability_digest",
    "risk_level",
    "requires_approval",
    "idempotency_key",
    "arguments"
  ]
}
```
<!-- opencot:schema:end -->

## Notes

This RFC is part of the compact core. Training, dataset packaging, reward modeling, benchmark execution, and model adaptation are intentionally out of scope for this repository reset.
