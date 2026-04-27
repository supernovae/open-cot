# RFC 0001 — Cognitive Artifact & Reasoning Evidence (v1.0)

**Status:** Draft
**Author:** Open CoT Community
**Created:** 2026-04-27
**Target Version:** Core v1.0
**Discussion:** https://github.com/supernovae/open-cot/discussions/1

---

## Summary

Defines the typed cognitive artifact emitted by a cognitive function. Reasoning is retained as evidence, never as authority.

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
  "title": "Open CoT RFC 0001 - Cognitive Artifact and Reasoning Evidence",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "artifact_id": {
      "type": "string",
      "minLength": 1
    },
    "schema_version": {
      "type": "string",
      "enum": [
        "open-cot.core.v1"
      ]
    },
    "capability_snapshot_id": {
      "type": "string",
      "minLength": 1
    },
    "intent_verification": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "objective",
        "request_boundaries",
        "allowed_scope",
        "prohibited_scope"
      ],
      "properties": {
        "objective": {
          "type": "string"
        },
        "request_boundaries": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "allowed_scope": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "prohibited_scope": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    },
    "reasoning_trace": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "evidence_mode",
        "summary",
        "steps"
      ],
      "properties": {
        "evidence_mode": {
          "type": "string",
          "enum": [
            "audit_summary",
            "detailed_evidence",
            "redacted_evidence"
          ]
        },
        "summary": {
          "type": "string"
        },
        "steps": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/reasoning_step"
          }
        },
        "contains_sensitive_content": {
          "type": "boolean"
        },
        "redaction_reason": {
          "type": "string"
        }
      }
    },
    "assumptions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "execution_intents": {
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
    "uncertainty": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "level",
        "explanation"
      ],
      "properties": {
        "level": {
          "type": "string",
          "enum": [
            "low",
            "medium",
            "high"
          ]
        },
        "explanation": {
          "type": "string"
        }
      }
    },
    "yield_reason": {
      "type": "string"
    }
  },
  "required": [
    "artifact_id",
    "schema_version",
    "capability_snapshot_id",
    "intent_verification",
    "reasoning_trace",
    "assumptions",
    "execution_intents",
    "observations",
    "uncertainty"
  ],
  "$defs": {
    "reasoning_step": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "step_id",
        "kind",
        "content",
        "visibility"
      ],
      "properties": {
        "step_id": {
          "type": "string",
          "minLength": 1
        },
        "kind": {
          "type": "string",
          "enum": [
            "interpretation",
            "constraint",
            "hypothesis",
            "verification",
            "yield"
          ]
        },
        "content": {
          "type": "string"
        },
        "visibility": {
          "type": "string",
          "enum": [
            "audit_summary",
            "detailed_evidence",
            "redacted"
          ]
        },
        "redaction_reason": {
          "type": "string"
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      }
    }
  }
}
```
<!-- opencot:schema:end -->

## Notes

This RFC is part of the compact core. Training, dataset packaging, reward modeling, benchmark execution, and model adaptation are intentionally out of scope for this repository reset.
