# RFC 0038 — Cost‑Aware Reasoning & Budget Enforcement (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/<your-org>/<your-repo>/issues/38

---

## 1. Summary

This RFC defines **cost‑aware reasoning**, enabling agents to:

- reason under token budgets  
- prune branches based on cost  
- choose cheaper tools  
- compress scratchpads to save tokens  
- enforce hard budget ceilings  

It extends:

- RFC 0037 — Token Economy & Cost Modeling  

---

## 2. Budget Types

- **hard_budget** — cannot exceed  
- **soft_budget** — may exceed with penalty  
- **branch_budget** — per branch  
- **tool_budget** — per tool  

---

## 3. Full Schema (JSON)

    {
      "budget": {
        "max_tokens": 5000,
        "max_cost": 0.10
      },
      "enforcement": "hard"
    }

---

## 4. Example

    {
      "budget": { "max_tokens": 2000 }
    }

---

## 5. Conclusion

This RFC defines how agents reason within explicit economic constraints.
