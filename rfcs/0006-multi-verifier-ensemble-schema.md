# RFC 0006 — Multi‑Verifier Ensemble Schema
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.3  
**Discussion:** https://github.com/<your-org>/<your-repo>/issues/6

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
