# RFC 0037 — Token Economy & Cost Modeling (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/supernovae/open-cot/discussions/37
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

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0037 — Token Economy & Cost Modeling",
  "description": "Cost snapshot structure for tracking model inference and tool invocation costs per step or per trajectory.",
  "type": "object",
  "properties": {
    "model_cost": {
      "type": "object",
      "properties": {
        "input_tokens": {
          "type": "integer",
          "minimum": 0,
          "description": "Number of input/prompt tokens consumed."
        },
        "output_tokens": {
          "type": "integer",
          "minimum": 0,
          "description": "Number of output/completion tokens generated."
        }
      },
      "required": ["input_tokens", "output_tokens"]
    },
    "tool_cost": {
      "type": "object",
      "description": "Cost per tool name (numeric values).",
      "additionalProperties": {
        "type": "number",
        "minimum": 0
      }
    },
    "total_cost": {
      "type": "number",
      "minimum": 0,
      "description": "Aggregate cost across model inference and tool invocations."
    }
  },
  "required": ["model_cost", "total_cost"],
  "additionalProperties": true
}
```
<!-- opencot:schema:end -->

**Example instance:**

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
