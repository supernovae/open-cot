# RFC 0040 — Multi‑Agent Economic Incentives (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/<your-org>/<your-repo>/issues/40

---

## 1. Summary

This RFC defines **economic incentive structures** for multi‑agent systems, enabling:

- cooperative incentives  
- competitive incentives  
- shared budgets  
- reward splitting  
- cost attribution  

It extends:

- RFC 0011 — Multi‑Agent Protocol  
- RFC 0015 — Multi‑Agent Reward Sharing  

---

## 2. Incentive Models

- **cooperative** — shared reward  
- **competitive** — zero‑sum  
- **mixed** — hybrid  
- **hierarchical** — planner vs executor  
- **market** — bidding for tasks  

---

## 3. Full Schema (JSON)

    {
      "incentive_model": "cooperative",
      "shared_budget": 0.10,
      "reward_split": {
        "planner": 0.4,
        "executor": 0.6
      }
    }

---

## 4. Example

    {
      "incentive_model": "competitive"
    }

---

## 5. Conclusion

This RFC defines economic coordination for multi‑agent reasoning.
