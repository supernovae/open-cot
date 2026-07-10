# RFC 0002 — Capability Snapshot & Endpoint Descriptor (v1.0)

**Status:** Draft
**Author:** Open CoT Community
**Created:** 2026-04-27
**Target Version:** Core v1.0
**Discussion:** https://github.com/supernovae/open-cot/discussions/61

---

## Summary

Defines the immutable capability snapshot injected into cognition before any execution intent can be proposed.

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
  "title": "Open CoT RFC 0002 - Capability Snapshot and Endpoint Descriptor",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "snapshot_id": {
      "type": "string",
      "minLength": 1
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "capabilities_hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    },
    "capabilities": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "endpoint_id",
          "capability_name",
          "description",
          "input_schema",
          "risk_level",
          "requires_approval",
          "capability_digest"
        ],
        "properties": {
          "endpoint_id": {
            "type": "string",
            "minLength": 1
          },
          "capability_name": {
            "type": "string",
            "minLength": 1
          },
          "description": {
            "type": "string"
          },
          "input_schema": {
            "type": "object",
            "additionalProperties": true
          },
          "output_schema": {
            "type": "object",
            "additionalProperties": true
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
          "capability_digest": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          }
        }
      }
    }
  },
  "required": [
    "snapshot_id",
    "created_at",
    "capabilities_hash",
    "capabilities"
  ]
}
```
<!-- opencot:schema:end -->

## Notes

This RFC is part of the compact core. Training, dataset packaging, reward modeling, benchmark execution, and model adaptation are intentionally out of scope for this repository reset.
