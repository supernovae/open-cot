# RFC 0035 — Data Provenance Tracking (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Schema v0.6  
**Discussion:** https://github.com/supernovae/open-cot/issues/35

---

## 1. Summary

This RFC defines provenance and integrity metadata for Open CoT artifacts, including traces, sidecars, and compressed scratchpads.

It extends:

- RFC 0010 — Agent Memory Schema
- RFC 0020 — Verifiable Scratchpad Compression
- RFC 0022 — Agent Evaluation Protocol

---

## 2. Provenance and integrity model

Required provenance dimensions:

- source identity
- transformation chain
- actor (agent/tool) identity
- timestamp and pipeline stage

Integrity additions:

- canonical payload hash
- optional digital signature envelope
- parent artifact references for derivations

---

## 3. Full Schema (JSON)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0035 — Data Provenance Tracking",
  "type": "object",
  "properties": {
    "version": { "type": "string", "enum": ["0.1"] },
    "artifact_id": { "type": "string" },
    "artifact_type": { "type": "string" },
    "source": { "type": "string" },
    "agent_id": { "type": "string" },
    "tool_id": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" },
    "transformation": { "type": "string" },
    "parent_artifact_ids": { "type": "array", "items": { "type": "string" } },
    "integrity": {
      "type": "object",
      "properties": {
        "hash_algorithm": { "type": "string", "enum": ["sha256"] },
        "content_hash": { "type": "string" },
        "signature_algorithm": { "type": "string" },
        "signature": { "type": "string" },
        "signing_key_id": { "type": "string" }
      },
      "required": ["hash_algorithm", "content_hash"]
    }
  },
  "required": ["version", "artifact_id", "artifact_type", "source", "timestamp", "transformation", "integrity"]
}
```

---

## 4. Example

```json
{
  "version": "0.1",
  "artifact_id": "trace_001",
  "artifact_type": "reasoning_trace",
  "source": "synthetic_seed_v0",
  "agent_id": "planner",
  "timestamp": "2026-04-14T12:00:00Z",
  "transformation": "converted_from_gsm8k_minimal",
  "parent_artifact_ids": ["raw_qa_001"],
  "integrity": {
    "hash_algorithm": "sha256",
    "content_hash": "sha256:2ee7f3...",
    "signature_algorithm": "ed25519",
    "signature": "base64:...",
    "signing_key_id": "opencot-release-key-1"
  }
}
```

---

## 5. Conclusion

RFC 0035 provides a provenance-plus-integrity contract so Open CoT artifacts are traceable, tamper-evident, and auditable across toolchains.
