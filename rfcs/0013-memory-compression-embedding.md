# RFC 0013 — Memory Compression & Embedding (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/supernovae/open-cot/discussions/13
---

## 1. Summary

This RFC defines standards for **compressing, embedding, and summarizing agent memory** to support scalable long‑term memory (LTM) and efficient retrieval.

It extends:

- RFC 0010 — Agent Memory Schema  
- RFC 0007 — Agent Loop Protocol  

---

## 2. Motivation

Agents accumulate:

- thousands of STM entries  
- millions of LTM entries  
- episodic logs  
- tool state  

Without compression:

- memory becomes unbounded  
- retrieval becomes slow  
- serialization becomes expensive  

This RFC defines **compression, summarization, and embedding formats**.

---

## 3. Design Goals

- Support lossy and lossless compression  
- Support embedding‑based memory  
- Support summarization chains  
- Support provenance tracking  
- Support deterministic replay  

---

## 4. Compression Model

Memory entries may include:

- `raw_value`  
- `compressed_value`  
- `embedding`  
- `summary`  
- `provenance`  

---

## 5. Full Schema (JSON)

```json
{
  "key": "string",
  "raw_value": {},
  "compressed_value": "string",
  "embedding": { "vector": [], "dim": 0 },
  "summary": "string",
  "provenance": {
    "created_at": "string",
    "updated_at": "string",
    "source": "string"
  }
}
```

---

## 6. Example

```json
{
  "key": "project_history",
  "summary": "Agent completed 12 tasks related to GPU provisioning.",
  "embedding": { "vector": [0.12, 0.44], "dim": 2 }
}
```

---

## 7. Open Questions Resolution (normative closure)

### 7.1 Embedding normalization

- **Decision:** Embedding normalization is recommended, with metric declaration required.
- **Rationale:** Retrieval comparability depends on known similarity semantics.
- **Normative requirement:** Embedding records **SHOULD** include normalization status and distance metric metadata.
- **Migration note:** Existing vectors without metric metadata should be backfilled in index manifests.

### 7.2 Compression pluggability

- **Decision:** Compression strategies are pluggable via named strategy identifiers.
- **Rationale:** Different memory workloads require different compression trade-offs.
- **Normative requirement:** Compression pipelines **MUST** declare compressor name and version in output metadata.
- **Migration note:** Custom compressors should define stable IDs before being used in shared datasets.

### 7.3 Summarization chain

- **Decision:** Canonical summarization output interface is standardized; algorithm remains implementation-defined.
- **Rationale:** Standardized outputs preserve interoperability while leaving room for innovation.
- **Normative requirement:** Summaries **MUST** preserve source linkage and confidence metadata when source evidence is condensed.
- **Migration note:** Existing summaries without source linkage should add provenance references.

---

## 8. Conclusion

This RFC defines **memory compression and embedding standards**, enabling scalable long‑term memory.
