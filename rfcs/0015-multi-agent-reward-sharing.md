# RFC 0015 — Multi‑Agent Reward Sharing (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/supernovae/open-cot/issues/15

---

## 1. Summary

This RFC defines the **Multi‑Agent Reward Sharing Standard**, enabling structured reward distribution across multiple collaborating or competing agents.

It extends:

- RFC 0005 — RL Reward Trace Schema  
- RFC 0011 — Multi‑Agent Protocol  

---

## 2. Motivation

Multi‑agent systems require reward sharing for:

- cooperative tasks  
- competitive tasks  
- hierarchical planning  
- self‑play  
- distributed tool use  
- multi‑agent RL  

Without a standard:

- reward propagation is inconsistent  
- training becomes unstable  
- evaluation becomes incomparable  

This RFC defines a **unified reward sharing schema**.

---

## 3. Reward Sharing Models

### 3.1 Cooperative
All agents share the same reward.

### 3.2 Competitive
Agents receive opposing rewards.

### 3.3 Mixed
Some rewards are shared, some are individual.

### 3.4 Hierarchical
Planner receives meta‑reward; executors receive step‑rewards.

### 3.5 Custom
User‑defined reward mapping.

---

## 4. Full Schema (JSON)

    {
      "version": "0.1",
      "trace_id": "string",
      "agents": ["planner", "coder", "verifier"],
      "reward_model": "cooperative",
      "agent_rewards": {
        "planner": 1.0,
        "coder": 1.0,
        "verifier": 1.0
      },
      "metadata": {}
    }

---

## 5. Example: Hierarchical Reward

    {
      "reward_model": "hierarchical",
      "agent_rewards": {
        "planner": 0.5,
        "coder": 1.0,
        "verifier": 0.8
      }
    }

---

## 6. Conclusion

This RFC standardizes reward sharing across multi‑agent systems.
