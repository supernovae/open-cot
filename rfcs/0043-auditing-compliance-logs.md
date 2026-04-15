# RFC 0043 — Auditing & Compliance Logs (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/supernovae/open-cot/discussions/43
---

## 1. Summary

This RFC defines **auditing and compliance logs**, enabling:

- immutable logs  
- replayable execution  
- compliance reporting  
- forensic analysis  
- policy violation tracking  

It extends:

- RFC 0041 — Policy Enforcement  
- RFC 0031 — Observability & Telemetry  

---

## 2. Log Types

- tool calls  
- memory access  
- policy checks  
- safety violations  
- cost usage  

---

## 3. Full Schema (JSON)

```json
{
  "log_id": "l001",
  "timestamp": "string",
  "agent_id": "planner",
  "event": "tool_call",
  "details": {
    "tool": "search",
    "status": "success"
  }
}
```

---

## 4. Example

```json
{
  "event": "policy_violation"
}
```

---

## 5. Conclusion

This RFC defines immutable audit logs for agent governance.
