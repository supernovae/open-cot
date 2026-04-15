# RFC 0005 — RL Reward Trace Schema (R1‑Style)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.2  
**Discussion:** https://github.com/supernovae/open-cot/discussions/5
---

## 1. Summary

This RFC proposes the **RL Reward Trace Schema**, a structured format for representing reinforcement learning (RL) reward signals associated with reasoning traces.  
It extends:

- **RFC 0001** — Reasoning Schema  
- **RFC 0002** — Verifier Output Schema  
- **RFC 0004** — Branching Reasoning Extensions  

This schema is designed to support:

- **R1‑style RL training** (DeepSeek‑R1, Qwen‑R1, etc.)  
- **verifiable scratchpads**  
- **step‑level reward shaping**  
- **branch‑level reward propagation**  
- **trajectory‑level reward aggregation**  
- **multi‑verifier reward fusion**  

The goal is to create a **unified, open standard** for representing RL signals used to train reasoning‑capable LLMs.

---

## 2. Motivation

Modern reasoning models increasingly rely on RL:

- DeepSeek‑R1 uses verifiable intermediate steps to generate reward signals.  
- Qwen‑R1 uses step‑level reward shaping and long‑horizon credit assignment.  
- OpenAI’s o‑series uses structured scratchpads with verifiable steps.  
- RLHF and RLAIF pipelines require structured reward traces.  

However:

- There is **no open standard** for representing RL reward traces.  
- Existing RL pipelines use incompatible formats.  
- Datasets cannot share reward‑annotated reasoning traces.  
- Verifier outputs and reward signals are not integrated.  
- Branching reasoning (ToT/GoT) requires reward propagation across paths.

This RFC defines a **model‑agnostic, interoperable reward trace schema**.

---

## 3. Design Goals

### 3.1 Must‑Have Goals
- Support **step‑level**, **branch‑level**, and **trajectory‑level** rewards.  
- Integrate cleanly with RFC 0001, 0002, and 0004.  
- Support **multiple reward sources** (verifiers, heuristics, human feedback).  
- Support **reward shaping** and **credit assignment**.  
- Support **RL training pipelines** (PPO, GRPO, DPO‑R, etc.).  
- Support **R1‑style verifiable scratchpads**.

### 3.2 Non‑Goals
- Defining a specific RL algorithm.  
- Defining a universal reward function.  
- Encoding model weights or gradients.  
- Representing full training logs.

---

## 4. Reward Model

A reward trace may include:

- **step_rewards** — reward for each reasoning step  
- **branch_rewards** — reward for each branch (ToT/GoT)  
- **trajectory_reward** — reward for the entire reasoning trajectory  
- **reward_sources** — verifiers, heuristics, human feedback, etc.  
- **credit_assignment** — how rewards propagate backward  

This schema supports:

- sparse rewards  
- dense rewards  
- shaped rewards  
- multi‑source reward fusion  
- RLHF / RLAIF / verifier‑based RL  

---

## 5. Full Schema (JSON)

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "OpenCoT RL Reward Trace v0.1",
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

    "reward_sources": {
      "type": "array",
      "description": "List of reward sources (verifiers, heuristics, humans, etc.).",
      "items": { "type": "string" }
    },

    "step_rewards": {
      "type": "array",
      "description": "Reward assigned to each reasoning step.",
      "items": {
        "type": "object",
        "properties": {
          "step_id": {
            "type": "string",
            "description": "ID of the step being rewarded."
          },
          "reward": {
            "type": "number",
            "description": "Reward value for this step."
          },
          "source": {
            "type": "string",
            "description": "Source of the reward (verifier, heuristic, human)."
          }
        },
        "required": ["step_id", "reward"]
      }
    },

    "branch_rewards": {
      "type": "array",
      "description": "Reward assigned to branches (ToT/GoT).",
      "items": {
        "type": "object",
        "properties": {
          "branch_group": {
            "type": "string",
            "description": "Branch group ID (RFC 0004)."
          },
          "path_id": {
            "type": "string",
            "description": "Path identifier for this branch."
          },
          "reward": {
            "type": "number",
            "description": "Reward for this branch."
          }
        },
        "required": ["reward"]
      }
    },

    "trajectory_reward": {
      "type": "number",
      "description": "Reward for the entire reasoning trajectory."
    },

    "credit_assignment": {
      "type": "string",
      "enum": ["monte_carlo", "temporal_difference", "heuristic", "unknown"],
      "description": "Method used to propagate rewards backward."
    }
  },

  "required": ["version"]
}
```
<!-- opencot:schema:end -->


## 6. Example: R1-Style Reward Trace

```json
{
  "version": "0.1",
  "trace_id": "trace_001",
  "reward_sources": ["symbolic_verifier", "heuristic_scoring"],

  "step_rewards": [
    { "step_id": "s2", "reward": 1.0, "source": "symbolic_verifier" },
    { "step_id": "s3", "reward": 1.0, "source": "symbolic_verifier" },
    { "step_id": "s4", "reward": 1.0, "source": "symbolic_verifier" }
  ],

  "trajectory_reward": 1.0,
  "credit_assignment": "monte_carlo"
}
```

## 7. Example: Branch-Level Reward (ToT)

```json
{
  "branch_rewards": [
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

## 8. Open Questions Resolution (normative closure)

### 8.1 Reward shape and uncertainty

- **Decision:** Negative rewards, normalization, trajectory aggregation, and uncertainty estimates are all supported.
- **Rationale:** RL-style learning requires penalties and confidence-aware reward interpretation.
- **Normative requirement:** Reward values **SHOULD** be normalized to [-1,1]; uncertainty **MAY** be included as optional fields (`stddev`, `confidence_interval`).
- **Migration note:** Unbounded historical rewards should be transformed via documented normalization policy.

### 8.2 Source harmonization

- **Decision:** RLHF and RLAIF remain provenance distinctions, not schema forks.
- **Rationale:** A common reward envelope keeps datasets interoperable.
- **Normative requirement:** Multi-source reward traces **MUST** include source identifiers and fusion policy metadata when combined.
- **Migration note:** Pipelines with source-specific structures should map into shared reward objects with explicit source tags.

### 8.3 Storage model

- **Decision:** Detached reward traces remain canonical for reproducibility and modularity.
- **Rationale:** Sidecar storage supports independent recomputation and audit.
- **Normative requirement:** Reward traces **MUST** reference stable trace/step IDs from RFC 0001 artifacts. Embedded rewards **MAY** be emitted as convenience copies only.
- **Migration note:** Embedded-only workflows should adopt sidecar emission to satisfy long-term interoperability requirements.

## 9. Acceptance Criteria
This RFC will be accepted when:

At least 3 maintainers approve it.
A reference implementation can parse reward traces.
At least one RL pipeline emits this schema.
At least one dataset includes reward‑annotated traces.

## 10. Conclusion
This RFC introduces the RL Reward Trace Schema, enabling:

R1‑style RL training
verifiable scratchpads
step‑level reward shaping
branch‑level reward propagation
trajectory‑level reward aggregation

multi‑source reward fusion
