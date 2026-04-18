# RFC 0047 — Delegation Extension (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-18  
**Target Version:** Schema v0.8  
**Discussion:** https://github.com/supernovae/open-cot/discussions/47  
---

## 1. Summary

Open CoT is a **cognitive control plane**: the model proposes; the harness, policy engine, and authorized brokers **decide**. **Delegation** is the formal process by which a model requests authority to act, and the harness evaluates that request—granting, denying, narrowing, or escalating—before any side-effecting tool runs.

The governing insight of this extension is strict and non-negotiable: **the model does not authorize itself.** Typed schema objects represent every step of the authority flow so traces are replayable, policies consultable, and tool dispatch provably bound to a grant chain.

This RFC defines three JSON objects:

1. **`delegation_request`** — intent and scope proposed (in part) by the model; harness binds identity, run context, and provenance.  
2. **`delegation_decision`** — harness/policy-only outcome linked to the request.  
3. **`authority_receipt`** — tamper-evident grant artifact produced by an auth broker after approval, consumed at tool execution.

**Cross-references:** [RFC 0007 — Agent Loop / FSM](0007-agent-loop-protocol.md) (states `request_authority`, `validate_authority`, `delegate_narrow`, `execute_tool`); [RFC 0026 — Agent Identity](0026-agent-identity-auth.md) (`requester` MUST be a verified `agent_id`); [RFC 0041 — Policy](0041-policy-enforcement-schema.md) (rules consulted → `policy_refs`); [RFC 0042 — Permissions](0042-permission-acl.md) (`permission_id` references stored grants); [RFC 0048 — Execution receipts](0048-execution-receipts-audit-envelopes.md) (tool receipts SHOULD reference `authority_receipt` or standing grant).

---

## 2. Trust boundary

| Zone | Who writes | Guarantees |
|------|------------|--------------|
| Model-adjacent | Model output supplies **intent**, **justification**, **requested_scope** preferences, TTL/audience **preferences**, and **task_context_ref** only. | Untrusted text and structure proposals. |
| Harness | Fills `request_id`, `requester`, `run_id`, `timestamp`, `provenance`; merges model fields after validation. | `requester` MUST match verified identity ([RFC 0026](0026-agent-identity-auth.md)). |
| Policy | Emits **`delegation_decision`** exclusively. | Model MUST NOT emit or alter decisions. |
| Auth broker | Emits **`authority_receipt`**; computes **integrity** over all other receipt fields. | Receipt is **tamper-evident**; executors verify hash (and signature when configured) before dispatch. |

---

## 3. Object definitions

### 3.1 `delegation_request`

**Model-provided (merged by harness):** `intent`, `justification`, `requested_scope`, `preferred_ttl_seconds`, `preferred_audience`, `task_context_ref`.

**Harness-provided:** `request_id`, `requester` (verified `agent_id`), `run_id`, `timestamp`, `provenance` (`trace_step_id`, `plan_version`).

**Required fields:** `request_id`, `requester`, `run_id`, `requested_scope`, `timestamp`.

`requested_scope` is an object with:

- `resource` — logical resource identifier (e.g. `mailbox:user@example.com`).  
- `action` — verb or capability token (e.g. `email.read`).  
- `constraints` — optional object (column allowlists, row limits, folder IDs, etc.).

### 3.2 `delegation_decision`

All fields are **harness/policy-provided**. The model does not participate in authoring decisions.

| Field | Notes |
|-------|--------|
| `decision_id` | Unique id for this decision record. |
| `request_id` | Foreign key to `delegation_request`. |
| `status` | `approved` \| `denied` \| `narrowed` \| `escalated`. |
| `decided_by` | Who/what decided: policy id, human approver id, or literal `harness`. |
| `policy_refs` | Array of policy rule or evaluation ids consulted. |
| `narrowed_scope` | Present when `status` is `narrowed` (or when approved but scope reduced—see §7). |
| `denial_reason` | Present when `status` is `denied`. |
| `escalation_target` | Present when `status` is `escalated` (queue, role, ticket system ref). |
| `timestamp` | RFC 3339 decision time. |

### 3.3 `authority_receipt`

Produced by the **auth broker** after a favorable decision path. Binds `permission_id` to **granted_scope** (MAY be narrower than requested), temporal bounds, audience, forwarding rules, and **integrity** (`content_hash` over every other receipt field per broker-documented canonical order; optional `signature` / `signing_key_id` for non-repudiation).

---

## 4. Lifecycle (FSM mapping)

The following aligns with the governed execution FSM in [RFC 0007](0007-agent-loop-protocol.md):

1. **`plan`** — Model proposes actions and capability annotations; no tools.  
2. **`request_authority`** — Harness materializes a **`delegation_request`** (model content validated and normalized; harness fields authoritative).  
3. **`validate_authority`** — Policy engine evaluates the request and emits **`delegation_decision`**.  
4. **`delegate_narrow`** — Auth broker issues **`authority_receipt`** with `granted_scope ≤` effective allowed scope (set-theoretic or lattice comparison per deployment).  
5. **`execute_tool`** — Tool executor accepts dispatch only with valid receipt (or documented standing grant shortcut per RFC 0007 §10.1). [RFC 0048](0048-execution-receipts-audit-envelopes.md) SHOULD cite the `receipt_id`.

Standing authorization (`plan` → `execute_tool` shortcut) bypasses this chain only where policy explicitly allows; the execution receipt still MUST cite how obligation was satisfied.

---

## 5. Token exchange mapping (OAuth2 / Keycloak mental model)

Implementers integrating with OAuth2-style systems MAY map fields as follows. This is **informative**, not a mandate to use OAuth2 wire formats inside the trace.

| Open CoT field | OAuth2 / Keycloak analogue |
|----------------|----------------------------|
| `requested_scope` | OAuth2 **scope** string or structured scope request in token exchange. |
| `narrowed_scope` / `granted_scope` | **Reduced scope** in token exchange or RAR-style authorization response. |
| `permission_id` | **Access token** (or token id / session id referencing server-side grant). |
| `expires_at` | JWT **`exp`** claim or token lifetime end. |
| `audience` | **`aud`** claim — intended resource server(s). |
| `forwardable` | Whether a **token exchange** (RFC 8693) onward delegation is permitted (`true` ≈ exchange allowed to downstream clients). |

`one_shot` maps to single-use exchange or one-time redemption flags where the STS supports them.

---

## 6. Full schema (JSON Schema)

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/rfc0047/delegation-extension.json",
  "title": "Open CoT RFC 0047 — Delegation Extension",
  "type": "object",
  "additionalProperties": false,
  "$defs": {
    "scope": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "resource": { "type": "string", "minLength": 1 },
        "action": { "type": "string", "minLength": 1 },
        "constraints": { "type": "object" }
      },
      "required": ["resource", "action"]
    },
    "provenance": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "trace_step_id": { "type": "string" },
        "plan_version": { "type": "string" }
      }
    },
    "delegation_request": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "schema_version": { "type": "string", "enum": ["0.1"] },
        "request_id": { "type": "string", "minLength": 1 },
        "requester": { "type": "string", "minLength": 1 },
        "run_id": { "type": "string", "minLength": 1 },
        "timestamp": { "type": "string", "format": "date-time" },
        "intent": { "type": "string" },
        "justification": { "type": "string" },
        "requested_scope": { "$ref": "#/$defs/scope" },
        "preferred_ttl_seconds": { "type": "integer", "minimum": 1 },
        "preferred_audience": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "task_context_ref": { "type": "string" },
        "provenance": { "$ref": "#/$defs/provenance" }
      },
      "required": ["schema_version", "request_id", "requester", "run_id", "requested_scope", "timestamp"]
    },
    "delegation_decision": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "schema_version": { "type": "string", "enum": ["0.1"] },
        "decision_id": { "type": "string", "minLength": 1 },
        "request_id": { "type": "string", "minLength": 1 },
        "status": {
          "type": "string",
          "enum": ["approved", "denied", "narrowed", "escalated"]
        },
        "decided_by": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "kind": { "type": "string", "enum": ["policy", "human", "harness"] },
            "policy_id": { "type": "string" },
            "human_approver": { "type": "string" }
          },
          "required": ["kind"]
        },
        "policy_refs": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "narrowed_scope": { "$ref": "#/$defs/scope" },
        "denial_reason": { "type": "string" },
        "escalation_target": { "type": "string" },
        "timestamp": { "type": "string", "format": "date-time" }
      },
      "required": ["schema_version", "decision_id", "request_id", "status", "decided_by", "policy_refs", "timestamp"]
    },
    "integrity": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "hash_algorithm": { "type": "string", "minLength": 1 },
        "content_hash": { "type": "string", "minLength": 1 },
        "signature": { "type": "string" },
        "signing_key_id": { "type": "string" }
      },
      "required": ["hash_algorithm", "content_hash"]
    },
    "authority_receipt": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "schema_version": { "type": "string", "enum": ["0.1"] },
        "receipt_id": { "type": "string", "minLength": 1 },
        "decision_id": { "type": "string", "minLength": 1 },
        "request_id": { "type": "string", "minLength": 1 },
        "permission_id": { "type": "string", "minLength": 1 },
        "granted_scope": { "$ref": "#/$defs/scope" },
        "granted_at": { "type": "string", "format": "date-time" },
        "expires_at": { "type": "string", "format": "date-time" },
        "one_shot": { "type": "boolean" },
        "forwardable": { "type": "boolean" },
        "audience": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "integrity": { "$ref": "#/$defs/integrity" }
      },
      "required": ["schema_version", "receipt_id", "decision_id", "request_id", "permission_id", "granted_scope", "granted_at", "expires_at", "one_shot", "forwardable", "audience", "integrity"]
    }
  },
  "properties": {
    "delegation_request": { "$ref": "#/$defs/delegation_request" },
    "delegation_decision": { "$ref": "#/$defs/delegation_decision" },
    "authority_receipt": { "$ref": "#/$defs/authority_receipt" }
  }
}
```
<!-- opencot:schema:end -->

---

## 7. Worked example — email read narrowed to headers only

The model asks to read full messages; policy narrows to **headers only**; broker mints a receipt the mail adapter will enforce.

**`delegation_request`**

```json
{
  "schema_version": "0.1",
  "request_id": "dr_email_9f3a",
  "requester": "agent:org/acme/exec-worker-07",
  "run_id": "run_20260418_0412",
  "timestamp": "2026-04-18T04:12:01Z",
  "intent": "Summarize unread customer threads for Q2 report",
  "justification": "User approved inbox analysis task in session ctx-88",
  "requested_scope": {
    "resource": "mailbox:support@acme.example",
    "action": "email.read",
    "constraints": { "folders": ["INBOX"], "max_messages": 50 }
  },
  "preferred_ttl_seconds": 900,
  "preferred_audience": ["api://mail.acme.internal"],
  "task_context_ref": "ctx://sessions/88/plan_step_4",
  "provenance": { "trace_step_id": "ts_4412", "plan_version": "pv_12" }
}
```

**`delegation_decision`** (`narrowed`)

```json
{
  "schema_version": "0.1",
  "decision_id": "dd_email_9f3a_01",
  "request_id": "dr_email_9f3a",
  "status": "narrowed",
  "decided_by": { "kind": "policy", "policy_id": "pol_mail_default_v3" },
  "policy_refs": ["rule:mail.no_body_for_delegated", "rule:mail.headers_only_low_trust"],
  "narrowed_scope": {
    "resource": "mailbox:support@acme.example",
    "action": "email.read_headers",
    "constraints": { "folders": ["INBOX"], "max_messages": 50, "strip": ["body", "attachments"] }
  },
  "timestamp": "2026-04-18T04:12:01Z"
}
```

**`authority_receipt`**

```json
{
  "schema_version": "0.1",
  "receipt_id": "ar_email_9f3a_01",
  "decision_id": "dd_email_9f3a_01",
  "request_id": "dr_email_9f3a",
  "permission_id": "perm_mail_hdr_7c21",
  "granted_scope": {
    "resource": "mailbox:support@acme.example",
    "action": "email.read_headers",
    "constraints": { "folders": ["INBOX"], "max_messages": 50, "strip": ["body", "attachments"] }
  },
  "granted_at": "2026-04-18T04:12:02Z",
  "expires_at": "2026-04-18T04:27:02Z",
  "one_shot": false,
  "forwardable": false,
  "audience": ["api://mail.acme.internal"],
  "integrity": {
    "hash_algorithm": "sha256",
    "content_hash": "sha256:canonical_payload_hex_omitted_for_brevity"
  }
}
```

---

## 8. Open questions — resolution

| Question | Resolution |
|----------|------------|
| May `status: approved` still carry a `narrowed_scope`? | **Discouraged.** Prefer `narrowed` whenever scope differs from the request; brokers MUST emit `granted_scope ⊆ requested_scope` either way. |
| Are model-originated JSON blobs for requests trusted? | **No.** Harness re-serializes after validation; `requester` and ids are never taken from model output. |
| Single receipt for batched tools? | **Implementation choice.** Each dispatch SHOULD reference a receipt whose `granted_scope` covers that call; batching multiple tools under one receipt requires explicit policy support. |

---

## 9. Acceptance criteria

1. For every tool side effect outside standing grants, the trace contains **`delegation_request`** → **`delegation_decision`** → **`authority_receipt`** in causal order with matching ids.  
2. **`delegation_decision`** objects in audited stores MUST NOT be creatable or editable via model-facing APIs.  
3. **`authority_receipt.integrity.content_hash`** MUST be verified before `execute_tool` dispatch; mismatch aborts execution and logs a security event.  
4. `requester` MUST equal a registered [RFC 0026](0026-agent-identity-auth.md) `agent_id` vetted for the run.  
5. [RFC 0048](0048-execution-receipts-audit-envelopes.md) tool execution records SHOULD include `receipt_id` (or standing-grant citation per RFC 0007); OAuth2 mappings in §5 are **optional**—native Open CoT objects are normative.

---

## 10. Conclusion

RFC 0047 v0.1 formalizes **delegation as data**: requests capture intent, decisions capture policy outcomes, and receipts capture brokered grants with tamper-evident integrity—preserving the invariant that **only the harness ecosystem authorizes**, while remaining mappable to familiar token-exchange deployments.
