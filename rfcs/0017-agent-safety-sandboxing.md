# RFC 0017 — Agent Safety & Sandboxing (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/supernovae/open-cot/discussions/17
---

## 1. Summary

This RFC defines the **Agent Safety & Sandboxing Standard**, a unified mechanism for restricting, monitoring, and validating agent actions, tool calls, and memory access.

It extends:

- RFC 0003 — Tool Invocation Schema  
- RFC 0007 — Agent Loop Protocol  
- RFC 0010 — Agent Memory Schema  

---

## 2. Motivation

Agents require safety boundaries to prevent:

- unsafe tool calls  
- unauthorized memory access  
- infinite loops  
- excessive branching  
- unsafe multi‑agent interactions  
- unbounded resource usage  

This RFC defines a **sandbox layer** that enforces constraints.

---

## 3. Safety Domains

- **Tool Safety** — allowed tools, rate limits, argument validation  
- **Memory Safety** — read/write permissions, key‑level ACLs  
- **Execution Safety** — step limits, recursion limits  
- **Branching Safety** — max branches, pruning rules  
- **Multi‑Agent Safety** — message filtering, role isolation  

---

## 4. Sandbox Configuration Schema

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

This RFC defines a unified safety and sandboxing layer for agent execution.
