# RFC 0039 — Tool Cost Modeling & Billing Semantics (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/supernovae/open-cot/discussions/39
---

## 1. Summary

This RFC defines **cost modeling for tools**, enabling:

- per‑call billing  
- per‑token billing  
- per‑operation billing  
- cost negotiation  
- cost‑aware tool selection  

It extends:

- RFC 0003 — Tool Invocation Schema  
- RFC 0025 — Tool Marketplace Registry  

---

## 2. Cost Models

- **flat** — fixed per call  
- **per_token** — based on input/output size  
- **tiered** — volume‑based  
- **dynamic** — surge pricing  
- **negotiated** — multi‑agent negotiation  

---

## 3. Full Schema (JSON)

```json
{
  "tool_name": "search",
  "cost_model": "per_token",
  "rate": 0.000001
}
```

---

## 4. Example

```json
{
  "tool_name": "calculator",
  "cost_model": "flat",
  "rate": 0.0001
}
```

---

## 5. Conclusion

This RFC defines cost semantics for tool‑augmented reasoning.
