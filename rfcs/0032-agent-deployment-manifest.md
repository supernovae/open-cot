# RFC 0032 — Agent Deployment Manifest (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.6  
**Discussion:** https://github.com/supernovae/open-cot/issues/32

---

## 1. Summary

This RFC defines a **deployment manifest** for agents, enabling:

- reproducible deployment  
- environment configuration  
- tool bindings  
- memory initialization  
- safety settings  

It complements:

- RFC 0030 — Agent Lifecycle & Versioning  

---

## 2. Manifest Components

- agent metadata  
- version  
- environment variables  
- tool bindings  
- memory seeds  
- sandbox configuration  

---

## 3. Full Schema (JSON)

    {
      "agent_id": "planner",
      "version": "1.3.0",
      "environment": {
        "max_steps": 128
      },
      "tools": ["search", "calculator"]
    }

---

## 4. Example

    {
      "agent_id": "coder",
      "tools": ["compiler"]
    }

---

## 5. Conclusion

This RFC defines reproducible deployment manifests for agent systems.
