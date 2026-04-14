# RFC 0012 — Dataset Streaming Format (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/supernovae/open-cot/issues/12

---

## 1. Summary

This RFC defines a streaming profile for Open CoT datasets to support large-scale training and evaluation workloads.

It extends:

- RFC 0001 — Reasoning Schema
- RFC 0008 — Dataset Packaging Standard
- RFC 0035 — Data Provenance Tracking

---

## 2. Motivation

Archive-based dataset packaging is portable, but large datasets often require:

- incremental consumption
- append-only ingestion
- deterministic sharding
- resumable processing

This RFC defines a JSONL-first streaming contract with explicit manifest linkage.

---

## 3. Streaming model

A streaming dataset contains:

- `stream_manifest.json`: stream metadata and source package reference
- `traces.jsonl`: line-delimited RFC 0001 records
- optional sidecar streams (`verifier.jsonl`, `reward.jsonl`)

Each stream record must include stable IDs for trace-level joins.

---

## 4. Stream manifest (JSON)

```json
{
  "stream_version": "0.1",
  "source_dataset": "open-cot-synthetic-seed-v0",
  "schema_target": "schemas/rfc-0001-reasoning.json",
  "record_format": "jsonl",
  "compression": "none",
  "shards": ["traces-00001.jsonl", "traces-00002.jsonl"],
  "ordering": "append_only",
  "id_field": "trace_id"
}
```

---

## 5. Open Questions Resolution (normative closure)

### 5.1 Compression and transport

- **Decision:** Compression is optional but declared (`none`, `gzip`, `zstd`).
- **Rationale:** Throughput requirements differ by environment.
- **Normative requirement:** Producers **MUST** declare compression and record format in the stream manifest.
- **Migration note:** Legacy streams without compression metadata should add a manifest patch.

### 5.2 Ordering and replay

- **Decision:** Append-only ordering is canonical for deterministic replay.
- **Rationale:** Deterministic shard and offset semantics are required for reproducible training/eval.
- **Normative requirement:** Stream producers **MUST** preserve record order within shard and **SHOULD** expose shard-level checksums.
- **Migration note:** Unordered historical streams should be republished with stable shard ordering.

### 5.3 Sidecar linkage

- **Decision:** Sidecar streams are allowed and joined by stable trace IDs.
- **Rationale:** Sidecars evolve independently while preserving core trace compatibility.
- **Normative requirement:** Sidecar records **MUST** include trace ID and schema identifier references.
- **Migration note:** Sidecar files with implicit join keys should be backfilled with explicit IDs.

---

## 6. Acceptance criteria

- At least one stream producer emits schema-valid JSONL traces.
- At least one consumer replays a streamed dataset deterministically.
- Manifest fields are validated in CI for required metadata.

---

## 7. Conclusion

RFC 0012 establishes a practical, reproducible streaming contract for Open CoT datasets while preserving compatibility with package-based workflows.
