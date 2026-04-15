# RFC 0044 — Governance & Organizational Controls (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/supernovae/open-cot/discussions/44
---

## 1. Summary

This RFC defines **organizational governance controls**, enabling:

- org‑level policies  
- agent approval workflows  
- capability gating  
- hierarchical governance  
- compliance inheritance  

It extends:

- RFC 0041 — Policy Enforcement  
- RFC 0042 — Permissions  

---

## 2. Governance Layers

- global  
- organizational  
- team  
- agent  

---

## 3. Full Schema (JSON)

```json
{
  "org_id": "org_01",
  "governance": {
    "required_policies": ["safe_mode"],
    "restricted_tools": ["shell"]
  }
}
```

---

## 4. Example

```json
{
  "governance": { "required_policies": ["audit_all"] }
}
```

---

## 5. Conclusion

This RFC defines governance structures for enterprise agent deployments.
