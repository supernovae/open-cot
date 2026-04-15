# RFC 0014 — Memory Conflict Resolution (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/supernovae/open-cot/discussions/14
---

## 1. Summary

This RFC defines the **Memory Conflict Resolution Standard**, a unified mechanism for resolving conflicting entries in agent memory, including:

- short‑term memory (STM)  
- long‑term memory (LTM)  
- episodic memory  
- tool memory  
- compressed/embedded memory (RFC 0013)

It extends:

- RFC 0010 — Agent Memory Schema  
- RFC 0013 — Memory Compression & Embedding  

---

## 2. Motivation

Agents accumulate memory from:

- multiple tools  
- multiple agents (RFC 0011)  
- multiple episodes  
- multiple verifiers  
- multiple reward signals  

Conflicts arise when:

- two entries have the same key  
- two entries disagree  
- two entries differ in confidence  
- two entries differ in provenance  
- two entries differ in timestamp  

This RFC defines a **deterministic, reproducible conflict resolution algorithm**.

---

## 3. Design Goals

- Deterministic conflict resolution  
- Support for confidence‑weighted merging  
- Support for timestamp‑based precedence  
- Support for provenance‑aware resolution  
- Support for lossy and lossless merging  
- Support for multi‑agent memory isolation  

---

## 4. Conflict Types

### 4.1 Key Collision
Two entries share the same key.

### 4.2 Value Disagreement
Two entries disagree on content.

### 4.3 Provenance Conflict
Entries originate from different sources with different trust levels.

### 4.4 Timestamp Conflict
Newer vs older entries.

### 4.5 Confidence Conflict
Entries have different confidence scores.

---

## 5. Resolution Strategies

### 5.1 `prefer_newest`
Choose the entry with the latest timestamp.

### 5.2 `prefer_highest_confidence`
Choose the entry with the highest confidence.

### 5.3 `weighted_merge`
Merge values using confidence weights.

### 5.4 `provenance_priority`
Use a predefined trust hierarchy.

### 5.5 `custom`
User‑defined logic.

---

## 6. Full Schema (JSON)

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0014 — Memory Conflict Resolution",
  "type": "object",
  "properties": {
    "version": { "type": "string", "enum": ["0.1"] },
    "key": { "type": "string" },
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "value": {},
          "timestamp": { "type": "string", "format": "date-time" },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "provenance": { "type": "string" }
        },
        "required": ["value"]
      },
      "minItems": 1
    },
    "resolution_strategy": {
      "type": "string",
      "enum": [
        "prefer_newest",
        "prefer_highest_confidence",
        "weighted_merge",
        "provenance_priority",
        "custom"
      ]
    },
    "resolved_value": {}
  },
  "required": ["version", "key", "entries", "resolution_strategy", "resolved_value"]
}
```
<!-- opencot:schema:end -->

---

## 7. Example

```json
{
  "version": "0.1",
  "key": "preferred_units",
  "entries": [
    { "value": "metric", "confidence": 0.95 },
    { "value": "imperial", "confidence": 0.40 }
  ],
  "resolution_strategy": "prefer_highest_confidence",
  "resolved_value": "metric"
}
```

---

## 8. Conclusion

This RFC defines deterministic, reproducible memory conflict resolution for all agent memory types.
