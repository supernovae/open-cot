# RFC 0038 — Cost‑Aware Reasoning & Budget Enforcement (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/supernovae/open-cot/discussions/38
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

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0038 — Cost-Aware Reasoning Budget",
  "description": "Budget policy and snapshot types for enforcing token, cost, step, tool-call, and retry limits on agent loops.",
  "type": "object",
  "properties": {
    "budget": {
      "type": "object",
      "description": "Budget policy defining the maximum allowed resource usage.",
      "properties": {
        "max_tokens": {
          "type": "integer",
          "minimum": 0,
          "description": "Maximum total tokens (input + output) across all LLM calls."
        },
        "max_cost": {
          "type": "number",
          "minimum": 0,
          "description": "Maximum dollar cost for the entire agent run."
        },
        "max_steps": {
          "type": "integer",
          "minimum": 0,
          "description": "Maximum number of loop iterations."
        },
        "max_tool_calls": {
          "type": "integer",
          "minimum": 0,
          "description": "Maximum number of tool invocations."
        },
        "max_retries": {
          "type": "integer",
          "minimum": 0,
          "description": "Maximum number of repair/retry attempts."
        }
      },
      "required": ["max_tokens", "max_cost"]
    },
    "enforcement": {
      "type": "string",
      "enum": ["hard", "soft", "warn"],
      "description": "How the budget is enforced. 'hard' force-stops the agent, 'soft' logs warnings, 'warn' emits telemetry only."
    },
    "snapshot": {
      "type": "object",
      "description": "Runtime budget snapshot showing current usage and remaining capacity.",
      "properties": {
        "tokens_used": { "type": "integer", "minimum": 0 },
        "tokens_remaining": { "type": "integer" },
        "cost_used": { "type": "number", "minimum": 0 },
        "cost_remaining": { "type": "number" },
        "steps_used": { "type": "integer", "minimum": 0 },
        "steps_remaining": { "type": "integer" },
        "tool_calls_used": { "type": "integer", "minimum": 0 },
        "tool_calls_remaining": { "type": "integer" },
        "retries_used": { "type": "integer", "minimum": 0 },
        "retries_remaining": { "type": "integer" }
      }
    }
  },
  "required": ["budget", "enforcement"],
  "additionalProperties": true
}
```
<!-- opencot:schema:end -->

**Example instance:**

```json
{
  "budget": {
    "max_tokens": 5000,
    "max_cost": 0.10
  },
  "enforcement": "hard"
}
```

---

## 4. Example

```json
{
  "budget": { "max_tokens": 2000 }
}
```

---

## 5. Conclusion

This RFC defines how agents reason within explicit economic constraints.
