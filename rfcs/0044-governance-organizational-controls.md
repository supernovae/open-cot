# RFC 0044 — Governance & Organizational Controls (v0.2)

**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/supernovae/open-cot/discussions/44

---

## 1. Summary

Open CoT is a **cognitive control plane**. This RFC specifies **organizational governance**: how policies, permissions, and constraints cascade from platform defaults through organizations and teams to pipelines—the enterprise-readiness layer. Configs are hierarchical and **monotonic toward restriction** (children narrow, never broaden). Resolution walks the parent chain and merges so the strictest interpretation wins. This extends **RFC 0041** (policies) and **RFC 0042** (permissions); it binds them to scope and compliance metadata without redefining policy rules or ACL tuples.

---

## 2. Scope

**In scope:** layer model, config schema, merge semantics, resolution order, normative JSON Schema. **Out of scope:** identity wire formats (RFC 0026), policy rule internals (RFC 0041), permission matrices (RFC 0042), audit envelopes (RFC 0043), ethics catalogs (RFC 0045). **Consumers:** services that authorize tools, spend, and data before governed FSM transitions (RFC 0007).

---

## 3. Relationship to prior RFCs

RFC **0041** — `required_policies` hold **policy_id** values evaluated per 0041. RFC **0042** — `max_trust_level` caps trust; tools interact with grants. RFC **0026** — `scope_id` and parent links identify org, team, cognitive pipeline. RFC **0007** — governance SHOULD load during **receive** / pre-act. RFC **0045** — `compliance_requirements[].pii_policy` references a **constraint_id**.

---

## 4. Governance layers and inheritance

**Levels (wide → narrow):** `global` (platform defaults, e.g. block `shell` unless an approved exception path exists), `organization` (tenant posture, e.g. SOC2 + no DB writes), `team` (refinements, e.g. Engineering code tools under approval), `cognitive pipeline` (per-cognitive pipeline overrides; still bound by ancestors).

**Parent chain:** `cognitive pipeline` → `team` → `organization` → `global`. Only `global` has `parent_governance_id: null`. Each non-global record MUST point to one parent at the immediate ancestor level.

**Narrowing (normative):** `restricted_tools` — effective blocklist is **union** along the chain. `allowed_tools_override` — **intersection** of non-empty allowlists; empty array at a layer adds no intersection; children MUST NOT allow tools blocked above. `required_policies` — **union**. `max_trust_level` — order `untrusted < low < medium < high` as permitted ceiling; effective ceiling is the **minimum** (strictest); child ceiling MUST NOT exceed parent. `approval_workflows` — child entries only **tighten** control; default merge is **conjunctive** (all applicable workflows satisfied). Violations MUST fail validation with deterministic errors.

---

## 5. Policy resolution

For each governed request: (1) load the cognitive-pipeline-scoped governance record; (2) walk `parent_governance_id` through team, org, global; (3) merge per §4; (4) materialize the effective policy set for RFC 0041/0042; (5) emit in deterministic order (e.g. global→…→cognitive pipeline) for audit. Implementations SHOULD cache by `(requester_id, governance revision tuple)` and invalidate on change.

---

## 6. Normative JSON Schema — Governance Config (v0.2)

Field semantics: `governance_id` UUID for this document; `scope_level` / `scope_id` locate the record (`scope_id` null for `global`); `parent_governance_id` links upward; arrays gate tools and policies; `approval_workflows` and `compliance_requirements` structure human gates and standards; `effective_*` bound the revision; `metadata` is opaque.

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/governance_config/v0.2",
  "title": "Open CoT RFC 0044 — Governance Config",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "version": { "type": "string", "enum": ["0.2"] },
    "governance_id": { "type": "string", "format": "uuid" },
    "scope_level": { "type": "string", "enum": ["global", "organization", "team", "pipeline"] },
    "scope_id": { "type": ["string", "null"] },
    "parent_governance_id": { "type": ["string", "null"] },
    "required_policies": {
      "type": "array",
      "items": { "type": "string", "minLength": 1 },
      "default": []
    },
    "restricted_tools": {
      "type": "array",
      "items": { "type": "string", "minLength": 1 },
      "default": []
    },
    "allowed_tools_override": {
      "type": "array",
      "items": { "type": "string", "minLength": 1 },
      "default": []
    },
    "max_trust_level": {
      "type": "string",
      "enum": ["untrusted", "low", "medium", "high"]
    },
    "approval_workflows": {
      "type": "array",
      "items": { "$ref": "#/definitions/approvalWorkflow" },
      "default": []
    },
    "compliance_requirements": {
      "type": "array",
      "items": { "$ref": "#/definitions/complianceRequirement" },
      "default": []
    },
    "effective_from": { "type": "string", "format": "date-time" },
    "effective_until": { "type": ["string", "null"], "format": "date-time" },
    "metadata": { "type": "object", "additionalProperties": true }
  },
  "required": [
    "version",
    "governance_id",
    "scope_level",
    "scope_id",
    "parent_governance_id",
    "required_policies",
    "restricted_tools",
    "allowed_tools_override",
    "max_trust_level",
    "approval_workflows",
    "compliance_requirements",
    "effective_from",
    "metadata"
  ],
  "definitions": {
    "approvalWorkflow": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "trigger": { "type": "string", "minLength": 1 },
        "approvers": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 },
          "minItems": 1
        },
        "timeout_seconds": { "type": "integer", "minimum": 0 },
        "timeout_action": { "type": "string", "enum": ["deny", "escalate_parent"] }
      },
      "required": ["trigger", "approvers", "timeout_seconds", "timeout_action"]
    },
    "complianceRequirement": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "standard": { "type": "string", "minLength": 1 },
        "audit_retention_days": { "type": "integer", "minimum": 0 },
        "pii_policy": { "type": "string", "minLength": 1 }
      },
      "required": ["standard", "audit_retention_days", "pii_policy"]
    }
  }
}
```
<!-- opencot:schema:end -->

---

## 7. Examples

### 7.1 Organization — Acme Corp

Restricts shell and raw SQL writes, requires audit/residency policies, SOC2 compliance with retention and PII **constraint_id**, `max_trust_level` medium, high-risk tool approval.

```json
{
  "version": "0.2",
  "governance_id": "a1b2c3d4-e5f6-4789-a012-3456789abcde",
  "scope_level": "organization",
  "scope_id": "org_acme_01",
  "parent_governance_id": "00000000-0000-4000-8000-000000000001",
  "required_policies": ["policy_acme_audit_all", "policy_acme_no_shell", "policy_acme_data_residency_us"],
  "restricted_tools": ["shell", "raw_sql_write"],
  "allowed_tools_override": [],
  "max_trust_level": "medium",
  "approval_workflows": [
    {
      "trigger": "high_risk_tool",
      "approvers": ["role:security_oncall", "group:acme_infosec"],
      "timeout_seconds": 3600,
      "timeout_action": "deny"
    }
  ],
  "compliance_requirements": [
    {
      "standard": "SOC2",
      "audit_retention_days": 2555,
      "pii_policy": "constraint_acme_pii_handling_v3"
    }
  ],
  "effective_from": "2026-04-01T00:00:00Z",
  "effective_until": null,
  "metadata": { "display_name": "Acme Corp" }
}
```

### 7.2 Team — Engineering

Inherits org parent `a1b2c3d4-…`; adds code/repo tools via allowlist (still cannot bypass org `shell` block), stricter `max_trust_level` `low`, extra policy, budget approval with `escalate_parent`.

```json
{
  "version": "0.2",
  "governance_id": "b2c3d4e5-f6a7-4890-b123-456789abcdef",
  "scope_level": "team",
  "scope_id": "team_acme_engineering",
  "parent_governance_id": "a1b2c3d4-e5f6-4789-a012-3456789abcde",
  "required_policies": ["policy_eng_code_review_bot"],
  "restricted_tools": [],
  "allowed_tools_override": ["read_repo", "code_execute", "linter_fix"],
  "max_trust_level": "low",
  "approval_workflows": [
    {
      "trigger": "budget_above_threshold",
      "approvers": ["role:eng_manager"],
      "timeout_seconds": 86400,
      "timeout_action": "escalate_parent"
    }
  ],
  "compliance_requirements": [],
  "effective_from": "2026-04-10T00:00:00Z",
  "effective_until": null,
  "metadata": { "display_name": "Engineering" }
}
```

---

## 8. Cross-references

**RFC 0007** — Governed FSM; governance during receive state. **RFC 0041** — Policy enforcement; `required_policies`. **RFC 0042** — Permissions; trust capped by `max_trust_level`. **RFC 0026** — Cognitive pipeline identity; `scope_id`. **RFC 0045** — Ethics; `pii_policy` → **constraint_id**.

---

## 9. Open questions resolution

| Topic | Resolution (v0.2) |
| --- | --- |
| All-empty `allowed_tools_override` | No intersection contributed; effective tool semantics defer to RFC 0042 unless a non-empty allowlist appears. |
| Duplicate workflow triggers | Satisfy all matches conjunctively unless dedup keys are specified later. |
| `global` identity | `scope_id` null; platform MAY use a well-known root `governance_id`. |
| Schema versioning | `version: "0.2"` aligns with **Schema v0.7** train. |

---

## 10. Acceptance criteria

1. Validators MUST reject configs that violate §4 (e.g. child trust ceiling above parent, allowlist listing an ancestor-blocked tool).
2. Two implementations with the same chain MUST yield identical merged `restricted_tools`, `required_policies`, and effective trust ceiling.
3. Parent walks MUST detect cycles and **fail closed** (deny or last-known-good).
4. §7 examples MUST validate against §6 when UUID graph checks are skipped.
