# RFC 0017 — Cognitive pipeline Safety & Sandboxing (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/supernovae/open-cot/discussions/17
---

## 1. Summary

This RFC defines the **Cognitive pipeline Safety & Sandboxing Standard**, a unified mechanism for restricting, monitoring, and validating cognitive pipeline actions, tool calls, and memory access.

It extends:

- RFC 0003 — Tool Invocation Schema  
- RFC 0007 — Cognitive Pipeline Protocol  
- RFC 0010 — Cognitive pipeline Memory Schema  

---

## 2. Motivation

Pipelines require safety boundaries to prevent:

- unsafe tool calls  
- unauthorized memory access  
- infinite loops  
- excessive branching  
- unsafe multi‑cognitive pipeline interactions  
- unbounded resource usage  

This RFC defines a **sandbox layer** that enforces constraints.

---

## 3. Safety Domains

- **Tool Safety** — allowed tools, rate limits, argument validation  
- **Memory Safety** — read/write permissions, key‑level ACLs  
- **Execution Safety** — step limits, recursion limits  
- **Branching Safety** — max branches, pruning rules  
- **Multi‑Cognitive pipeline Safety** — message filtering, role isolation  

---

## 4. Sandbox Configuration Schema

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0017 — Cognitive pipeline Safety & Sandboxing Configuration",
  "description": "Defines sandbox policies that constrain cognitive pipeline behavior at runtime: which tools are permitted, step/branch limits, and memory access controls.",
  "type": "object",
  "properties": {
    "allowed_tools": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Tool names the cognitive pipeline may invoke. Use [\"*\"] to allow all."
    },
    "blocked_tools": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Tool names explicitly denied regardless of allowed_tools."
    },
    "max_steps": {
      "type": "integer",
      "minimum": 1,
      "description": "Maximum number of loop iterations before forced stop."
    },
    "max_branches": {
      "type": "integer",
      "minimum": 1,
      "description": "Maximum number of concurrent reasoning branches."
    },
    "memory_acl": {
      "type": "object",
      "description": "Access control list mapping role or requester IDs to permission arrays.",
      "additionalProperties": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["read", "write", "execute", "admin"]
        }
      }
    }
  },
  "required": ["allowed_tools", "blocked_tools", "max_steps"],
  "additionalProperties": true
}
```
<!-- opencot:schema:end -->

**Example instance:**

```json
{
  "allowed_tools": ["search", "calculator"],
  "blocked_tools": ["shell", "network_raw"],
  "max_steps": 128,
  "max_branches": 16,
  "memory_acl": {
    "planner": ["read"],
    "executor": ["read", "write"]
  }
}
```

---

## 5. Example

```json
{
  "allowed_tools": ["weather_api"],
  "max_steps": 32
}
```

---

## 6. Conclusion

This RFC defines a unified safety and sandboxing layer for cognitive pipeline execution.
