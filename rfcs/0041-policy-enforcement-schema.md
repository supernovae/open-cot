# RFC 0041 — Policy Enforcement Schema (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/supernovae/open-cot/issues/41

---

## 1. Summary

This RFC defines a **policy enforcement schema**, enabling:

- policy‑aware reasoning  
- policy validation  
- policy‑driven tool restrictions  
- policy‑driven memory access  
- policy‑driven safety constraints  

It extends:

- RFC 0017 — Safety & Sandboxing  
- RFC 0026 — Identity & Authentication  

---

## 2. Policy Types

- safety  
- compliance  
- organizational  
- ethical  
- operational  

---

## 3. Full Schema (JSON)

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0041 — Policy Enforcement Schema",
  "type": "object",
  "properties": {
    "version": { "type": "string", "enum": ["0.1"] },
    "policy_id": { "type": "string" },
    "policy_type": {
      "type": "string",
      "enum": ["safety", "compliance", "organizational", "ethical", "operational"]
    },
    "rules": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "action": { "type": "string", "enum": ["allow", "deny", "require_approval"] },
          "subject": { "type": "string" },
          "resource": { "type": "string" },
          "condition": { "type": "object" },
          "reason": { "type": "string" }
        },
        "required": ["action", "resource"]
      }
    }
  },
  "required": ["version", "policy_id", "policy_type", "rules"]
}
```
<!-- opencot:schema:end -->

---

## 4. Example

```json
{
  "version": "0.1",
  "policy_id": "safe_mode",
  "policy_type": "safety",
  "rules": [
    { "action": "deny", "resource": "tool:shell", "reason": "untrusted execution path" },
    { "action": "allow", "resource": "tool:search" }
  ]
}
```

---

## 5. Conclusion

This RFC defines structured policy enforcement for agent systems.
