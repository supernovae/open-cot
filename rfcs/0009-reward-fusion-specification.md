# RFC 0009 — Reward Fusion Specification (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.3  
**Discussion:** https://github.com/supernovae/open-cot/issues/9

---

## 1. Summary

This RFC defines the **Reward Fusion Specification**, a standard for combining multiple reward signals into a unified reward trace suitable for RL training, evaluation, and reasoning‑quality optimization.

It extends:

- RFC 0005 — RL Reward Trace Schema  
- RFC 0006 — Multi‑Verifier Ensemble Schema  
- RFC 0007 — Agent Loop Protocol  

The goal is to provide a **consistent, transparent, and reproducible** method for merging:

- verifier‑based rewards  
- heuristic rewards  
- human feedback rewards  
- branch‑level rewards  
- trajectory‑level rewards  
- ensemble‑derived rewards  

into a single, fused reward signal.

---

## 2. Motivation

Modern reasoning models (DeepSeek‑R1, Qwen‑R1, etc.) rely on **multiple reward sources**, including:

- symbolic verifiers  
- neural verifiers  
- rule‑based heuristics  
- human preference models  
- branch‑level search scores  
- trajectory‑level correctness signals  

However:

- Reward signals often conflict.  
- Pipelines use incompatible fusion strategies.  
- RL training requires a single scalar reward per step or trajectory.  
- Datasets cannot share fused reward traces without a standard.  
- Ensemble verifiers (RFC 0006) require downstream fusion.  

This RFC defines a **unified reward fusion standard** to ensure interoperability across datasets, RL pipelines, and agent frameworks.

---

## 3. Design Goals

### 3.1 Must‑Have Goals
- Support step‑level, branch‑level, and trajectory‑level reward fusion.  
- Support multiple fusion strategies.  
- Support weighted and confidence‑weighted fusion.  
- Support deterministic and reproducible fusion.  
- Integrate cleanly with RFC 0005 and RFC 0006.  
- Support RL‑ready scalar reward outputs.

### 3.2 Non‑Goals
- Defining a universal reward function.  
- Mandating a specific RL algorithm.  
- Encoding model weights or training logs.  
- Replacing verifier outputs or ensemble outputs.

---

## 4. Reward Fusion Model

Reward fusion operates over three levels:

1. **Step‑level fusion**  
   Combine rewards for individual reasoning steps.

2. **Branch‑level fusion**  
   Combine rewards for alternative reasoning paths (ToT/GoT).

3. **Trajectory‑level fusion**  
   Combine global rewards for the entire reasoning trace.

Each level may use different fusion strategies.

---

## 5. Fusion Strategies

The following strategies MUST be supported:

### 5.1 `sum`
Add all reward signals.

### 5.2 `mean`
Average all reward signals.

### 5.3 `weighted`
Use user‑provided weights.

### 5.4 `confidence_weighted`
Use verifier confidence as weights.

### 5.5 `max`
Take the maximum reward.

### 5.6 `min`
Take the minimum reward.

### 5.7 `product`
Multiply reward signals (useful for multiplicative penalties).

### 5.8 `custom`
User‑defined fusion logic (metadata required).

---

## 6. Full Schema (JSON)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "OpenCoT Reward Fusion Specification v0.1",
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

    "fusion_strategy": {
      "type": "string",
      "enum": [
        "sum",
        "mean",
        "weighted",
        "confidence_weighted",
        "max",
        "min",
        "product",
        "custom"
      ],
      "description": "Strategy used to fuse reward signals."
    },

    "weights": {
      "type": "object",
      "description": "Optional weights for weighted fusion strategies.",
      "additionalProperties": { "type": "number" }
    },

    "step_fusion": {
      "type": "array",
      "description": "Fused step-level rewards.",
      "items": {
        "type": "object",
        "properties": {
          "step_id": { "type": "string" },
          "reward": { "type": "number" },
          "sources": {
            "type": "array",
            "items": { "type": "string" }
          }
        },
        "required": ["step_id", "reward"]
      }
    },

    "branch_fusion": {
      "type": "array",
      "description": "Fused branch-level rewards.",
      "items": {
        "type": "object",
        "properties": {
          "branch_group": { "type": "string" },
          "path_id": { "type": "string" },
          "reward": { "type": "number" }
        },
        "required": ["reward"]
      }
    },

    "trajectory_reward": {
      "type": "number",
      "description": "Final fused reward for the entire trajectory."
    },

    "metadata": {
      "type": "object",
      "description": "Optional metadata for custom fusion strategies."
    }
  },

  "required": ["version", "fusion_strategy"]
}
```

---

## 7. Example: Confidence‑Weighted Step Fusion

```json
{
  "version": "0.1",
  "trace_id": "trace_001",
  "fusion_strategy": "confidence_weighted",

  "step_fusion": [
    {
      "step_id": "s2",
      "reward": 0.98,
      "sources": ["symbolic_verifier", "neural_verifier"]
    }
  ],

  "trajectory_reward": 0.98
}
```

---

## 8. Example: Weighted Branch Fusion

```json
{
  "fusion_strategy": "weighted",
  "weights": {
    "symbolic_verifier": 1.0,
    "heuristic": 0.5
  },
  "branch_fusion": [
    {
      "branch_group": "g1",
      "path_id": "p1",
      "reward": 0.72
    },
    {
      "branch_group": "g1",
      "path_id": "p2",
      "reward": 0.64
    }
  ]
}
```

---

## 9. Open Questions Resolution (normative closure)

### 9.1 Fusion-time transforms

- **Decision:** Clipping, normalization, smoothing, and discounting are supported through explicit `fusion_config` metadata.
- **Rationale:** Reward fusion must be reproducible across pipelines.
- **Normative requirement:** If any transform is applied, the transform parameters **MUST** be serialized in the fusion artifact.
- **Migration note:** Pipelines that used implicit transforms should backfill config metadata for historical runs.

### 9.2 Scale and uncertainty

- **Decision:** Canonical fused reward scale is normalized to [-1,1], with optional uncertainty metadata.
- **Rationale:** Comparable fused outputs need a common numeric envelope.
- **Normative requirement:** Fused reward outputs **SHOULD** be normalized to [-1,1]; uncertainty **MAY** include interval or variance fields.
- **Migration note:** Non-normalized fused values should include a one-time conversion note in release documentation.

### 9.3 Storage model

- **Decision:** Fusion artifacts remain detached sidecars.
- **Rationale:** Detached form supports independent recomputation and auditability.
- **Normative requirement:** Fusion outputs **MUST** reference source trace and reward IDs. Embedded summaries **MAY** exist but are non-authoritative.
- **Migration note:** Embedded-only fusion output should transition to detached canonical files before deprecating old readers.

---

## 10. Acceptance Criteria

This RFC will be accepted when:

- At least 3 maintainers approve it.  
- A reference implementation performs reward fusion.  
- At least one RL pipeline consumes fused rewards.  
- At least one dataset includes fused reward traces.

---

## 11. Conclusion

This RFC defines the **Reward Fusion Specification**, enabling:

- unified reward signals  
- multi‑verifier integration  
- RL‑ready reward traces  
- consistent evaluation  
- reproducible training  
