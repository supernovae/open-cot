# RFC 0042 — Permissions & Access Control (v0.2)

**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/supernovae/open-cot/discussions/42

---

## 1. Summary

This RFC defines **capability-based permission grants** for Open CoT: typed, scoped, time-limited objects that materialize authority *after* the policy engine approves a delegation request. The harness creates grants; the tool executor validates and consumes them. The language model **requests** access; it **never** self-authorizes.

This specification extends **RFC 0026** (Agent Identity — `granted_to`) and **RFC 0041** (Policy Enforcement — issuance and narrowing). It aligns with **RFC 0007** (permissions at `execute_tool`, revocation in finalize), **RFC 0047** (Delegation — `request_ref` / `decision_ref`), and **RFC 0043** (audit mapping for lifecycle events).

---

## 2. Context

Open CoT is a **cognitive control plane**: reasoning, tools, memory, and policy compose into inspectable runs. Permissions bridge **policy approval** and **side-effecting execution**. First-class grants are required so that (a) tool endpoints are not confused deputies for ambient authority, (b) auditors can reconstruct what was allowed, for whom, for how long, and under which policy lineage, and (c) sub-agents do not silently inherit parent capabilities. A **permission grant** is a durable record with a strict lifecycle—not a static role matrix embedded in agent config.

---

## 3. Design principles

1. **No self-authorization.** `granted_by`, `policy_ref`, `decision_ref`, and narrowed `scope` MUST be harness/policy-populated; the model MUST NOT supply values treated as issuance authority.  
2. **Deny by default.** No matching active grant for `audience` + `scope` ⇒ execution MUST fail closed.  
3. **Least privilege in the grant.** Persisted `scope` is the **post-policy** narrowed scope, not the model’s raw intent.  
4. **Explicit binding.** `audience` ties the capability to a specific tool/service key.  
5. **Time-bounded.** Every grant has `ttl_seconds` and `expires_at`; expired grants are unusable (`expired`).  
6. **Observable transitions.** Every lifecycle change MUST emit a structured audit event (§9).

---

## 4. Lifecycle (`status`)

| Status | Meaning |
|--------|---------|
| `active` | Issued, within TTL, not yet consumed (or reusable and still valid). |
| `consumed` | Used for authorized execution; for `one_shot: true`, terminal after first committed use. |
| `expired` | Past `expires_at`; unusable. |
| `revoked` | Invalidated (finalize, violation, manual). |

**Normative:** Only `active` grants MAY authorize new executions (subject to `one_shot` and audience). `consumed` ⇒ `consumed_at` + `tool_call_id` in `permission_consumed`. `revoked` ⇒ `revoked_at` + `revocation_reason`. `expired` ⇒ `permission_expired` when status is persisted (lazy or eager sweep; idempotent re-log permitted).

---

## 5. Scope and narrowing

**`scope`** has required `resource` (URI-like, e.g. `tool:email`, `data:calendar`, `file:/path`) and `action` ∈ `{read, write, execute, delete, list}`. Optional **`constraints`** (machine-enforceable): `allowed_fields`, `excluded_fields`, `max_results`, `max_response_size_bytes`, `custom` (resource-specific). The executor MUST enforce understood keys; unknown keys MUST NOT broaden access (deny or policy-error per deployment — §12).

**Narrowing example:** Model requests `{resource: tool:email, action: read}`. Policy narrows to the same resource/action with `constraints: {allowed_fields: [subject, from, date], excluded_fields: [body, attachments]}`. The **persisted grant** carries the narrowed scope; the executor MUST reject or redact violations.

---

## 6. TTL and expiry

Every grant MUST have `ttl_seconds` (integer ≥ 1) and `expires_at` (RFC 3339). The harness sets `expires_at` from `granted_at` + TTL at issuance. The executor MUST check `now < expires_at` on the harness clock domain before each use. **Recommended defaults (non-normative):** 60s for tool calls; 300s for session-scoped reads/lists when policy allows. On expiry, set `expired` and log `permission_expired`.

---

## 7. One-shot vs reusable

**`one_shot: true`:** becomes `consumed` after the first **committed** pre-flight that binds a `tool_call_id`. Recommended default for `write` / `execute` / `delete`. **`one_shot: false`:** reusable until TTL/revocation. Recommended default for `read` / `list`. One-shot reads remain permitted for sensitive classes.

---

## 8. Audience binding

**`audience`** (non-empty) identifies the intended tool/service (e.g. `tool:search`). At pre-flight, the resolved invocation target MUST match `audience` (exact string unless RFC 0041 registers aliases). `audience: tool:search` MUST NOT authorize `tool:email`, including shared gateways.

---

## 9. Forwardability

**`forwardable`** defaults **`false`**; sub-agents MUST request their own grants. **`forwardable: true`** only via explicit policy; implementations SHOULD require an **authority_receipt** chain (RFC 0047) for attributable inheritance.

---

## 10. Audit events

Every state change MUST log: **`permission_granted`** (scope, TTL, audience, `granted_to`, refs); **`permission_consumed`** (`tool_call_id`, `consumed_at`); **`permission_expired`** (`expires_at`, detection time); **`permission_revoked`** (`revoked_at`, `revocation_reason`, optional actor). These integrate with RFC 0007 / RFC 0043.

---

## 11. JSON Schema — Permission grant (normative)

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/permission-grant/0.2",
  "title": "Open CoT RFC 0042 — Permission Grant",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "permission_id": { "type": "string", "format": "uuid" },
    "granted_to": { "type": "string", "minLength": 1 },
    "scope": {
      "type": "object",
      "additionalProperties": false,
      "required": ["resource", "action"],
      "properties": {
        "resource": { "type": "string", "minLength": 1 },
        "action": { "type": "string", "enum": ["read", "write", "execute", "delete", "list"] },
        "constraints": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "allowed_fields": { "type": "array", "items": { "type": "string" } },
            "excluded_fields": { "type": "array", "items": { "type": "string" } },
            "max_results": { "type": "integer", "minimum": 0 },
            "max_response_size_bytes": { "type": "integer", "minimum": 0 },
            "custom": { "type": "object" }
          }
        }
      }
    },
    "audience": { "type": "string", "minLength": 1 },
    "ttl_seconds": { "type": "integer", "minimum": 1 },
    "expires_at": { "type": "string", "format": "date-time" },
    "one_shot": { "type": "boolean" },
    "forwardable": { "type": "boolean", "default": false },
    "granted_by": { "type": "string", "minLength": 1 },
    "policy_ref": { "type": "string", "minLength": 1 },
    "request_ref": { "type": "string", "minLength": 1 },
    "decision_ref": { "type": "string", "minLength": 1 },
    "granted_at": { "type": "string", "format": "date-time" },
    "consumed_at": { "type": "string", "format": "date-time" },
    "revoked_at": { "type": "string", "format": "date-time" },
    "revocation_reason": { "type": "string" },
    "status": { "type": "string", "enum": ["active", "consumed", "expired", "revoked"] }
  },
  "required": [
    "permission_id", "granted_to", "scope", "audience", "ttl_seconds", "expires_at",
    "one_shot", "granted_by", "policy_ref", "request_ref", "decision_ref", "granted_at", "status"
  ],
  "allOf": [
    { "if": { "properties": { "status": { "const": "consumed" } }, "required": ["status"] },
      "then": { "required": ["consumed_at"] } },
    { "if": { "properties": { "status": { "const": "revoked" } }, "required": ["status"] },
      "then": { "required": ["revoked_at", "revocation_reason"] } }
  ]
}
```
<!-- opencot:schema:end -->

Omitted `forwardable` on the wire MUST deserialize as `false`.

---

## 12. Tool executor requirements

Before execution: verify `status == active`, audience match, not expired, `scope.resource`/`action` match the invocation, and all understood `constraints`. After successful one-shot pre-flight, transition to `consumed` and emit `permission_consumed`. Unknown `constraints.custom` keys MUST NOT widen access.

---

## 13. Examples

### 13.1 One-shot write — specific file

```json
{
  "permission_id": "a1b2c3d4-e5f6-4a7b-8c9d-0123456789ab",
  "granted_to": "run:20260418T143022Z-planner-01",
  "scope": {
    "resource": "file:/var/workspace/contracts/nda-draft.md",
    "action": "write",
    "constraints": { "max_response_size_bytes": 1048576, "custom": { "encoding": "utf-8" } }
  },
  "audience": "tool:filesystem",
  "ttl_seconds": 60,
  "expires_at": "2026-04-18T14:31:22Z",
  "one_shot": true,
  "forwardable": false,
  "granted_by": "policy:org-contracts-v3#rule:file-write-allow",
  "policy_ref": "policy:org-contracts-v3",
  "request_ref": "deleg_req:7f2c9a1b-4d3e-4f5a-9b0c-111111111111",
  "decision_ref": "deleg_dec:88aa99bb-0cc1-4dd2-9ee3-222222222222",
  "granted_at": "2026-04-18T14:30:22Z",
  "status": "active"
}
```

First committed `tool:filesystem` write ⇒ `consumed` + `permission_consumed`.

### 13.2 Reusable read — search, 5-minute TTL

```json
{
  "permission_id": "b2c3d4e5-f6a7-4b8c-9d0e-123456789abc",
  "granted_to": "agent:researcher-prod-east",
  "scope": {
    "resource": "tool:search",
    "action": "read",
    "constraints": { "max_results": 25, "max_response_size_bytes": 2097152 }
  },
  "audience": "tool:search",
  "ttl_seconds": 300,
  "expires_at": "2026-04-18T14:40:00Z",
  "one_shot": false,
  "forwardable": false,
  "granted_by": "policy:safe-search-v1#rule:read-allow",
  "policy_ref": "policy:safe-search-v1",
  "request_ref": "deleg_req:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "decision_ref": "deleg_dec:ffffffff-0000-1111-2222-333333333333",
  "granted_at": "2026-04-18T14:35:00Z",
  "status": "active"
}
```

### 13.3 Narrowed read — email headers only

```json
{
  "permission_id": "c3d4e5f6-a7b8-4c9d-0e1f-23456789abcd",
  "granted_to": "run:20260418T150000Z-assistant-07",
  "scope": {
    "resource": "tool:email",
    "action": "read",
    "constraints": {
      "allowed_fields": ["subject", "from", "date"],
      "excluded_fields": ["body", "attachments"],
      "max_results": 50
    }
  },
  "audience": "tool:email",
  "ttl_seconds": 60,
  "expires_at": "2026-04-18T15:01:05Z",
  "one_shot": false,
  "forwardable": false,
  "granted_by": "policy:pii-minimize-v2#rule:email-headers-only",
  "policy_ref": "policy:pii-minimize-v2",
  "request_ref": "deleg_req:11111111-2222-3333-4444-555555555555",
  "decision_ref": "deleg_dec:66666666-7777-8888-9999-aaaaaaaaaaaa",
  "granted_at": "2026-04-18T15:00:05Z",
  "status": "active"
}
```

Executor MUST enforce headers-only regardless of model prompts.

---

## 14. Cross-references

- **RFC 0007 — Governed FSM** — consume in `execute_tool`; revoke in finalize.  
- **RFC 0026 — Agent Identity** — `granted_to` binding.  
- **RFC 0041 — Policy Enforcement** — decisions create grants; optional audience aliases.  
- **RFC 0043 — Auditing** — canonical audit stream for §10.  
- **RFC 0047 — Delegation** — `request_ref` / `decision_ref`; authority receipts when `forwardable`.

---

## 15. Open questions resolution

| Topic | Resolution (v0.2) |
|-------|---------------------|
| RBAC vs capabilities | Capabilities at execution; RBAC feeds policy only. |
| Clock skew | `expires_at` authoritative; harness clock or documented skew budget. |
| Unknown `custom` keys | Deployment choice: deny vs ignore; never widen. |
| Audience aliases | Default exact match; aliases only if registered in policy (RFC 0041). |
| `one_shot` boundary | First committed pre-flight; retries idempotent or new grant. |

---

## 16. Acceptance criteria

Conformant implementations: (1) issue grants only post-validated decision with immutable harness fields; (2) validate records against §11 (default `forwardable` false); (3) obey §4 lifecycle; (4) perform §12 pre-flight; (5) persist narrowed scope per §5; (6) implement §7 one-shot semantics; (7) emit all §10 events with minimum payloads; (8) deny child reuse without explicit `forwardable`; (9) reject cross-audience use per §8.

---

## 17. Conclusion

RFC 0042 v0.2 specifies **first-class permission grants** with audience binding, TTL, optional reuse, forwardability rules, and audited lifecycle—closing the loop from RFC 0026 / 0041 identity and policy to safe execution on the Open CoT control plane (RFC 0007, RFC 0047).
