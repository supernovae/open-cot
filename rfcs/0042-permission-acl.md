# RFC 0042 — Permissions & Access Control (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/supernovae/open-cot/issues/42

---

## 1. Summary

This RFC defines **permissions and access control** for agents, enabling:

- RBAC  
- capability‑based permissions  
- hierarchical access  
- tool‑level permissions  
- memory‑level permissions  

It extends:

- RFC 0026 — Identity & Authentication  
- RFC 0041 — Policy Enforcement  

---

## 2. Permission Types

- read  
- write  
- execute  
- administer  

---

## 3. Full Schema (JSON)

    {
      "agent_id": "planner",
      "permissions": {
        "tools": {
          "search": ["execute"],
          "calculator": ["execute"]
        },
        "memory": {
          "ltm": ["read"],
          "stm": ["read", "write"]
        }
      }
    }

---

## 4. Example

    {
      "permissions": { "tools": { "search": ["execute"] } }
    }

---

## 5. Conclusion

This RFC defines structured access control for agent ecosystems.
