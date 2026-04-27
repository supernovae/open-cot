# RFC 0005 — Observation, Receipt & Audit Evidence (v1.0)

**Status:** Draft
**Author:** Open CoT Community
**Created:** 2026-04-27
**Target Version:** Core v1.0
**Discussion:** https://github.com/supernovae/open-cot/discussions/5

---

## Summary

Defines observations and receipts as replayable evidence for endpoint execution and skipped work.

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
  "title": "Open CoT RFC 0005 - Observation, Receipt, and Audit Evidence",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "observation": {
      "$ref": "#/$defs/observation"
    },
    "receipt": {
      "$ref": "#/$defs/receipt"
    }
  },
  "$defs": {
    "observation": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "observation_id",
        "status",
        "summary",
        "observed_at"
      ],
      "properties": {
        "observation_id": {
          "type": "string",
          "minLength": 1
        },
        "intent_id": {
          "type": "string"
        },
        "status": {
          "type": "string",
          "enum": [
            "recorded",
            "skipped",
            "error"
          ]
        },
        "summary": {
          "type": "string"
        },
        "output": {},
        "observed_at": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "receipt": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "receipt_id",
        "intent_id",
        "endpoint_id",
        "status",
        "issued_at"
      ],
      "properties": {
        "receipt_id": {
          "type": "string",
          "minLength": 1
        },
        "intent_id": {
          "type": "string",
          "minLength": 1
        },
        "endpoint_id": {
          "type": "string",
          "minLength": 1
        },
        "status": {
          "type": "string",
          "enum": [
            "executed",
            "skipped",
            "failed"
          ]
        },
        "input_hash": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        },
        "output_hash": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        },
        "issued_at": {
          "type": "string",
          "format": "date-time"
        }
      }
    }
  }
}
```
<!-- opencot:schema:end -->

## Notes

This RFC is part of the compact core. Training, dataset packaging, reward modeling, benchmark execution, and model adaptation are intentionally out of scope for this repository reset.
