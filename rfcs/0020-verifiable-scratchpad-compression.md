# RFC 0020 — Verifiable Scratchpad Compression (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Schema v0.5  
**Discussion:** https://github.com/supernovae/open-cot/discussions/20
---

## 1. Summary

This RFC defines a compact representation for scratchpad reasoning while preserving verifiability and provenance.

It extends:

- RFC 0001 — Reasoning Schema
- RFC 0013 — Memory Compression & Embedding
- RFC 0035 — Data Provenance Tracking

---

## 2. Motivation

Long reasoning traces are expensive to store and process. Compression is useful, but compressed artifacts must still be auditable and re-expandable for verification.

---

## 3. Compression model

Compression outputs include:

- a compressed scratchpad payload
- source step references
- algorithm identifier and version
- integrity hash of source material

---

## 4. Full Schema (JSON)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0020 — Verifiable Scratchpad Compression",
  "type": "object",
  "properties": {
    "version": { "type": "string", "enum": ["0.1"] },
    "trace_id": { "type": "string" },
    "compression": {
      "type": "object",
      "properties": {
        "algorithm": { "type": "string" },
        "algorithm_version": { "type": "string" },
        "payload": { "type": "string" }
      },
      "required": ["algorithm", "algorithm_version", "payload"]
    },
    "source_step_ids": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "source_hash": { "type": "string" },
    "provenance_ref": { "type": "string" }
  },
  "required": ["version", "trace_id", "compression", "source_step_ids", "source_hash"]
}
```

---

## 5. Example

```json
{
  "version": "0.1",
  "trace_id": "trace_001",
  "compression": {
    "algorithm": "summary_delta_v1",
    "algorithm_version": "1.0.0",
    "payload": "cmp:abc123..."
  },
  "source_step_ids": ["s2", "s3", "s4"],
  "source_hash": "sha256:4f8a6d...",
  "provenance_ref": "prov_001"
}
```

---

## 6. Conclusion

RFC 0020 provides a compression contract that reduces storage cost while preserving deterministic verification paths.
