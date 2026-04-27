# RFC 0012 — Compact Context Serialization (v1.0)

**Status:** Draft
**Author:** Open CoT Community
**Created:** 2026-04-27
**Target Version:** Core v1.0
**Discussion:** https://github.com/supernovae/open-cot/discussions/12

---

## Summary

Defines compact context serialization as an adapter over canonical JSON Schema artifacts.

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
  "title": "Open CoT RFC 0012 - Compact Context Serialization",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "format": {
      "type": "string",
      "enum": [
        "json",
        "compact-json",
        "toon"
      ]
    },
    "schema_ref": {
      "type": "string",
      "minLength": 1
    },
    "content": {
      "type": "string"
    },
    "content_hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    }
  },
  "required": [
    "format",
    "schema_ref",
    "content"
  ]
}
```
<!-- opencot:schema:end -->

## Notes

This RFC is part of the compact core. Training, dataset packaging, reward modeling, benchmark execution, and model adaptation are intentionally out of scope for this repository reset.
