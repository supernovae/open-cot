# RFC 0006 — Multi‑Verifier Ensemble Schema
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.3  
**Discussion:** https://github.com/supernovae/open-cot/issues/6

---

## 1. Summary

This RFC defines the **Multi‑Verifier Ensemble Schema**, a structured format for combining outputs from multiple verifiers into a unified correctness and reward signal.

It extends:

- **RFC 0001** — Reasoning Schema  
- **RFC 0002** — Verifier Output Schema  
- **RFC 0005** — RL Reward Trace Schema  

This schema supports:

- symbolic + neural verifier fusion  
- majority voting  
- weighted ensembles  
- confidence‑weighted aggregation  
- error‑type reconciliation  
- reward fusion for RL training  
- verifier disagreement analysis  

The goal is to provide a **standard, interoperable ensemble format** for reasoning evaluation and RL pipelines.

---

## 2. Motivation

Modern reasoning systems increasingly rely on **multiple verifiers**, such as:

- symbolic math verifiers  
- neural verifiers  
- rule‑based validators  
- tool‑specific validators  
- human feedback  
- heuristic scoring functions  

Each verifier has different strengths:

- symbolic verifiers are precise but narrow  
- neural verifiers are broad but probabilistic  
- heuristics are fast but noisy  
- humans are accurate but expensive  

To train and evaluate reasoning models effectively, we need:

- a unified representation of verifier outputs  
- a standard way to combine them  
- a way to track disagreement  
- a way to compute fused correctness and reward signals  

This RFC defines that standard.

---

## 3. Design Goals

### 3.1 Must‑Have Goals
- Support **multiple verifier outputs** per step.  
- Support **ensemble fusion strategies**.  
- Support **confidence‑weighted aggregation**.  
- Support **reward fusion** for RL.  
- Support **disagreement analysis**.  
- Maintain compatibility with RFC 0002 and RFC 0005.

### 3.2 Non‑Goals
- Defining a universal ensemble algorithm.  
- Enforcing a specific reward function.  
- Representing full verifier internals.  
- Encoding model weights or training logs.

---

## 4. Ensemble Model

A multi‑verifier ensemble consists of:

- **verifier_outputs[]** — raw outputs from each verifier  
- **fusion_strategy** — how to combine them  
- **fused_step_results[]** — final correctness per step  
- **fused_rewards[]** — final reward per step  
- **disagreement_metrics** — optional diagnostics  

Supported fusion strategies include:

- majority_vote  
- weighted_vote  
- confidence_weighted  
- max_confidence  
- min_confidence  
- average_reward  
- custom  

---

## 5. Full Schema (JSON)

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "OpenCoT Multi-Verifier Ensemble v0.1",
  "type": "object",

  "properties": {
    "version": {
      "type": "string",
      "enum": ["0.1"],
      "description": "Schema version."
    },

    "trace_id": {
      "type": "string",
      "description": "ID linking to a reasoning trace (RFC 0001)."
    },

    "verifier_outputs": {
      "type": "array",
      "description": "List of raw verifier outputs (RFC 0002).",
      "items": {
        "type": "object",
        "description": "A single verifier's output."
      }
    },

    "fusion_strategy": {
      "type": "string",
      "enum": [
        "majority_vote",
        "weighted_vote",
        "confidence_weighted",
        "max_confidence",
        "min_confidence",
        "average_reward",
        "custom"
      ],
      "description": "Strategy used to combine verifier outputs."
    },

    "weights": {
      "type": "object",
      "description": "Optional weights for weighted fusion strategies.",
      "additionalProperties": { "type": "number" }
    },

    "fused_step_results": {
      "type": "array",
      "description": "Final correctness judgments per step.",
      "items": {
        "type": "object",
        "properties": {
          "step_id": { "type": "string" },
          "correct": {
            "type": "string",
            "enum": ["true", "false", "unknown"]
          },
          "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          }
        },
        "required": ["step_id", "correct"]
      }
    },

    "fused_rewards": {
      "type": "array",
      "description": "Final reward values per step (RFC 0005).",
      "items": {
        "type": "object",
        "properties": {
          "step_id": { "type": "string" },
          "reward": { "type": "number" }
        },
        "required": ["step_id", "reward"]
      }
    },

    "disagreement_metrics": {
      "type": "object",
      "description": "Optional diagnostics about verifier disagreement.",
      "properties": {
        "num_verifiers": { "type": "number" },
        "num_disagreements": { "type": "number" },
        "disagreement_rate": { "type": "number" }
      }
    }
  },

  "required": ["version", "verifier_outputs", "fusion_strategy"]
}
<!-- opencot:schema:end -->

## 6. Example: Majority Vote Ensemble

```json
{
  "version": "0.1",
  "trace_id": "trace_001",
  "fusion_strategy": "majority_vote",

  "verifier_outputs": [
    { "verifier": "symbolic_math", "results": [...] },
    { "verifier": "neural_verifier", "results": [...] },
    { "verifier": "heuristic_checker", "results": [...] }
  ],

  "fused_step_results": [
    { "step_id": "s2", "correct": "true", "confidence": 0.67 },
    { "step_id": "s3", "correct": "true", "confidence": 1.0 },
    { "step_id": "s4", "correct": "true", "confidence": 0.67 }
  ],

  "fused_rewards": [
    { "step_id": "s2", "reward": 1.0 },
    { "step_id": "s3", "reward": 1.0 },
    { "step_id": "s4", "reward": 1.0 }
  ]
}


## 7. Example: Confidence-Weighted Fusion

```json
{
  "fusion_strategy": "confidence_weighted",
  "weights": {
    "symbolic_math": 1.0,
    "neural_verifier": 0.5
  }
}

## 8. Open Questions Resolution (normative closure)

### 8.1 Ensemble structure and reliability

- **Decision:** Per-verifier scaling, hierarchical ensembles, and reliability tracking are supported.
- **Rationale:** Ensemble quality depends on calibrated member weighting and historical verifier behavior.
- **Normative requirement:** Ensemble entries **SHOULD** include per-member identifiers and optional reliability metrics; hierarchical ensembles **MAY** be represented recursively.
- **Migration note:** Flat ensembles can be upgraded incrementally by adding optional nested group fields.

### 8.2 Disagreement and normalization policy

- **Decision:** Disagreement metric and conflict-resolution strategy must be declared when fused outputs are emitted.
- **Rationale:** Reproducibility requires explicit strategy metadata.
- **Normative requirement:** Fused ensemble outputs **MUST** include named strategies for disagreement scoring and conflict handling; reward normalization **SHOULD** follow RFC 0005 defaults.
- **Migration note:** Existing unnamed fusion heuristics should be converted into explicit strategy labels.

### 8.3 Storage form

- **Decision:** Ensembles are stored as detached sidecars by default.
- **Rationale:** Detached artifacts improve composability and independent auditing.
- **Normative requirement:** Ensemble records **MUST** reference source verifier outputs by stable IDs. Embedded mirrors **MAY** be emitted for convenience.
- **Migration note:** Embedded-only systems should emit detached sidecars before deprecating legacy readers.

## 9. Acceptance Criteria

This RFC will be accepted when:

At least 3 maintainers approve it.
A reference implementation can fuse multiple verifier outputs.
At least one RL pipeline uses ensemble rewards.
At least one dataset includes ensemble‑annotated traces.


## 10. Conclusion
This RFC introduces the Multi‑Verifier Ensemble Schema, enabling:

robust correctness judgments
stable RL reward signals
multi‑source verification
disagreement analysis
cross‑framework interoperability
