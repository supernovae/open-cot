# RFC 0007 — Runtime Boundary & Cognitive Pipeline (v1.0)

**Status:** Draft
**Author:** Open CoT Community
**Created:** 2026-04-27
**Target Version:** Core v1.0
**Discussion:** https://github.com/supernovae/open-cot/discussions/66

---

## Summary

Defines the runtime boundary that owns progression around non-deterministic cognition.

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
  "title": "Open CoT RFC 0007 - Runtime Boundary and Cognitive Pipeline",
  "type": "object",
  "additionalProperties": true,
  "properties": {
    "version": {
      "type": "string"
    },
    "task": {
      "type": "string"
    },
    "steps": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": true,
        "required": [
          "id",
          "type",
          "content"
        ],
        "properties": {
          "id": {
            "type": "string"
          },
          "type": {
            "type": "string"
          },
          "content": {
            "type": "string"
          },
          "parent": {
            "oneOf": [
              {
                "type": "string"
              },
              {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            ]
          },
          "tool_invocation": {
            "type": "object",
            "additionalProperties": true
          }
        }
      }
    },
    "final_answer": {
      "type": "string"
    },
    "termination": {
      "type": "string"
    }
  },
  "required": [
    "version",
    "task",
    "steps",
    "final_answer"
  ]
}
```
<!-- opencot:schema:end -->

## Notes

This RFC is part of the compact core. Training, dataset packaging, reward modeling, benchmark execution, and model adaptation are intentionally out of scope for this repository reset.
