# RFC 0036 — Agent‑Native Compression & Delta Sync (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.6  
**Discussion:** https://github.com/supernovae/open-cot/discussions/36
---

## 1. Summary

This RFC defines **agent‑native compression and delta synchronization**, enabling:

- efficient memory sync  
- distributed scratchpad updates  
- incremental state transfer  
- low‑bandwidth multi‑agent collaboration  

It extends:

- RFC 0020 — Scratchpad Compression  
- RFC 0027 — Distributed Execution Protocol  

---

## 2. Delta Types

- `state_delta`  
- `memory_delta`  
- `scratchpad_delta`  
- `tool_state_delta`  

---

## 3. Full Schema (JSON)

```json
{
  "delta_type": "memory_delta",
  "from_version": "1.2.0",
  "to_version": "1.2.1",
  "changes": ["updated_preference"]
}
```

---

## 4. Example

```json
{
  "delta_type": "scratchpad_delta",
  "changes": ["added_step_42"]
}
```

---

## 5. Conclusion

This RFC defines efficient delta‑based synchronization for agent ecosystems.
