# RFC 0006 — Reconciliation Result & Error Taxonomy (v1.0)

**Status:** Draft
**Author:** Open CoT Community
**Created:** 2026-04-27
**Target Version:** Core v1.0
**Discussion:** https://github.com/supernovae/open-cot/discussions/65

---

## Summary

Defines the final reconciliation envelope and shared error taxonomy for validated execution attempts.

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
  "title": "Open CoT RFC 0006 - Reconciliation Result and Error Taxonomy",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "reconciliation_id": {
      "type": "string",
      "minLength": 1
    },
    "status": {
      "type": "string",
      "enum": [
        "completed",
        "completed_with_errors",
        "yielded",
        "requires_approval",
        "failed"
      ]
    },
    "capability_snapshot": {
      "$ref": "rfc-0002-capability-snapshot.json"
    },
    "artifact": {
      "$ref": "rfc-0001-cognitive-artifact.json"
    },
    "executed_intents": {
      "type": "array",
      "items": {
        "$ref": "rfc-0003-execution-intent.json"
      }
    },
    "skipped_intents": {
      "type": "array",
      "items": {
        "$ref": "rfc-0003-execution-intent.json"
      }
    },
    "observations": {
      "type": "array",
      "items": {
        "$ref": "rfc-0005-observation-receipt.json#/$defs/observation"
      }
    },
    "errors": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/reconciliation_error"
      }
    },
    "final_message": {
      "type": "string"
    }
  },
  "required": [
    "reconciliation_id",
    "status",
    "capability_snapshot",
    "executed_intents",
    "skipped_intents",
    "observations",
    "errors",
    "final_message"
  ],
  "$defs": {
    "error_code": {
      "type": "string",
      "enum": [
        "INVALID_ARTIFACT",
        "SNAPSHOT_MISMATCH",
        "UNKNOWN_ENDPOINT",
        "UNKNOWN_CAPABILITY",
        "CAPABILITY_DIGEST_MISMATCH",
        "SCHEMA_VALIDATION_FAILED",
        "POLICY_DENIED",
        "APPROVAL_REQUIRED",
        "PRECONDITION_FAILED",
        "BUDGET_EXCEEDED",
        "ENDPOINT_EXECUTION_FAILED",
        "RESULT_VALIDATION_FAILED",
        "YIELDED"
      ]
    },
    "reconciliation_error": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "code",
        "message",
        "observed_at"
      ],
      "properties": {
        "code": {
          "$ref": "#/$defs/error_code"
        },
        "message": {
          "type": "string"
        },
        "intent_id": {
          "type": "string"
        },
        "observed_at": {
          "type": "string",
          "format": "date-time"
        },
        "details": {
          "type": "object",
          "additionalProperties": true
        }
      }
    }
  }
}
```
<!-- opencot:schema:end -->

## Notes

This RFC is part of the compact core. Training, dataset packaging, reward modeling, benchmark execution, and model adaptation are intentionally out of scope for this repository reset.
