# RFC 0043 — Auditing & Compliance Logs (v0.2)

**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Schema v0.7  
**Discussion:** https://github.com/supernovae/open-cot/discussions/43

---

## 1. Summary

Open CoT is a **cognitive control plane**: governed agents run under explicit policies, permissions, budgets, and traces. This RFC defines the **audit subsystem**, which emits **immutable, hash-chained evidence** of everything that happened during governed execution—supporting **forensics**, **compliance reporting**, and **tamper detection**.

Audit extends **RFC 0041 (Policy Enforcement)** and **RFC 0031 (Observability & Telemetry)**. Telemetry optimizes operations and reliability; audit provides a **normative evidence trail** (authorization decisions, delegation, tool use, denials, budget outcomes) suitable for regulators, customers, and incident response.

Two schema objects apply: **`audit_event`** (append-only chain links) and **`audit_envelope`** (sealed run summary including chain bounds, roll-ups, and envelope integrity over events plus trace).

## 2. Goals, Non-Goals, and Terminology

**Goals:** append-only semantics for the logical event stream; per-event and envelope **SHA-256** integrity; SIEM-friendly JSON export; explicit hooks to the governed FSM (RFC 0007), permissions (RFC 0042), delegation (RFC 0047), and receipts (RFC 0048).

**Non-Goals:** storage technology, KMS/HSM integration details, PII classification policy (deployments apply their own), and alerting rule engines (RFC 0031).

**Terms:** **Run** = one `run_id`. **Event chain** = ordered `audit_event` list linked by `previous_event_id`. **Genesis** = first event (`previous_event_id: null`). **Sealing** = terminal `trace_sealed` plus `audit_envelope` (RFC 0007 `audit_seal`).

## 3. Data Model

| Object | Role |
|--------|------|
| `audit_event` | One log entry: type, time, actor, type-specific `details`, chain link, integrity. |
| `audit_envelope` | One sealed record per run: timing, outcome, trace hash, chain head/tail, counts, `budget_final`, violations, integrity (optional signature). |

## 4. Event Types and `details`

`event_type` MUST be one of: `run_started`, `policy_evaluated`, `permission_granted`, `permission_consumed`, `permission_expired`, `permission_revoked`, `tool_executed`, `delegation_requested`, `delegation_decided`, `escalation_initiated`, `escalation_resolved`, `postcondition_violated`, `denial_recorded`, `budget_warning`, `budget_exhausted`, `run_completed`, `run_failed`, `trace_sealed`.

`details` is a structured object whose keys depend on `event_type` (policy ids, permission ids, tool names, receipt refs per RFC 0048, delegation refs per RFC 0047, etc.). v0.2 keeps `details` **open** in JSON Schema (`additionalProperties: true`) so implementations can evolve; profiles MAY constrain keys per event type in a later revision.

## 5. Field Semantics (Concise)

**`audit_event`:** `event_id` (UUID), `run_id`, `agent_id`, `timestamp` (RFC 3339 UTC), `event_type`, `details`, `previous_event_id` (UUID or `null` for genesis), `integrity` (`hash_algorithm`, `content_hash`).

**`audit_envelope`:** `envelope_id`, `run_id`, `agent_id` (primary), `started_at`, `sealed_at`, `completion_status`, `trace_hash`, `event_chain_head`, `event_chain_tail`, `event_count`, `delegation_summary`, `permission_summary`, `budget_final` (RFC 0038 snapshot shape), `policy_violations[]`, `integrity` (hash required; `signature_algorithm` / `signature` optional).

**`completion_status`:** `succeeded` | `failed` | `denied` | `budget_exhausted` | `external_stop` | `escalation_timeout` | `fail_safe`.

**`policy_violations[]` items:** `violation_id`, `policy_id`, optional `rule_id`, `occurred_at`, `severity`, `description`, optional `related_event_id`.

## 6. Hash Chaining and Integrity

**Per-event `content_hash`:** SHA-256 over **canonical JSON** of the event with the **`integrity` object omitted**. Canonical rules: UTF-8, lexicographic key order, no insignificant whitespace, explicit `null`. Digest hex-encoded lowercase in `integrity.content_hash`.

**Chain:** Genesis uses `previous_event_id: null`. Each later event sets `previous_event_id` to the **predecessor’s `event_id`**. If any event body is altered or removed, that event’s hash fails verification and/or chain pointers no longer match stored order.

**Envelope `content_hash`:** Same algorithm; hashed material is the canonical representation of the envelope **excluding `integrity`**, plus the deployment-defined binding of **ordered event list + `trace_hash`** (implementations MUST document the exact serialization of “chain + trace” in the deployment profile). Optional **detached signature** on the envelope attests the digest without changing verifiers that only check hashes.

**Implementation profile:** Deployments SHOULD publish a short profile document that names the canonical JSON library or rules, how `trace_hash` is computed over the governed trace artifact, and how the envelope binds the ordered events (e.g., hash of concatenated per-event `content_hash` values vs. hash of a single JSON array). **Redaction:** If `details` contains sensitive literals, writers MAY substitute digests or elide fields **before** hashing only when the profile explicitly defines a redaction map; otherwise redaction invalidates verification.

## 7. Compliance Export and FSM Alignment

**SIEM:** NDJSON stream of `audit_event`; correlate on `run_id`; map `event_type` to severity tiers. **SOC2-style access reviews:** Show `policy_evaluated`, `permission_*`, `tool_executed`, `denial_recorded`, and envelope roll-ups. **Forensics:** Ordered events + `trace_hash` + governed trace (RFC 0001 linkage) + receipt ids in `details` (RFC 0048).

**RFC 0007:** `run_started` on enter; policy gates → `policy_evaluated` / `denial_recorded` / `run_failed` as applicable; terminal success → `run_completed`, then `trace_sealed` and **`audit_envelope`**. The **`audit_seal`** transition is the only place that may finalize `trace_sealed` and publish the envelope.

## 8. JSON Schema — `audit_event`

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0043 — audit_event",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "schema_version": { "type": "string", "enum": ["0.2"] },
    "event_id": { "type": "string", "format": "uuid" },
    "run_id": { "type": "string", "minLength": 1 },
    "agent_id": { "type": "string", "minLength": 1 },
    "timestamp": { "type": "string", "format": "date-time" },
    "event_type": { "type": "string", "enum": ["run_started","policy_evaluated","permission_granted","permission_consumed","permission_expired","permission_revoked","tool_executed","delegation_requested","delegation_decided","escalation_initiated","escalation_resolved","postcondition_violated","denial_recorded","budget_warning","budget_exhausted","run_completed","run_failed","trace_sealed"] },
    "details": { "type": "object", "additionalProperties": true },
    "previous_event_id": { "type": ["string", "null"], "format": "uuid" },
    "integrity": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "hash_algorithm": { "type": "string", "enum": ["sha-256"] },
        "content_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
      },
      "required": ["hash_algorithm", "content_hash"]
    }
  },
  "required": ["schema_version","event_id","run_id","agent_id","timestamp","event_type","details","previous_event_id","integrity"]
}
```
<!-- opencot:schema:end -->

## 9. JSON Schema — `audit_envelope`

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0043 — audit_envelope",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "schema_version": { "type": "string", "enum": ["0.2"] },
    "envelope_id": { "type": "string", "format": "uuid" },
    "run_id": { "type": "string", "minLength": 1 },
    "agent_id": { "type": "string", "minLength": 1 },
    "started_at": { "type": "string", "format": "date-time" },
    "sealed_at": { "type": "string", "format": "date-time" },
    "completion_status": { "type": "string", "enum": ["succeeded","failed","denied","budget_exhausted","external_stop","escalation_timeout","fail_safe"] },
    "trace_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "event_chain_head": { "type": "string", "format": "uuid" },
    "event_chain_tail": { "type": "string", "format": "uuid" },
    "event_count": { "type": "integer", "minimum": 1 },
    "delegation_summary": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "total_requested": { "type": "integer", "minimum": 0 },
        "total_granted": { "type": "integer", "minimum": 0 },
        "total_denied": { "type": "integer", "minimum": 0 },
        "total_narrowed": { "type": "integer", "minimum": 0 }
      },
      "required": ["total_requested","total_granted","total_denied","total_narrowed"]
    },
    "permission_summary": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "total_granted": { "type": "integer", "minimum": 0 },
        "total_consumed": { "type": "integer", "minimum": 0 },
        "total_expired": { "type": "integer", "minimum": 0 },
        "total_revoked": { "type": "integer", "minimum": 0 }
      },
      "required": ["total_granted","total_consumed","total_expired","total_revoked"]
    },
    "budget_final": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "tokens_used": { "type": "integer", "minimum": 0 },
        "tokens_remaining": { "type": "integer" },
        "cost_used": { "type": "number", "minimum": 0 },
        "cost_remaining": { "type": "number" },
        "steps_used": { "type": "integer", "minimum": 0 },
        "steps_remaining": { "type": "integer" },
        "tool_calls_used": { "type": "integer", "minimum": 0 },
        "tool_calls_remaining": { "type": "integer" },
        "retries_used": { "type": "integer", "minimum": 0 },
        "retries_remaining": { "type": "integer" }
      }
    },
    "policy_violations": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "violation_id": { "type": "string", "format": "uuid" },
          "policy_id": { "type": "string", "minLength": 1 },
          "rule_id": { "type": "string" },
          "occurred_at": { "type": "string", "format": "date-time" },
          "severity": { "type": "string", "enum": ["info","low","medium","high","critical"] },
          "description": { "type": "string", "minLength": 1 },
          "related_event_id": { "type": "string", "format": "uuid" }
        },
        "required": ["violation_id","policy_id","occurred_at","severity","description"]
      }
    },
    "integrity": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "hash_algorithm": { "type": "string", "enum": ["sha-256"] },
        "content_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
        "signature_algorithm": { "type": "string" },
        "signature": { "type": "string" }
      },
      "required": ["hash_algorithm", "content_hash"]
    }
  },
  "required": ["schema_version","envelope_id","run_id","agent_id","started_at","sealed_at","completion_status","trace_hash","event_chain_head","event_chain_tail","event_count","delegation_summary","permission_summary","budget_final","policy_violations","integrity"]
}
```
<!-- opencot:schema:end -->

## 10. Examples

### 10.1 `audit_event` — `permission_granted`

Illustrative `content_hash`; verifiers recompute from canonical bytes with `integrity` removed.

```json
{"schema_version":"0.2","event_id":"a1b2c3d4-e5f6-4789-a012-3456789abcde","run_id":"run_20260414T153012Z_planner_01","agent_id":"planner.primary","timestamp":"2026-04-14T15:30:18.421Z","event_type":"permission_granted","details":{"permission_id":"perm_search_readonly_01","scope":{"tools":["tool:web_search"],"resources":["urn:opencot:corp_kb:public"]},"ttl_seconds":900,"grantor":"policy_engine@v0.7","policy_binding":{"policy_id":"corp_safe_search","policy_version":"2026.04.1"}},"previous_event_id":"00000000-0000-4000-8000-000000000001","integrity":{"hash_algorithm":"sha-256","content_hash":"7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"}}
```

### 10.2 `audit_envelope` — delegation, tools, success

```json
{"schema_version":"0.2","envelope_id":"f47ac10b-58cc-4372-a567-0e02b2c3d479","run_id":"run_20260414T153012Z_planner_01","agent_id":"planner.primary","started_at":"2026-04-14T15:30:12.000Z","sealed_at":"2026-04-14T15:31:02.883Z","completion_status":"succeeded","trace_hash":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","event_chain_head":"00000000-0000-4000-8000-000000000001","event_chain_tail":"99999999-9999-4999-8999-999999999999","event_count":14,"delegation_summary":{"total_requested":1,"total_granted":1,"total_denied":0,"total_narrowed":1},"permission_summary":{"total_granted":2,"total_consumed":2,"total_expired":0,"total_revoked":0},"budget_final":{"tokens_used":4120,"tokens_remaining":880,"cost_used":0.042,"cost_remaining":0.058,"steps_used":6,"steps_remaining":4,"tool_calls_used":3,"tool_calls_remaining":7,"retries_used":0,"retries_remaining":2},"policy_violations":[],"integrity":{"hash_algorithm":"sha-256","content_hash":"2c624232cdd221699294d012d04dfb23f036edaedd441b52e063bd86ba4a3b74","signature_algorithm":"ed25519","signature":"BASE64_DETACHED_SIGNATURE_PLACEHOLDER"}}
```

## 11. Cross-References

| RFC | Document | Relevance |
|-----|----------|-----------|
| RFC 0007 | [0007-agent-loop-protocol.md](0007-agent-loop-protocol.md) | Governed FSM; `audit_seal`, `trace_sealed`, receipt linkage. |
| RFC 0031 | [0031-agent-observability-telemtry.md](0031-agent-observability-telemtry.md) | Telemetry; audit extends with compliance-grade events. |
| RFC 0035 | [0035-data-provenance-tracking.md](0035-data-provenance-tracking.md) | Provenance and integrity model alignment. |
| RFC 0041 | [0041-policy-enforcement-schema.md](0041-policy-enforcement-schema.md) | Policy evaluations as audit events. |
| RFC 0042 | [0042-permission-acl.md](0042-permission-acl.md) | Permission lifecycle in `permission_*` events. |
| RFC 0047 | *Delegation* (normative wire format cited by RFC 0007 / 0041) | `delegation_*` events and `delegation_summary`. |
| RFC 0048 | *Execution receipts* (normative wire format cited by RFC 0007) | Receipt ids in `tool_executed` / `permission_consumed`. |
| RFC 0038 | [0038-cost-aware-reasoning-budget.md](0038-cost-aware-reasoning-budget.md) | `budget_final` and budget-related events. |

## 12. Open Questions Resolution

| Topic | Resolution (v0.2) |
|-------|-------------------|
| Chain link | `previous_event_id` → predecessor **`event_id`**; tamper evidence from per-event `content_hash` + envelope binding. |
| Per-event signatures | Out of scope for v0.2; optional **envelope** signature only. |
| Strict `details` typing | Deferred; `additionalProperties: true` until stable cross-vendor shapes exist. |
| Multi-agent | Each event carries its **`agent_id`**; envelope `agent_id` is the run’s primary agent. |
| Clock skew | `timestamp` is writer clock; NTP recommended; no logical clocks in schema. |

## 13. Acceptance Criteria

1. Emit required lifecycle and governance events (§4) for every governed run.  
2. Maintain a single valid `previous_event_id` chain per `run_id`.  
3. Verify each event’s `integrity.content_hash` per §6; verify envelope hash per deployment profile.  
4. On seal, emit one `audit_envelope` consistent with chain head/tail/count and `trace_hash`.  
5. Reconcile `delegation_summary` and `permission_summary` against `delegation_*` and `permission_*` events.  
6. Export ordered events + envelope without dropping required fields (NDJSON or JSON bundle).

## 14. Conclusion

RFC 0043 v0.2 specifies **`audit_event`** and **`audit_envelope`**: a hash-chained evidentiary stream and a sealed run summary for forensic, compliance, and integration use—aligned with the governed execution model and sibling RFCs on policy, permissions, delegation, receipts, budget, provenance, and observability.
