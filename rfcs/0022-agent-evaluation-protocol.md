# RFC 0022 — Agent Evaluation Protocol (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/supernovae/open-cot/issues/22

---

## 1. Summary

This RFC defines a reproducible evaluation contract for Open CoT systems.

It standardizes:

- metric groups and reporting fields
- leakage and split-governance checks
- run reproducibility metadata
- confidence and variance reporting

It integrates RFC 0001 (trace), RFC 0008 (dataset packaging), RFC 0029 (benchmark dataset), and RFC 0031 (telemetry).

---

## 2. Methodology requirements

### 2.1 Anti-leakage policy

- Train/eval split boundaries must be declared.
- Hidden holdout identifiers must never appear in training sources.
- Prompt-template version and data snapshot hash must be recorded.

### 2.2 Reproducibility policy

- Runs must declare seed, decoding config, model revision, and harness version.
- Aggregated metrics must include sample count and variance summary.

### 2.3 Reporting policy

- Report final-answer correctness, schema validity rate, and step-validity proxy at minimum.
- Safety and policy violations must be included when applicable.

---

## 3. Full Schema (JSON)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0022 — Agent Evaluation Protocol",
  "type": "object",
  "properties": {
    "version": { "type": "string", "enum": ["0.1"] },
    "run_id": { "type": "string" },
    "model": { "type": "string" },
    "dataset_version": { "type": "string" },
    "harness_version": { "type": "string" },
    "reproducibility": {
      "type": "object",
      "properties": {
        "seed": { "type": "integer" },
        "temperature": { "type": "number" },
        "top_p": { "type": "number" },
        "max_tokens": { "type": "integer" },
        "prompt_hash": { "type": "string" },
        "output_hash": { "type": "string" }
      },
      "required": ["seed", "temperature", "top_p", "max_tokens"]
    },
    "metrics": {
      "type": "object",
      "properties": {
        "final_answer_exact": { "type": "number", "minimum": 0, "maximum": 1 },
        "schema_validity_rate": { "type": "number", "minimum": 0, "maximum": 1 },
        "step_validity_proxy": { "type": "number", "minimum": 0, "maximum": 1 },
        "safety_violations": { "type": "integer", "minimum": 0 }
      },
      "required": ["final_answer_exact", "schema_validity_rate", "step_validity_proxy"]
    },
    "statistics": {
      "type": "object",
      "properties": {
        "num_tasks": { "type": "integer", "minimum": 1 },
        "confidence_interval_95": { "type": "array", "items": { "type": "number" }, "minItems": 2, "maxItems": 2 },
        "stddev": { "type": "number", "minimum": 0 }
      },
      "required": ["num_tasks"]
    }
  },
  "required": ["version", "run_id", "model", "dataset_version", "harness_version", "reproducibility", "metrics", "statistics"]
}
```

---

## 4. Example

```json
{
  "version": "0.1",
  "run_id": "eval-2026-04-14-001",
  "model": "example/local-2b-instruct",
  "dataset_version": "benchmarks-0.1.0",
  "harness_version": "mock-harness-0.1.0",
  "reproducibility": {
    "seed": 42,
    "temperature": 0.0,
    "top_p": 1.0,
    "max_tokens": 256,
    "prompt_hash": "sha256:abc",
    "output_hash": "sha256:def"
  },
  "metrics": {
    "final_answer_exact": 0.83,
    "schema_validity_rate": 0.99,
    "step_validity_proxy": 0.93,
    "safety_violations": 0
  },
  "statistics": {
    "num_tasks": 250,
    "confidence_interval_95": [0.79, 0.87],
    "stddev": 0.07
  }
}
```

---

## 5. Conclusion

RFC 0022 defines a rigorous and reproducible evaluation protocol that reduces benchmark leakage risk and makes OSS comparisons auditable.
