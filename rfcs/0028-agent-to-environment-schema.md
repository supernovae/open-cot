# RFC 0028 — Agent‑to‑Environment Interaction Schema (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.5  
**Discussion:** https://github.com/supernovae/open-cot/issues/28

---

## 1. Summary

This RFC defines a schema for **agent interactions with external environments**, including:

- simulators  
- APIs  
- physical systems  
- virtual worlds  

---

## 2. Interaction Types

- observation  
- action  
- reward  
- termination  

---

## 3. Full Schema (JSON)

    {
      "env_id": "sim_01",
      "observation": {},
      "action": {},
      "reward": 1.0,
      "done": false
    }

---

## 4. Example

    {
      "action": { "move": "north" }
    }

---

## 5. Conclusion

This RFC defines a unified schema for agent‑environment loops.
