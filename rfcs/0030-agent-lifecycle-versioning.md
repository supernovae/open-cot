# RFC 0030 — Agent Lifecycle & Versioning (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.5  
**Discussion:** https://github.com/supernovae/open-cot/issues/30

---

## 1. Summary

This RFC defines a **lifecycle and versioning model** for agents, covering:

- creation  
- deployment  
- updates  
- deprecation  
- retirement  

It ensures reproducibility and traceability across agent versions.

---

## 2. Lifecycle Stages

- `development`  
- `staging`  
- `production`  
- `deprecated`  
- `retired`  

---

## 3. Full Schema (JSON)

```json
{
  "agent_id": "planner",
  "version": "1.3.0",
  "stage": "production",
  "changelog": ["Improved planning heuristics"]
}
```

---

## 4. Example

```json
{
  "agent_id": "coder",
  "version": "0.9.1",
  "stage": "staging"
}
```

---

## 5. Conclusion

This RFC defines lifecycle and versioning semantics for agent systems.
