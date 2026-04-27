# RFC 0015 — Multi‑Cognitive pipeline Reward Sharing (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/supernovae/open-cot/discussions/15
---

## 1. Summary

This RFC defines the **Multi‑Cognitive pipeline Reward Sharing Standard**, enabling structured reward distribution across multiple collaborating or competing pipelines.

It extends:

- RFC 0005 — RL Reward Trace Schema  
- RFC 0011 — Multi‑Cognitive pipeline Protocol  

---

## 2. Motivation

Multi‑cognitive pipeline systems require reward sharing for:

- cooperative tasks  
- competitive tasks  
- hierarchical planning  
- self‑play  
- distributed tool use  
- multi‑cognitive pipeline RL  

Without a standard:

- reward propagation is inconsistent  
- training becomes unstable  
- evaluation becomes incomparable  

This RFC defines a **unified reward sharing schema**.

---

## 3. Reward Sharing Models

### 3.1 Cooperative
All pipelines share the same reward.

### 3.2 Competitive
Pipelines receive opposing rewards.

### 3.3 Mixed
Some rewards are shared, some are individual.

### 3.4 Hierarchical
Planner receives meta‑reward; executors receive step‑rewards.

### 3.5 Custom
User‑defined reward mapping.

---

## 4. Full Schema (JSON)

```json
{
  "version": "0.1",
  "trace_id": "string",
  "pipelines": ["planner", "coder", "verifier"],
  "reward_model": "cooperative",
  "agent_rewards": {
    "planner": 1.0,
    "coder": 1.0,
    "verifier": 1.0
  },
  "metadata": {}
}
```

---

## 5. Example: Hierarchical Reward

```json
{
  "reward_model": "hierarchical",
  "agent_rewards": {
    "planner": 0.5,
    "coder": 1.0,
    "verifier": 0.8
  }
}
```

---

## 6. Conclusion

This RFC standardizes reward sharing across multi‑cognitive pipeline systems.
