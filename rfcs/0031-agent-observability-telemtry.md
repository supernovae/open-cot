# RFC 0031 — Agent Observability & Telemetry (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Schema v0.6  
**Discussion:** https://github.com/supernovae/open-cot/discussions/31
---

## 1. Summary

This RFC defines telemetry and observability fields for reasoning agents.

It extends:

- RFC 0007 — Agent Loop Protocol
- RFC 0022 — Agent Evaluation Protocol

---

## 2. Telemetry categories

- Execution metrics (steps, branches, latency)
- Tool metrics (calls, errors, cost)
- Memory metrics (reads, writes, conflicts)
- Safety metrics (policy violations, sandbox triggers)
- System metrics (CPU, GPU, RAM)

---

## 3. Full Schema (JSON)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0031 — Agent Observability and Telemetry",
  "type": "object",
  "properties": {
    "version": { "type": "string", "enum": ["0.1"] },
    "agent_id": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" },
    "metrics": {
      "type": "object",
      "properties": {
        "steps": { "type": "integer", "minimum": 0 },
        "tool_calls": { "type": "integer", "minimum": 0 },
        "latency_ms": { "type": "number", "minimum": 0 },
        "memory_reads": { "type": "integer", "minimum": 0 },
        "safety_violations": { "type": "integer", "minimum": 0 }
      },
      "additionalProperties": true
    }
  },
  "required": ["version", "agent_id", "timestamp", "metrics"]
}
```

---

## 4. Example

```json
{
  "version": "0.1",
  "agent_id": "planner",
  "timestamp": "2026-04-14T11:30:00Z",
  "metrics": {
    "steps": 42,
    "tool_calls": 5,
    "latency_ms": 1200,
    "memory_reads": 12,
    "safety_violations": 0
  }
}
```

---

## 5. Conclusion

RFC 0031 provides a standard telemetry envelope for runtime visibility, debugging, and benchmarking.
