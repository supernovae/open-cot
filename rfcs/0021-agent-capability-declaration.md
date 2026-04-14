# RFC 0021 — Agent Capability Declaration (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/supernovae/open-cot/issues/21

---

## 1. Summary

This RFC defines a **capability declaration format** for agents, enabling:

- capability discovery  
- compatibility checks  
- multi‑agent coordination  
- tool negotiation (RFC 0016)  

---

## 2. Capability Types

- reasoning  
- planning  
- tool use  
- memory  
- verification  
- multi‑agent communication  
- safety level  

---

## 3. Full Schema (JSON)

    {
      "agent_id": "planner",
      "capabilities": {
        "reasoning": true,
        "planning": true,
        "tool_use": ["search"],
        "memory": ["read"],
        "safety_level": "restricted"
      }
    }

---

## 4. Example

    {
      "agent_id": "coder",
      "capabilities": {
        "tool_use": ["compiler", "executor"]
      }
    }

---

## 5. Conclusion

This RFC defines a unified capability declaration for agents.
