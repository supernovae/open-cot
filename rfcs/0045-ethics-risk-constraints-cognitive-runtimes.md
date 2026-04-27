# RFC 0045 — Ethical & Risk Constraints for Reasoning Pipelines (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/supernovae/open-cot/discussions/45
---

## 1. Summary

This RFC defines ethical and risk constraints for reasoning pipelines, with explicit privacy and safety controls for open reasoning traces.

It extends:

- RFC 0041 — Policy Enforcement Schema
- RFC 0043 — Auditing & Compliance Logs
- RFC 0035 — Data Provenance Tracking

---

## 2. Risk categories

- safety
- privacy
- fairness
- compliance
- operational

---

## 3. Privacy and redaction policy

### 3.1 Sensitive classes

- direct identifiers (names, emails, phones, addresses)
- credentials/secrets
- regulated personal attributes
- proprietary/confidential customer content

### 3.2 Redaction actions

- `drop`: remove field entirely
- `mask`: partially obfuscate value
- `hash`: one-way hash for linkage without plaintext
- `encrypt_ref`: store encrypted value out-of-band and reference key

### 3.3 Retention policy

- Retention horizon must be declared per dataset/run.
- Public releases must not include raw direct identifiers.

---

## 4. Full Schema (JSON)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0045 — Ethical and Risk Constraints",
  "type": "object",
  "properties": {
    "version": { "type": "string", "enum": ["0.1"] },
    "constraint_id": { "type": "string" },
    "risk_rules": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "risk": { "type": "string", "enum": ["safety", "privacy", "fairness", "compliance", "operational"] },
          "max_level": { "type": "string", "enum": ["low", "medium", "high"] },
          "action_on_violation": { "type": "string", "enum": ["block", "review", "log_only"] }
        },
        "required": ["risk", "max_level", "action_on_violation"]
      }
    },
    "privacy_policy": {
      "type": "object",
      "properties": {
        "redaction_actions": {
          "type": "array",
          "items": { "type": "string", "enum": ["drop", "mask", "hash", "encrypt_ref"] }
        },
        "retention_days": { "type": "integer", "minimum": 0 },
        "public_release_allows_pii": { "type": "boolean" }
      },
      "required": ["redaction_actions", "retention_days", "public_release_allows_pii"]
    }
  },
  "required": ["version", "constraint_id", "risk_rules", "privacy_policy"]
}
```

---

## 5. Example

```json
{
  "version": "0.1",
  "constraint_id": "risk_low_public_release",
  "risk_rules": [
    { "risk": "privacy", "max_level": "low", "action_on_violation": "block" },
    { "risk": "safety", "max_level": "medium", "action_on_violation": "review" }
  ],
  "privacy_policy": {
    "redaction_actions": ["drop", "hash"],
    "retention_days": 30,
    "public_release_allows_pii": false
  }
}
```

---

## 6. Conclusion

RFC 0045 defines actionable ethical and privacy constraints so Open CoT artifacts can be shared safely while preserving utility for OSS model development.
