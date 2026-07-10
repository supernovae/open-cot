# RFC 0010 — Human Approval, Yield & Resume (v1.0)

**Status:** Draft
**Author:** Open CoT Community
**Created:** 2026-04-27
**Target Version:** Core v1.0
**Discussion:** https://github.com/supernovae/open-cot/discussions/69

---

## Summary

Defines approval, yield, and resume records when runtime policy requires human participation.

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
  "title": "Open CoT RFC 0010 - Human Approval, Yield, and Resume",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "approval_id": {
      "type": "string",
      "minLength": 1
    },
    "intent_id": {
      "type": "string"
    },
    "requested_at": {
      "type": "string",
      "format": "date-time"
    },
    "status": {
      "type": "string",
      "enum": [
        "requested",
        "approved",
        "rejected",
        "timeout",
        "yielded"
      ]
    },
    "prompt": {
      "type": "string"
    },
    "response": {
      "type": "string"
    },
    "resume_token": {
      "type": "string"
    }
  },
  "required": [
    "approval_id",
    "requested_at",
    "status",
    "prompt"
  ]
}
```
<!-- opencot:schema:end -->

## Notes

This RFC is part of the compact core. Training, dataset packaging, reward modeling, benchmark execution, and model adaptation are intentionally out of scope for this repository reset.
