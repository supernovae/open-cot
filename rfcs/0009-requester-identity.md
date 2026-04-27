# RFC 0009 — Requester Identity & Delegation Context (v1.0)

**Status:** Draft
**Author:** Open CoT Community
**Created:** 2026-04-27
**Target Version:** Core v1.0
**Discussion:** https://github.com/supernovae/open-cot/discussions/9

---

## Summary

Defines the typed delegation context attached to a cognitive operation. Runtime execution must carry explicit principal, delegate, project, workspace, scope, capability, risk, and trace boundaries.

Open CoT means **Cognitive Operations Theory** in this core reset. The standard defines portable artifacts at the boundary between cognition and execution. The model-facing artifact is untrusted input until validated and reconciled by runtime code.

## Normative Requirements

- Implementations MUST treat model output as untrusted structured input.
- Implementations MUST validate artifacts against the schema embedded in this RFC.
- Implementations MUST keep execution authority outside reasoning text.
- Implementations MUST record enough evidence for replay, audit, and conformance testing.
- Implementations MUST NOT execute with ambient user authority when a delegation context is required.
- Endpoint calls SHOULD carry enough delegation context for audit and policy evaluation.

## Schema

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0009 - Requester Identity and Delegation Context",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "principal_id": {
      "type": "string",
      "minLength": 1
    },
    "principal_type": {
      "type": "string",
      "enum": [
        "human",
        "service",
        "runtime"
      ]
    },
    "delegate_id": {
      "type": "string",
      "minLength": 1
    },
    "delegate_type": {
      "type": "string",
      "enum": [
        "reconciler",
        "service",
        "runtime"
      ]
    },
    "project_id": {
      "type": "string",
      "minLength": 1
    },
    "workspace_id": {
      "type": "string",
      "minLength": 1
    },
    "allowed_scopes": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "denied_scopes": {
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
    },
    "approval_required_for": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/risk_level"
      }
    },
    "expires_at": {
      "type": "string",
      "format": "date-time"
    },
    "trace_id": {
      "type": "string",
      "minLength": 1
    },
    "parent_workflow_id": {
      "type": "string",
      "minLength": 1
    },
    "task_workflow_id": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "principal_id",
    "principal_type",
    "delegate_id",
    "delegate_type",
    "project_id",
    "workspace_id",
    "allowed_scopes",
    "denied_scopes",
    "allowed_capabilities",
    "max_risk_level",
    "approval_required_for",
    "expires_at",
    "trace_id",
    "parent_workflow_id"
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
    }
  }
}
```
<!-- opencot:schema:end -->

## Notes

This RFC is part of the compact core. Training, dataset packaging, reward modeling, benchmark execution, and model adaptation are intentionally out of scope for this repository reset.
