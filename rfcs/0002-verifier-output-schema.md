# RFC 0002 — Verifier Output Schema (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.1  
**Discussion:** https://github.com/<your-org>/<your-repo>/issues/2

---

## 1. Summary

This RFC proposes the **Verifier Output Schema**, a structured format for representing the results of step‑level verification applied to reasoning traces.  
It complements RFC 0001 (Initial Reasoning Schema) by defining how external verifiers — symbolic, neural, hybrid, or rule‑based — report:

- correctness  
- confidence  
- error types  
- justifications  
- reward signals (optional)  

This schema is designed to support:

- step‑level correctness checking  
- RL reward shaping (R1‑style training)  
- long‑horizon reasoning stability  
- dataset labeling  
- automated evaluation pipelines  
- multi‑verifier ensembles  

---

## 2. Motivation

Modern reasoning models increasingly rely on **verifiable intermediate steps**:

- DeepSeek‑R1 uses verifiable scratchpads for RL.  
- Qwen‑R1 uses step‑level reward shaping.  
- “Let’s Verify Step by Step” shows verification dramatically improves accuracy.  
- Math and logic tasks require symbolic correctness.  
- Agent frameworks need to validate tool outputs and reasoning transitions.

However, there is **no open standard** for representing verifier outputs.

This leads to:

- incompatible formats across projects  
- difficulty comparing verifier performance  
- inconsistent RL reward signals  
- fragmented evaluation pipelines  
- inability to share verified datasets  

This RFC defines a **unified, model‑agnostic schema** for verifier outputs.

---

## 3. Design Goals

### 3.1 Must‑Have Goals
- **Compatible with RFC 0001** (step IDs, structure).  
- **Supports multiple verifier types** (symbolic, neural, hybrid).  
- **Captures correctness, confidence, and justification.**  
- **Supports RL reward shaping** (optional).  
- **Extensible** for future verifier types.  
- **Minimal** enough for adoption.

### 3.2 Non‑Goals
- Defining how verifiers work internally.  
- Mandating a specific reward function.  
- Requiring symbolic or neural verification.  
- Enforcing a single correctness metric.

---

## 4. Verifier Output Overview

A **Verifier Output** is a mapping from:

step_id → verification_result


Each verification result includes:

- correctness (`true`, `false`, `unknown`)  
- confidence (0–1)  
- error type (optional)  
- justification (optional natural language)  
- reward (optional numeric signal)  
- metadata (optional)  

---

## 5. Full Schema (JSON)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "OpenCoT Verifier Output v0.1",
  "type": "object",

  "properties": {
    "version": {
      "type": "string",
      "enum": ["0.1"],
      "description": "Schema version."
    },

    "trace_id": {
      "type": "string",
      "description": "Optional ID linking to a reasoning trace."
    },

    "verifier": {
      "type": "string",
      "description": "Name or identifier of the verifier."
    },

    "results": {
      "type": "array",
      "description": "Verification results for each reasoning step.",
      "items": {
        "type": "object",
        "properties": {
          "step_id": {
            "type": "string",
            "description": "ID of the step being verified (matches RFC 0001)."
          },

          "correct": {
            "type": "string",
            "enum": ["true", "false", "unknown"],
            "description": "Whether the step is correct."
          },

          "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "Verifier confidence in the correctness judgment."
          },

          "error_type": {
            "type": "string",
            "description": "Optional classification of the error.",
            "enum": [
              "arithmetic",
              "logical",
              "factual",
              "hallucination",
              "unsupported_claim",
              "invalid_tool_use",
              "format_error",
              "other"
            ]
          },

          "justification": {
            "type": "string",
            "description": "Optional natural-language explanation of the verdict."
          },

          "reward": {
            "type": "number",
            "description": "Optional RL reward signal for this step."
          },

          "metadata": {
            "type": "object",
            "description": "Optional additional verifier-specific metadata."
          }
        },
        "required": ["step_id", "correct"]
      }
    }
  },

  "required": ["version", "results"]
}

## 6. Example

### 6.1 Verifier Output for a Simple Math Trace

{
  "version": "0.1",
  "trace_id": "trace_001",
  "verifier": "symbolic_math_v1",

  "results": [
    {
      "step_id": "s2",
      "correct": "true",
      "confidence": 0.99,
      "justification": "17 * 20 = 340 is correct."
    },
    {
      "step_id": "s3",
      "correct": "true",
      "confidence": 0.98,
      "justification": "17 * 3 = 51 is correct."
    },
    {
      "step_id": "s4",
      "correct": "true",
      "confidence": 0.97,
      "justification": "340 + 51 = 391 is correct.",
      "reward": 1.0
    }
  ]
}


## 7. Open Questions

### 7.1 Should we support:

multi‑verifier ensembles?

verifier disagreement resolution?

symbolic proof objects?

tool‑specific verification schemas?

### 7.2 Should reward be:

bounded (e.g., −1 to +1)?

normalized?

optional or required for RL traces?

### 7.3 Should we define:

a standard taxonomy of error types?

a standard for verifier confidence calibration?


## 8. Acceptance Criteria

This RFC will be accepted when:

At least 3 maintainers approve it.
A reference implementation can validate verifier outputs.
At least one verifier (symbolic or neural) emits this format.
At least one reasoning trace (RFC 0001) is paired with verifier output.

## 9. Conclusion

This RFC establishes the Verifier Output Schema, enabling:

* step‑level correctness checking
* structured evaluation
* RL reward shaping
* dataset labeling
* multi‑verifier pipelines

Together with RFC 0001, it forms the foundation of a fully open, structured reasoning ecosystem.