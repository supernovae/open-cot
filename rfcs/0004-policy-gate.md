# RFC 0004 — Policy Gate & Permission Evaluation (v1.0)

**Status:** Draft
**Author:** Open CoT Community
**Created:** 2026-04-27
**Target Version:** Core v1.0
**Discussion:** https://github.com/supernovae/open-cot/discussions/63

---

## Summary

Defines policy gate outputs. Schema validity proves shape; policy evaluation controls permission.

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
  "title": "Open CoT RFC 0004 - Policy Gate and Permission Evaluation",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "evaluation_id": {
      "type": "string",
      "minLength": 1
    },
    "intent_id": {
      "type": "string"
    },
    "evaluated_at": {
      "type": "string",
      "format": "date-time"
    },
    "result": {
      "type": "string",
      "enum": [
        "allow",
        "deny",
        "requires_approval",
        "yield"
      ]
    },
    "reason": {
      "type": "string"
    },
    "constraints": {
      "type": "object",
      "additionalProperties": true
    },
    "budget_snapshot": {
      "$ref": "rfc-0008-execution-budget.json"
    }
  },
  "required": [
    "evaluation_id",
    "evaluated_at",
    "result",
    "reason"
  ]
}
```
<!-- opencot:schema:end -->

## Notes

This RFC is part of the compact core. Training, dataset packaging, reward modeling, benchmark execution, and model adaptation are intentionally out of scope for this repository reset.
