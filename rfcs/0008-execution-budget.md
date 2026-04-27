# RFC 0008 — Budget, Cost & Temporal Bounds (v1.0)

**Status:** Draft
**Author:** Open CoT Community
**Created:** 2026-04-27
**Target Version:** Core v1.0
**Discussion:** https://github.com/supernovae/open-cot/discussions/67

---

## Summary

Defines execution bounds for intent count, endpoint calls, token/cost ceilings, and temporal validity.

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
  "title": "Open CoT RFC 0008 - Budget, Cost, and Temporal Bounds",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "budget_id": {
      "type": "string",
      "minLength": 1
    },
    "max_execution_intents": {
      "type": "integer",
      "minimum": 0
    },
    "max_endpoint_calls": {
      "type": "integer",
      "minimum": 0
    },
    "max_tokens": {
      "type": "integer",
      "minimum": 0
    },
    "max_cost_usd": {
      "type": "number",
      "minimum": 0
    },
    "valid_after": {
      "type": "string",
      "format": "date-time"
    },
    "valid_until": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": [
    "budget_id"
  ]
}
```
<!-- opencot:schema:end -->

## Notes

This RFC is part of the compact core. Training, dataset packaging, reward modeling, benchmark execution, and model adaptation are intentionally out of scope for this repository reset.
