# RFC 0037 — Token Economy & Cost Modeling (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/supernovae/open-cot/issues/37

---

## 1. Summary

This RFC defines a **token economy and cost modeling standard** for reasoning agents, enabling:

- token budgeting  
- cost‑aware planning  
- cost‑aware tool selection  
- economic constraints on CoT expansion  
- predictable inference costs  

It integrates with:

- RFC 0007 — Agent Loop Protocol  
- RFC 0020 — Scratchpad Compression  

---

## 2. Cost Components

- **model_cost** — tokens in/out  
- **tool_cost** — per‑call cost  
- **memory_cost** — read/write cost  
- **branch_cost** — cost per branch  
- **verification_cost** — verifier calls  

---

## 3. Full Schema (JSON)

```json
{
  "model_cost": {
    "input_tokens": 1200,
    "output_tokens": 800
  },
  "tool_cost": {
    "search": 0.002,
    "calculator": 0.0001
  },
  "total_cost": 0.015
}
```

---

## 4. Example

```json
{
  "total_cost": 0.004
}
```

---

## 5. Conclusion

This RFC defines the economic foundation for cost‑aware reasoning.
