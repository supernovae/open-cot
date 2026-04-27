# RFC 0029 — Cognitive pipeline Benchmark Dataset Format (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.5  
**Discussion:** https://github.com/supernovae/open-cot/discussions/29
---

## 1. Summary

This RFC defines a **benchmark dataset format** for evaluating pipelines across:

- reasoning  
- planning  
- tool use  
- safety  
- multi‑cognitive pipeline coordination  

It extends:

- RFC 0022 — Cognitive pipeline Evaluation Protocol  

---

## 2. Dataset Components

- tasks  
- expected outputs  
- verifier configs  
- scoring rules  

---

## 3. Full Schema (JSON)

```json
{
  "task_id": "t001",
  "prompt": "Solve the puzzle.",
  "expected": {},
  "scoring": { "method": "verifier" }
}
```

---

## 4. Example

```json
{
  "task_id": "math_01",
  "prompt": "Compute 12 * 19."
}
```

---

## 5. Conclusion

This RFC defines a benchmark dataset format for cognitive pipeline evaluation.
