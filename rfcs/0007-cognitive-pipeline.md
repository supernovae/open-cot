# RFC 0007 — Runtime Boundary & Cognitive Pipeline (v1.0)

**Status:** Draft
**Author:** Open CoT Community
**Created:** 2026-04-27
**Target Version:** Core v1.0
**Discussion:** https://github.com/supernovae/open-cot/discussions/7

---

## Summary

Defines the runtime boundary that owns progression around non-deterministic cognition, including a typed execution plan that a runtime can validate before delegating scoped work.

Open CoT means **Cognitive Operations Theory** in this core reset. The standard defines portable artifacts at the boundary between cognition and execution. The model-facing artifact is untrusted input until validated and reconciled by runtime code.

## Normative Requirements

- Implementations MUST treat model output as untrusted structured input.
- Implementations MUST validate artifacts against the schema embedded in this RFC.
- Implementations MUST keep execution authority outside reasoning text.
- Implementations MUST record enough evidence for replay, audit, and conformance testing.
- Execution plans MUST be bounded before task execution begins.
- Task entries MUST describe scope and allowed capabilities; runtimes MUST NOT infer additional authority from task text.

## Schema

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0007 - Runtime Boundary and Cognitive Pipeline",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "plan_id": {
      "type": "string",
      "minLength": 1
    },
    "schema_version": {
      "type": "string",
      "enum": [
        "open-cot.execution-plan.v1"
      ]
    },
    "project_id": {
      "type": "string",
      "minLength": 1
    },
    "plan_version": {
      "type": "string",
      "minLength": 1
    },
    "goal": {
      "type": "string",
      "minLength": 1
    },
    "tasks": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/scoped_task"
      }
    },
    "assumptions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "plan_id",
    "schema_version",
    "project_id",
    "plan_version",
    "goal",
    "tasks",
    "assumptions"
  ],
  "$defs": {
    "risk_level": {
      "type": "string",
      "enum": [
        "read",
        "write",
        "destructive",
        "external_side_effect"
      ]
    },
    "scoped_task": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "task_id",
        "title",
        "objective",
        "allowed_scopes",
        "allowed_capabilities",
        "max_risk_level"
      ],
      "properties": {
        "task_id": {
          "type": "string",
          "minLength": 1
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "objective": {
          "type": "string",
          "minLength": 1
        },
        "allowed_scopes": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "allowed_capabilities": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "max_risk_level": {
          "$ref": "#/$defs/risk_level"
        }
      }
    }
  }
}
```
<!-- opencot:schema:end -->

## Notes

This RFC is part of the compact core. Training, dataset packaging, reward modeling, benchmark execution, and model adaptation are intentionally out of scope for this repository reset.
