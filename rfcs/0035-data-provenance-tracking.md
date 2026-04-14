# RFC 0035 — Data Provenance Tracking (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.6  
**Discussion:** https://github.com/<your-org>/<your-repo>/issues/35

---

## 1. Summary

This RFC defines a **data provenance schema** for tracking:

- where data came from  
- how it was transformed  
- which agents touched it  
- which tools modified it  

It extends:

- RFC 0010 — Agent Memory Schema  
- RFC 0020 — Scratchpad Compression  

---

## 2. Provenance Fields

- source  
- timestamp  
- agent_id  
- tool_id  
- transformation  

---

## 3. Full Schema (JSON)

    {
      "data_id": "d001",
      "source": "search_tool",
      "agent_id": "planner",
      "timestamp": "string",
      "transformation": "summarized"
    }

---

## 4. Example

    {
      "source": "user_input"
    }

---

## 5. Conclusion

This RFC defines provenance tracking for trustworthy agent systems.
