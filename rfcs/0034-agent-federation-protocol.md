# RFC 0034 — Agent Federation Protocol, Status: Draft, Author: Open CoT Community, Created: 2026-04-14

## 1. Summary

This RFC defines how **independent Open-CoT deployments** (“peers”) interoperate when agents must delegate work across organizational or network boundaries while **retaining local policy sovereignty**. Each peer runs its own policy engine and identity plane; federation adds a **trust framework** for verifying peers, constraining accepted delegation scopes, and exchanging **`federation_request`** / **`federation_response`** messages that embed the standard **`delegation_request`** and **`delegation_decision`** objects from [RFC 0047](0047-delegation-extension.md). The result is cross-tenant collaboration without a single global “god” policy service—only negotiated trust and cryptographic verification.

## 2. Motivation

Multi-cluster and multi-company agent workflows are inevitable (support handoffs, joint research, supply-chain automation). Naïvely forwarding API keys or model prompts between parties collapses auditability and explodes confused-deputy risk. Federation needs: **stable peer identities**, **graded trust levels**, **scope caps**, **TTL limits**, **delegation path transparency** (`trust_chain[]`), and **tamper-evident responses** so downstream executors can prove which peer authorized what.

## 3. Design

**Roles:** Source peer signs and sends `federation_request` for hosted agents ([RFC 0026](0026-agent-identity-auth.md)). Target peer evaluates locally and maps foreign scopes—never inherits source policy verbatim. Optional trust coordinator tracks `last_verified_at` / key rotation.

**Trust levels:** `untrusted` (crypto id only; often needs human gate), `verified` (due diligence + contract), `trusted` (automation)—all still cap TTL and intersect `accepted_scopes[]`.

**Flow:** (1) Harness builds `delegation_request` for remote work. (2) Gateway wraps it with `trust_chain` (start `[source_peer_id]`). (3) Target policy emits `federation_response` + `delegation_decision`. (4) Broker may mint `authority_receipt` ([RFC 0047](0047-delegation-extension.md)); execution receipts SHOULD cite federation + delegation ids ([RFC 0048](0048-execution-receipts-audit-envelopes.md)). (5) Multi-hop appends peers; each hop re-signs.

**Vs. [RFC 0027](0027-distributed-agent-execution-protocol.md):** 0027 is routing/topology; this RFC is the cross-admin trust and delegation envelope (orthogonal transport headers).

## 4. JSON Schema

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/rfc0034/federation.json",
  "title": "Open CoT RFC 0034 — Agent Federation Protocol",
  "type": "object",
  "additionalProperties": false,
  "$defs": {
    "trust_level": {
      "type": "string",
      "enum": ["untrusted", "verified", "trusted"]
    },
    "federation_peer": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "peer_id": { "type": "string", "minLength": 1 },
        "endpoint": { "type": "string", "format": "uri" },
        "trust_level": { "$ref": "#/$defs/trust_level" },
        "public_key": { "type": "string", "minLength": 1 },
        "accepted_scopes": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "max_delegation_ttl_seconds": { "type": "integer", "minimum": 1 },
        "last_verified_at": { "type": "string", "format": "date-time" }
      },
      "required": ["peer_id", "endpoint", "trust_level", "public_key", "accepted_scopes", "max_delegation_ttl_seconds"]
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
    "federation_request": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "schema_version": { "type": "string", "enum": ["0.1"] },
        "request_id": { "type": "string", "minLength": 1 },
        "source_peer_id": { "type": "string", "minLength": 1 },
        "target_peer_id": { "type": "string", "minLength": 1 },
        "delegation_request": {
          "$ref": "https://opencot.dev/schema/rfc0047/delegation-extension.json#/$defs/delegation_request"
        },
        "trust_chain": { "type": "array", "items": { "type": "string", "minLength": 1 }, "minItems": 1 }
      },
      "required": ["schema_version", "request_id", "source_peer_id", "target_peer_id", "delegation_request", "trust_chain"]
    },
    "federation_response": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "schema_version": { "type": "string", "enum": ["0.1"] },
        "request_id": { "type": "string", "minLength": 1 },
        "status": {
          "type": "string",
          "enum": ["accepted", "rejected", "narrowed"]
        },
        "delegation_decision": {
          "$ref": "https://opencot.dev/schema/rfc0047/delegation-extension.json#/$defs/delegation_decision"
        },
        "response_integrity": { "$ref": "#/$defs/integrity" }
      },
      "required": ["schema_version", "request_id", "status", "delegation_decision", "response_integrity"]
    }
  },
  "properties": {
    "federation_peer": { "$ref": "#/$defs/federation_peer" },
    "federation_request": { "$ref": "#/$defs/federation_request" },
    "federation_response": { "$ref": "#/$defs/federation_response" }
  }
}
```
<!-- opencot:schema:end -->

## 5. Examples

**Two-peer federation request** — `research-lab` asks `field-sites` to run a narrowed sensor pull under local policy.

```json
{
  "federation_request": {
    "schema_version": "0.1",
    "request_id": "fedreq_8c21_20260418",
    "source_peer_id": "peer:research-lab.east",
    "target_peer_id": "peer:field-sites.central",
    "trust_chain": ["peer:research-lab.east"],
    "delegation_request": {
      "schema_version": "0.1",
      "request_id": "dr_sensor_pull_441a",
      "requester": "agent:org/lab/planner-alpha",
      "run_id": "run_20260418_0930",
      "timestamp": "2026-04-18T09:30:00Z",
      "intent": "Fetch last 24h of air quality samples for site bundle S-12",
      "justification": "Joint study J-2026-04 approved by both data stewards",
      "requested_scope": {
        "resource": "iot://field-sites/S-12/air_quality",
        "action": "sensor.read",
        "constraints": { "window_hours": 24, "max_rows": 50000 }
      },
      "preferred_ttl_seconds": 600,
      "preferred_audience": ["api://field-sites.internal/ingest"],
      "task_context_ref": "ctx://federation/J-2026-04/step_2",
      "provenance": { "trace_step_id": "ts_9012", "plan_version": "pv_3" }
    }
  }
}
```

Target responds with `status` ∈ {`accepted`,`narrowed`} (or `rejected`), `delegation_decision.request_id` = `dr_sensor_pull_441a`, and `response_integrity` over canonical response bytes.

## 6. Cross-references

[RFC 0026](0026-agent-identity-auth.md) · [RFC 0027](0027-distributed-agent-execution-protocol.md) · [RFC 0047](0047-delegation-extension.md) · [RFC 0048](0048-execution-receipts-audit-envelopes.md)

## 7. Open Questions Resolution

| Topic | Resolution |
|-------|------------|
| Multi-hop signing | Each hop MUST produce an additional signature wrapper (transport profile) not duplicated inside `federation_request`; `trust_chain` is informational for audit, not a substitute for signatures. |
| `accepted_scopes` encoding | String tokens are deployment-defined; peers MUST publish a scope catalog to partners out of band. |
| JSON Schema `$ref` to 0047 | Validators SHOULD bundle resolved schemas offline for air-gapped CI. |

## 8. Acceptance Criteria

`delegation_request.requester` MUST resolve in the source peer registry ([RFC 0026](0026-agent-identity-auth.md)). Target rejects TTL above `max_delegation_ttl_seconds` for source. `federation_response.delegation_decision.request_id` MUST equal nested `delegation_request.request_id`. `response_integrity.content_hash` MUST cover `request_id`, `status`, and canonical `delegation_decision`.
