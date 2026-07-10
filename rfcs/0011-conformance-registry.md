# RFC 0011 — Conformance, Registry & Compatibility Rules (v1.0)

**Status:** Draft
**Author:** Open CoT Community
**Created:** 2026-04-27
**Target Version:** Core v1.0
**Discussion:** https://github.com/supernovae/open-cot/discussions/70

---

## Summary

Defines the schema registry and conformance profile expected from portable implementations.

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
  "title": "Open CoT RFC 0011 - Conformance, Registry, and Compatibility Rules",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "registry_version": {
      "type": "string"
    },
    "profile": {
      "type": "string",
      "enum": [
        "core",
        "runtime-boundary",
        "full"
      ]
    },
    "schemas": {
      "type": "object",
      "additionalProperties": {
        "type": "string"
      }
    },
    "required_examples": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "registry_version",
    "profile",
    "schemas"
  ]
}
```
<!-- opencot:schema:end -->

## Notes

This RFC is part of the compact core. Training, dataset packaging, reward modeling, benchmark execution, and model adaptation are intentionally out of scope for this repository reset.
