# RFC 0026 — Cognitive pipeline Identity & Authentication (v0.2)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Schema v0.5  
**Discussion:** https://github.com/supernovae/open-cot/discussions/26  
---

## 1. Summary

Open CoT is a **cognitive control plane**: the harness mediates every transition between reasoning, policy, delegation, and tool execution. **Cognitive pipeline identity** is how the harness answers *who* is requesting authority. Every delegation request, permission grant, and audit event references a stable `requester_id` and the trust metadata defined here.

This RFC specifies the normative **AgentIdentity** record: identifiers, human-facing labels, operational role, trust tier, declared capabilities (claims only—never grants), optional cryptographic material for signature verification, optional delegation lineage, timestamps, and extensible metadata.

**Cross-references:** [RFC 0007 — Cognitive Pipeline / FSM](0007-cognitive-pipeline-protocol.md) (governed states bind identity to transitions); [RFC 0041 — Policy Enforcement](0041-policy-enforcement-schema.md) (subject matching against `requester_id` and trust); [RFC 0042 — Permissions](0042-permission-acl.md) (`granted_to` and ACL subjects); [RFC 0047 — Delegation Extension](0047-delegation-extension.md) (`delegation_request.requester` MUST resolve to a verified identity).

---

## 2. Motivation

Without a typed identity model, frameworks conflate “the model said so” with authorization, lose auditability across sub-pipelines, and cannot express pre-authorized tool tiers consistently. A single **AgentIdentity** schema lets policy engines match rules, lets permission stores attach grants to principals, and lets delegation receipts bind authority to a **verified** `requester_id`.

---

## 3. Identity model

| Field | Required | Description |
|-------|----------|-------------|
| `requester_id` | yes | Globally unique identifier for this principal within the deployment (URI-safe string). |
| `display_name` | yes | Human-readable label for UIs and logs. |
| `role` | yes | Operational role enum (orchestration vs execution vs verification vs delegated vs custom). |
| `trust_level` | yes | Harness-defined trust tier affecting default pre-authorization posture. |
| `capabilities_declared` | yes | Array of capability strings this cognitive pipeline **claims** to support (advertisement only; grants live in RFC 0042). |
| `public_key` | no | Public key material (encoding defined by deployment; often PEM or base64 raw key). |
| `key_algorithm` | no | Algorithm identifier, e.g. `ed25519`, `p256`. MUST be present if `public_key` is set. |
| `parent_requester_id` | no | If this identity is a delegated sub-cognitive pipeline, the `requester_id` of the delegator. |
| `created_at` | yes | RFC 3339 timestamp when this identity record was first registered. |
| `metadata` | yes | Extensible object for org-specific attributes (team, tenant, labels). MAY be empty `{}`. |

---

## 4. Trust levels

Trust levels describe **default harness posture** for pre-authorized tooling and policy shortcuts. They do not replace explicit permission grants or delegation receipts ([RFC 0047](0047-delegation-extension.md)).

| Value | Meaning |
|-------|---------|
| `untrusted` | No tools pre-authorized; every sensitive action flows through explicit delegation unless a standing grant says otherwise. |
| `low` | Basic **read-only** tools MAY be pre-authorized per deployment policy (e.g., search, calculators). |
| `medium` | A **standard** curated tool set MAY be pre-authorized (still subject to policy and audit). |
| `high` | **Broad** pre-authorization for vetted pipelines; the harness MUST still refuse **self-granted** writes—writes require receipts or human/policy decisions. |
| `system` | **Harness-internal** identity (scheduler, broker, policy adapter). MUST NOT be assigned to model-backed pipelines. |

---

## 5. Full schema (JSON Schema)

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/rfc0026/requester-identity.json",
  "title": "Open CoT RFC 0026 — Cognitive pipeline Identity",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "schema_version": { "type": "string", "enum": ["0.2"] },
    "requester_id": { "type": "string", "minLength": 1, "pattern": "^[A-Za-z0-9._:@/-]+$" },
    "display_name": { "type": "string", "minLength": 1 },
    "role": {
      "type": "string",
      "enum": ["orchestrator", "executor", "verifier", "delegated", "custom"]
    },
    "trust_level": {
      "type": "string",
      "enum": ["untrusted", "low", "medium", "high", "system"]
    },
    "capabilities_declared": {
      "type": "array",
      "items": { "type": "string", "minLength": 1 }
    },
    "public_key": { "type": "string" },
    "key_algorithm": { "type": "string" },
    "parent_requester_id": { "type": "string", "minLength": 1 },
    "created_at": { "type": "string", "format": "date-time" },
    "metadata": { "type": "object" }
  },
  "required": [
    "schema_version",
    "requester_id",
    "display_name",
    "role",
    "trust_level",
    "capabilities_declared",
    "created_at",
    "metadata"
  ],
  "allOf": [
    {
      "if": { "required": ["public_key"], "properties": { "public_key": { "minLength": 1 } } },
      "then": { "required": ["key_algorithm"] }
    }
  ]
}
```
<!-- opencot:schema:end -->

---

## 6. Examples

### 6.1 Orchestrator with signing key

```json
{
  "schema_version": "0.2",
  "requester_id": "cognitive-pipeline:org/acme/planner-main",
  "display_name": "Acme Planner",
  "role": "orchestrator",
  "trust_level": "high",
  "capabilities_declared": ["tool:web.search", "tool:docs.read", "plan:branching"],
  "public_key": "MCowBQYDK2VwAyEA...",
  "key_algorithm": "ed25519",
  "created_at": "2026-04-14T12:00:00Z",
  "metadata": { "tenant": "acme", "env": "prod" }
}
```

### 6.2 Delegated sub-executor, low trust

```json
{
  "schema_version": "0.2",
  "requester_id": "cognitive-pipeline:org/acme/exec-worker-07",
  "display_name": "Delegated worker 07",
  "role": "delegated",
  "trust_level": "low",
  "capabilities_declared": ["tool:email.read_headers"],
  "parent_requester_id": "cognitive-pipeline:org/acme/planner-main",
  "created_at": "2026-04-14T12:05:00Z",
  "metadata": {}
}
```

---

## 7. Open questions — resolution

| Question | Resolution |
|----------|------------|
| Are `capabilities_declared` normative for policy? | **No.** They are **hints** and audit context. Enforcement uses explicit permissions ([RFC 0042](0042-permission-acl.md)) and delegation receipts ([RFC 0047](0047-delegation-extension.md)). |
| Can a model cognitive pipeline use `trust_level: system`? | **No.** `system` is reserved for harness components; registrars MUST reject assignment to model-backed identities. |
| Encoding of `public_key`? | **Deployment-defined.** The schema only requires `key_algorithm` when a key is present; transports SHOULD document encoding (PEM vs raw). |

---

## 8. Acceptance criteria

1. Every `DelegationRequest.requester` ([RFC 0047](0047-delegation-extension.md)) MUST equal an `requester_id` registered in the harness identity store conforming to this schema.  
2. Policy `subject` fields ([RFC 0041](0041-policy-enforcement-schema.md)) MAY reference `requester_id`, `role`, `trust_level`, and labels in `metadata`.  
3. Permission grants ([RFC 0042](0042-permission-acl.md)) MUST bind to `requester_id` (or a group resolved to pipelines), never to free-text model self-identification.  
4. Implementations MUST treat `capabilities_declared` as non-authoritative for allow/deny decisions unless a separate grant references them.  
5. Validators MUST reject `public_key` without `key_algorithm`, and reject `trust_level: system` on identities tagged as model pipelines in the deployment registry.

---

## 9. Conclusion

RFC 0026 v0.2 defines the **AgentIdentity** contract: stable principals, trust tiers, optional cryptography, and explicit separation between **declared** capabilities and **granted** authority—foundation for the governed FSM in RFC 0007 and the delegation objects in RFC 0047.
