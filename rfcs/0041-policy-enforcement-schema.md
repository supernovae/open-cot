# RFC 0041 — Policy Enforcement Schema (v0.3)

**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/supernovae/open-cot/discussions/41

---

## 1. Summary

This RFC defines the **Policy Enforcement Schema (v0.3)** for Open-CoT, a cognitive control plane for governed agent execution. The policy engine decides when a model may invoke tools, access data or memory, or perform other governed operations. Given a **delegation request** (RFC 0047) and active policies, it returns **`allow`**, **`deny`**, **`narrow`**, or **`require_approval`**, with optional `narrowing` constraints, denial reasons, or escalation targets.

v0.3 preserves **`narrow`** and introduces canonical temporal naming from RFC 0051: policy validity bounds use `effective_at` / `expires_at`, condition windows use `validity_window`, and evaluation records use `decided_at`. It formalizes deterministic temporal validity semantics while retaining composable narrowing and policy priority behavior.

---

## 2. Motivation and scope

Operators need typed policies, graduated responses (`narrow`, `require_approval`), machine-readable rules over **subjects** and **resources**, and **deterministic** evaluation for traces and compliance. This RFC specifies JSON Schemas and evaluation semantics; it does **not** define transport, cryptographic signing of policies, or the full delegation request payload—only linking fields such as `request_id`.

---

## 3. Relationship to adjacent RFCs

| RFC | Title | Relationship |
|-----|--------|----------------|
| RFC 0007 | Agent Loop Protocol | Governed FSM: policy consulted in frame, plan, validate_authority, observe_result, critique_verify, finalize. |
| RFC 0017 | Agent Safety & Sandboxing | This RFC supersedes simple allow/block lists with structured rules, narrowing, and evaluation records. |
| RFC 0026 | Agent Identity & Authentication | **Subject** identities and roles for `subject` matching. |
| RFC 0042 | Permissions & Access Control | **Consumes** policy decisions for grants. |
| RFC 0047 | Delegation | Engine evaluates `delegation_request`; `request_id` links artifacts. |

---

## 4. Policy types

`policy_type` labels intent and ownership; engines MUST preserve it for routing and audit. Semantics come from rules, not from this field alone.

| Value | Typical use |
|--------|-------------|
| `safety` | Harmful tools, exfiltration, unsafe execution paths. |
| `compliance` | Regulatory / contractual minimization, residency, retention. |
| `organizational` | Internal data classes, departments, workflows. |
| `ethical` | Policy beyond baseline safety. |
| `operational` | SLOs, rate limits, cost controls, production safeguards. |

---

## 5. Decisions and actions

Rule `action` and result `decision` share: **`allow`** (grant as narrowed so far), **`deny`** (reject), **`narrow`** (approve only under `narrowing` / merged `narrowed_scope`), **`require_approval`** (defer; `escalation_target` SHOULD name queue or role). **`narrow`** remains the data minimization path without a hard deny.

---

## 6. Resources and subjects

Resources SHOULD use prefixes: `tool:<name>` (RFC 0003), `data:<path>`, `memory:<key-pattern>` (RFC 0010). Matching SHOULD prefer exact over pattern, then **longest-prefix / most-specific** tie-break (documented per implementation). **`subject`**: agent id, role, or wildcard per RFC 0026; wildcard grammar MUST be documented by the engine.

---

## 7. Conditions and narrowing

**`conditions`** (all present sub-fields must pass for a match): `max_risk_level` (`low` ≤ `medium` ≤ `high`), `require_justification`, `validity_window` (`effective_at`/`expires_at` ISO 8601 UTC; half-open), `budget_remaining_min`. Omitted keys impose no constraint from that key.

**`narrowing`**: `allowed_fields`, `excluded_fields`, `max_results`, `max_response_size_bytes`. If `action` is `narrow`, `narrowing` SHOULD be present; if not `narrow`, ignore `narrowing`. Empty intersection of allowed vs excluded fields MUST yield **`deny`**; otherwise apply intersection rules in §10.

---

## 8. Normative JSON Schema — Policy document (v0.3)

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/policy/v0.3",
  "title": "Open CoT RFC 0041 — Policy Document",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "version": { "type": "string", "enum": ["0.3"] },
    "policy_id": { "type": "string", "minLength": 1 },
    "policy_type": {
      "type": "string",
      "enum": ["safety", "compliance", "organizational", "ethical", "operational"]
    },
    "description": { "type": "string" },
    "priority": { "type": "integer", "description": "Lower = higher precedence across policies." },
    "rules": { "type": "array", "items": { "$ref": "#/definitions/policyRule" }, "minItems": 1 },
    "effective_at": { "type": "string", "format": "date-time" },
    "expires_at": { "type": "string", "format": "date-time" }
  },
  "required": ["version", "policy_id", "policy_type", "priority", "rules"],
  "definitions": {
    "riskLevel": { "type": "string", "enum": ["low", "medium", "high"] },
    "ruleAction": { "type": "string", "enum": ["allow", "deny", "narrow", "require_approval"] },
    "validityWindow": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "effective_at": { "type": "string", "format": "date-time" },
        "expires_at": { "type": "string", "format": "date-time" }
      },
      "required": ["effective_at", "expires_at"]
    },
    "conditions": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "max_risk_level": { "$ref": "#/definitions/riskLevel" },
        "require_justification": { "type": "boolean" },
        "validity_window": { "$ref": "#/definitions/validityWindow" },
        "budget_remaining_min": { "type": "number" }
      }
    },
    "narrowing": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "allowed_fields": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "excluded_fields": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "max_results": { "type": "integer", "minimum": 0 },
        "max_response_size_bytes": { "type": "integer", "minimum": 0 }
      }
    },
    "policyRule": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "rule_id": { "type": "string", "minLength": 1 },
        "action": { "$ref": "#/definitions/ruleAction" },
        "subject": { "type": "string" },
        "resource": { "type": "string", "minLength": 1 },
        "conditions": { "$ref": "#/definitions/conditions" },
        "narrowing": { "$ref": "#/definitions/narrowing" },
        "escalation_target": { "type": "string" },
        "reason": { "type": "string" }
      },
      "required": ["rule_id", "action", "resource"]
    }
  }
}
```
<!-- opencot:schema:end -->

---

## 9. Normative JSON Schema — Policy evaluation result

Engines MUST emit one object per evaluated `(request_id, policy_id)` or define a batch envelope of these records.

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/policy_evaluation_result/v0.3",
  "title": "Open CoT RFC 0041 — Policy Evaluation Result",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "evaluation_id": { "type": "string", "minLength": 1 },
    "request_id": { "type": "string", "minLength": 1, "description": "Links to delegation_request (RFC 0047)." },
    "policy_id": { "type": "string", "minLength": 1 },
    "rule_id": { "type": "string" },
    "decision": { "type": "string", "enum": ["allow", "deny", "narrow", "require_approval"] },
    "narrowed_scope": { "type": "object", "additionalProperties": true },
    "denial_reason": { "type": "string" },
    "escalation_target": { "type": "string" },
    "decided_at": { "type": "string", "format": "date-time" },
    "context": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "agent_id": { "type": "string" },
        "run_id": { "type": "string" },
        "budget_snapshot": { "type": "object", "additionalProperties": true },
        "risk_assessment": { "type": "string" }
      }
    }
  },
  "required": ["evaluation_id", "request_id", "policy_id", "decision", "decided_at"]
}
```
<!-- opencot:schema:end -->

---

## 10. Evaluation semantics

**Temporal validity.** Policy is active at `t` if `effective_at` is absent or `t` ≥ `effective_at`, and `expires_at` is absent or `t` < `expires_at` (half-open on end). Inactive policies MUST NOT affect the outcome.

**Intra-policy.** Among rules whose `subject`, `resource`, and `conditions` match, the **first entry in `rules`** wins. No match ⇒ this policy contributes **no match** (not `allow`).

**Fail-closed default.** If no rule in any active policy matches, final decision is **`deny`**; populate `denial_reason` with a stable code and optional human text.

**Inter-policy merge.** Sort active policies by ascending `priority`, then ascending `policy_id` (Unicode). Each policy yields no match, `allow`, `deny`, `narrow`, or `require_approval`. Merge precedence: **`deny` > `narrow` > `require_approval` > `allow`**. Several `narrow` outcomes merge by intersecting caps: `allowed_fields` = intersection where all specify lists else unconstrained on omit; `excluded_fields` = union; `max_results` and `max_response_size_bytes` = minimum of given caps. Contradiction or empty effective allow-set ⇒ **`deny`**.

**Determinism.** Same active policy set, `t`, delegation payload, subject resolution, risk label, budget snapshot, and justification flags ⇒ same `decision`, provenance (`policy_id` / `rule_id`), and semantically equal `narrowed_scope`. Document any feature flags that break replay.

---

## 11. Examples

### 11.1 Safety — deny shell access

```json
{
  "version": "0.3",
  "policy_id": "safety_no_shell",
  "policy_type": "safety",
  "description": "Block shell for autonomous runs.",
  "priority": 10,
  "effective_at": "2026-04-14T00:00:00Z",
  "rules": [
    { "rule_id": "deny_shell", "action": "deny", "subject": "*", "resource": "tool:shell", "reason": "Unattended shell out of scope." },
    { "rule_id": "allow_search", "action": "allow", "subject": "*", "resource": "tool:search" }
  ]
}
```

### 11.2 Compliance — narrow email to headers only

```json
{
  "version": "0.3",
  "policy_id": "compliance_email_minimization",
  "policy_type": "compliance",
  "description": "Headers/metadata only for mailbox reads.",
  "priority": 20,
  "rules": [{
    "rule_id": "narrow_mailbox_read",
    "action": "narrow",
    "subject": "role:analyst",
    "resource": "data:mailbox/*",
    "conditions": { "max_risk_level": "medium", "require_justification": true },
    "narrowing": {
      "allowed_fields": ["message_id", "thread_id", "from", "to", "cc", "date", "subject"],
      "excluded_fields": ["body", "attachments"],
      "max_results": 50,
      "max_response_size_bytes": 1048576
    },
    "reason": "Data minimization."
  }]
}
```

### 11.3 Operational — require approval for database writes

```json
{
  "version": "0.3",
  "policy_id": "ops_db_write_gate",
  "policy_type": "operational",
  "description": "Human approval for DB mutations.",
  "priority": 30,
  "rules": [{
    "rule_id": "gate_db_writes",
    "action": "require_approval",
    "subject": "*",
    "resource": "tool:db_write",
    "conditions": {
      "validity_window": { "effective_at": "2026-04-14T00:00:00Z", "expires_at": "2099-12-31T23:59:59Z" },
      "budget_remaining_min": 0
    },
    "escalation_target": "queue:dba-oncall",
    "reason": "DB writes require DBA approval."
  }]
}
```

### 11.4 Policy evaluation result (after a request matching §11.2)

```json
{
  "evaluation_id": "eval_8f3c2a1b",
  "request_id": "del_req_4410aa",
  "policy_id": "compliance_email_minimization",
  "rule_id": "narrow_mailbox_read",
  "decision": "narrow",
  "narrowed_scope": {
    "allowed_fields": ["message_id", "thread_id", "from", "to", "cc", "date", "subject"],
    "excluded_fields": ["body", "attachments"],
    "max_results": 50,
    "max_response_size_bytes": 1048576
  },
  "decided_at": "2026-04-18T12:34:56Z",
  "context": {
    "agent_id": "agent/analyst-7",
    "run_id": "run_19c0",
    "budget_snapshot": { "currency": "USD", "remaining": 12.45 },
    "risk_assessment": "medium"
  }
}
```

---

## 12. Security and privacy

Fail-closed default limits accidental over-permissioning. **`narrow`** is unsafe unless executors **enforce** `narrowed_scope` at bind/execute time, not only in logs. **`require_approval`** needs authenticated approvers. Evaluation **`context`** may be sensitive; treat like other audit payloads under organizational retention and access control.

## 13. Open questions resolution

| Topic | v0.3 resolution |
|--------|------------------|
| Partial approval / minimization | `narrow` + `narrowing` / `narrowed_scope`. |
| Multi-policy | Deterministic sort; precedence **deny > narrow > require_approval > allow**. |
| No rule match | Fail-closed **`deny`**. |
| Audit trail | `policy_evaluation_result` + `evaluation_id`, `decided_at`, `request_id`. |
| Conditions / hooks | `conditions` + `context.budget_snapshot`, `risk_assessment`. |
| Rule vs policy order | Policy `priority` + Unicode `policy_id`; rules by **array order**. |

**Deferred (0.3+):** canonical glob grammar for `resource`, signed policy bundles, enumerated `risk_assessment`.

## 14. Acceptance criteria and conclusion

A conforming engine **MUST**: (1) validate policy documents against §8 with `version` `0.3` unless documented otherwise; (2) emit §9 results with required fields for each evaluation; (3) implement §10 including temporal filter, first-match rules, fail-closed default, merge precedence, narrowing intersection, determinism; (4) populate `denial_reason` / `narrowed_scope` / `escalation_target` when emitting the corresponding decisions (document any optional omissions). Authors **SHOULD** set `description`, per-rule `reason`, and explicit validity bounds (`effective_at` / `expires_at`) for shared policies.

RFC 0041 v0.3 normatively specifies policy documents, the **`narrow`** decision, canonical temporal semantics, evaluation results, and deterministic merge semantics—forming the **decision layer** with RFC 0026 (identity), RFC 0047 (delegation), and RFC 0051 (temporal semantics).
