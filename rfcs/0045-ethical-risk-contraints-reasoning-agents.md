# RFC 0045 — Ethical & Risk Constraints for Reasoning Agents (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/<your-org>/<your-repo>/issues/45

---

## 1. Summary

This RFC defines **ethical and risk constraints** for reasoning agents, enabling:

- ethical boundaries  
- risk scoring  
- constraint‑aware planning  
- risk‑aware tool use  
- ethical compliance reporting  

It extends:

- RFC 0041 — Policy Enforcement  
- RFC 0043 — Auditing  

---

## 2. Risk Categories

- safety  
- privacy  
- fairness  
- compliance  
- operational  

---

## 3. Full Schema (JSON)

    {
      "constraint_id": "ethics_01",
      "rules": [
        { "risk": "privacy", "max_level": "low" }
      ]
    }

---

## 4. Example

    {
      "constraint_id": "risk_low"
    }

---

## 5. Conclusion

This RFC defines ethical and risk constraints for responsible agent reasoning.
