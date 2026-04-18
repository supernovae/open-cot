# RFC 0048 — Execution Receipts & Audit Envelopes (v0.1)

**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-18  
**Target Version:** Schema v0.8  
**Discussion:** https://github.com/supernovae/open-cot/discussions/48

## 1. Summary

Open-CoT is a cognitive control plane. **Execution receipts** are tamper-evident records that prove what happened during governed agent execution, linking each tool call to the authorizing permission, policy path, and delegation context. **Audit envelopes** seal a full run: trace hash, artifact IDs, summaries, final budget (RFC 0038), and optional signatures. Receipts are per tool call; envelopes are emitted once per run in `audit_seal`. Neither object carries raw tool I/O—only **SHA-256** hashes of canonical serialized payloads—so artifacts can be shared for compliance without exposing secrets. Integrity blocks mirror RFC 0035. This RFC normatively defines `tool_execution_receipt` and `audit_envelope` for Schema v0.8.

## 2. `tool_execution_receipt`

Produced by the tool executor after every tool call. Fields: `execution_id` (uuid), `run_id`, `tool_name`, `permission_id` (RFC 0042), `authority_receipt_id` (RFC 0047), `input_hash` / `output_hash` (SHA-256 hex of canonical serialized I/O, not raw bytes), `output_size_bytes`, `started_at` / `completed_at` (ISO 8601), `duration_ms`, `status` ∈ {`success`,`error`,`timeout`,`quarantined`}, optional `error_category` ∈ {`timeout`,`invalid_input`,`not_found`,`permission_denied`,`rate_limit`,`internal_error`} (RFC 0018), `postcondition_check` ∈ {`passed`,`failed`,`skipped`}, optional `postcondition_violation`, `sandbox_state_hash`, `integrity`: `{ hash_algorithm: "sha256", content_hash }` where `content_hash` covers the full object **excluding** `integrity`.

## 3. `audit_envelope`

Sealed summary of a governed run (RFC 0043 introduces auditing; this RFC specifies the envelope schema and lifecycle). Fields: `envelope_id` (uuid), `run_id`, `agent_id`, `task_hash`, `started_at`, `sealed_at`, `completion_status` ∈ {`succeeded`,`failed`,`denied`,`budget_exhausted`,`external_stop`,`escalation_timeout`,`fail_safe`}, `trace_hash`, `delegation_requests` / `delegation_decisions` (string IDs), `authority_receipts` / `tool_execution_receipts` (ID arrays), `delegation_summary` (`total_requested`, `total_approved`, `total_denied`, `total_narrowed`, `total_escalated`), `permission_summary` (`total_granted`, `total_consumed`, `total_expired`, `total_revoked`), `budget_final` (RFC 0038 `BudgetSnapshot`), `policy_violations` (`violation_id`, `policy_id`, `rule_id`, `description`, `severity`, `timestamp`), `integrity` (`hash_algorithm`, `content_hash`, optional `signature`, `signing_key_id`). `content_hash` covers all fields **except** `integrity`.

## 4. JSON Schema — `tool_execution_receipt`

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/v0.8/tool_execution_receipt.json",
  "title": "Open CoT RFC 0048 — tool_execution_receipt",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "execution_id": { "type": "string", "format": "uuid" },
    "run_id": { "type": "string", "minLength": 1 },
    "tool_name": { "type": "string", "minLength": 1 },
    "permission_id": { "type": "string", "minLength": 1 },
    "authority_receipt_id": { "type": "string", "minLength": 1 },
    "input_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "output_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "output_size_bytes": { "type": "integer", "minimum": 0 },
    "started_at": { "type": "string", "format": "date-time" },
    "completed_at": { "type": "string", "format": "date-time" },
    "duration_ms": { "type": "integer", "minimum": 0 },
    "status": { "type": "string", "enum": ["success", "error", "timeout", "quarantined"] },
    "error_category": { "type": "string", "enum": ["timeout", "invalid_input", "not_found", "permission_denied", "rate_limit", "internal_error"] },
    "postcondition_check": { "type": "string", "enum": ["passed", "failed", "skipped"] },
    "postcondition_violation": { "type": "string" },
    "sandbox_state_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "integrity": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "hash_algorithm": { "type": "string", "const": "sha256" },
        "content_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
      },
      "required": ["hash_algorithm", "content_hash"]
    }
  },
  "required": ["execution_id", "run_id", "tool_name", "permission_id", "authority_receipt_id", "input_hash", "output_hash", "output_size_bytes", "started_at", "completed_at", "duration_ms", "status", "postcondition_check", "sandbox_state_hash", "integrity"]
}
```
<!-- opencot:schema:end -->

## 5. JSON Schema — `audit_envelope`

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/v0.8/audit_envelope.json",
  "title": "Open CoT RFC 0048 — audit_envelope",
  "type": "object",
  "additionalProperties": false,
  "definitions": {
    "budget_snapshot_rfc0038": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "tokens_used": { "type": "integer", "minimum": 0 }, "tokens_remaining": { "type": "integer" },
        "cost_used": { "type": "number", "minimum": 0 }, "cost_remaining": { "type": "number" },
        "steps_used": { "type": "integer", "minimum": 0 }, "steps_remaining": { "type": "integer" },
        "tool_calls_used": { "type": "integer", "minimum": 0 }, "tool_calls_remaining": { "type": "integer" },
        "retries_used": { "type": "integer", "minimum": 0 }, "retries_remaining": { "type": "integer" }
      },
      "required": ["tokens_used", "tokens_remaining", "cost_used", "cost_remaining", "steps_used", "steps_remaining", "tool_calls_used", "tool_calls_remaining", "retries_used", "retries_remaining"]
    },
    "policy_violation_entry": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "violation_id": { "type": "string", "minLength": 1 }, "policy_id": { "type": "string", "minLength": 1 },
        "rule_id": { "type": "string", "minLength": 1 }, "description": { "type": "string" },
        "severity": { "type": "string", "enum": ["info", "low", "medium", "high", "critical"] },
        "timestamp": { "type": "string", "format": "date-time" }
      },
      "required": ["violation_id", "policy_id", "rule_id", "description", "severity", "timestamp"]
    }
  },
  "properties": {
    "envelope_id": { "type": "string", "format": "uuid" },
    "run_id": { "type": "string", "minLength": 1 },
    "agent_id": { "type": "string", "minLength": 1 },
    "task_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "started_at": { "type": "string", "format": "date-time" },
    "sealed_at": { "type": "string", "format": "date-time" },
    "completion_status": { "type": "string", "enum": ["succeeded", "failed", "denied", "budget_exhausted", "external_stop", "escalation_timeout", "fail_safe"] },
    "trace_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "delegation_requests": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "delegation_decisions": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "authority_receipts": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "tool_execution_receipts": { "type": "array", "items": { "type": "string", "format": "uuid" } },
    "delegation_summary": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "total_requested": { "type": "integer", "minimum": 0 }, "total_approved": { "type": "integer", "minimum": 0 },
        "total_denied": { "type": "integer", "minimum": 0 }, "total_narrowed": { "type": "integer", "minimum": 0 },
        "total_escalated": { "type": "integer", "minimum": 0 }
      },
      "required": ["total_requested", "total_approved", "total_denied", "total_narrowed", "total_escalated"]
    },
    "permission_summary": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "total_granted": { "type": "integer", "minimum": 0 }, "total_consumed": { "type": "integer", "minimum": 0 },
        "total_expired": { "type": "integer", "minimum": 0 }, "total_revoked": { "type": "integer", "minimum": 0 }
      },
      "required": ["total_granted", "total_consumed", "total_expired", "total_revoked"]
    },
    "budget_final": { "$ref": "#/definitions/budget_snapshot_rfc0038" },
    "policy_violations": { "type": "array", "items": { "$ref": "#/definitions/policy_violation_entry" } },
    "integrity": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "hash_algorithm": { "type": "string", "const": "sha256" },
        "content_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
        "signature": { "type": "string" }, "signing_key_id": { "type": "string" }
      },
      "required": ["hash_algorithm", "content_hash"]
    }
  },
  "required": ["envelope_id", "run_id", "agent_id", "task_hash", "started_at", "sealed_at", "completion_status", "trace_hash", "delegation_requests", "delegation_decisions", "authority_receipts", "tool_execution_receipts", "delegation_summary", "permission_summary", "budget_final", "policy_violations", "integrity"]
}
```
<!-- opencot:schema:end -->

## 6. Lifecycle — Tool Execution Receipt

1. Tool executor receives tool call request and AuthorityReceipt.  
2. Executor validates permission is active and not expired.  
3. Executor hashes canonical serialized input → `input_hash`.  
4. Tool runs.  
5. Executor hashes output → `output_hash`, records size, evaluates postconditions.  
6. Receipt is produced and appended to the run’s receipt list; `integrity.content_hash` set.  
7. If permission is one-shot, it is marked consumed.

## 7. Lifecycle — Audit Envelope

1. Harness enters `audit_seal` FSM state (RFC 0007).  
2. All outstanding permissions are verified revoked or consumed.  
3. Trace is serialized and hashed → `trace_hash`.  
4. Delegation requests/decisions and authority/tool receipts are collected by ID.  
5. Summaries and `budget_final` are computed.  
6. `integrity.content_hash` is computed over the envelope excluding `integrity`.  
7. Optionally, signature is applied using harness signing key (`signature`, `signing_key_id`).  
8. Envelope is sealed and immutable.

## 8. Integrity Verification

1. Recompute envelope `content_hash` over all fields except `integrity`; compare to stored `content_hash`.  
2. If `signature` is present, verify with the public key for `signing_key_id`.  
3. For each `tool_execution_receipt` referenced, verify that receipt’s `content_hash` (body minus `integrity`).  
4. For each `authority_receipt` referenced, verify its content hash (RFC 0047).  
5. Verify `trace_hash` matches SHA-256 of the actual canonical trace.  
Any mismatch ⇒ **INVALID** and must be flagged.

## 9. Examples

Synthetic 64-char lowercase hex stands in for real SHA-256; conforming `content_hash` values must be recomputed over the canonical payload.

### 9.1 `tool_execution_receipt` — successful `web_search`

```json
{
  "execution_id": "a1b2c3d4-e5f6-47a8-9c0d-1e2f3a4b5c6d",
  "run_id": "run_20260418_01",
  "tool_name": "web_search",
  "permission_id": "perm_search_7f91",
  "authority_receipt_id": "authrecv_4821",
  "input_hash": "2c624232cdd2217b51a00c8949614d17ae3e530c702e9e2fe63c55fe47d65b1e",
  "output_hash": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  "output_size_bytes": 2048,
  "started_at": "2026-04-18T12:00:01.120Z",
  "completed_at": "2026-04-18T12:00:01.890Z",
  "duration_ms": 770,
  "status": "success",
  "postcondition_check": "passed",
  "sandbox_state_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "integrity": { "hash_algorithm": "sha256", "content_hash": "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b" }
}
```

### 9.2 `tool_execution_receipt` — quarantined (postcondition violation)

```json
{
  "execution_id": "f6e5d4c3-b2a1-4098-8765-43210fedcba9",
  "run_id": "run_20260418_02",
  "tool_name": "filesystem_read",
  "permission_id": "perm_fs_read_aabb",
  "authority_receipt_id": "authrecv_ccdd",
  "input_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "output_hash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "output_size_bytes": 512,
  "started_at": "2026-04-18T12:05:00.000Z",
  "completed_at": "2026-04-18T12:05:00.400Z",
  "duration_ms": 400,
  "status": "quarantined",
  "postcondition_check": "failed",
  "postcondition_violation": "Output path escaped allowed sandbox root",
  "sandbox_state_hash": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "integrity": { "hash_algorithm": "sha256", "content_hash": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" }
}
```

### 9.3 `audit_envelope` — two tool calls, one narrowed grant, success

```json
{
  "envelope_id": "11111111-2222-4333-8444-555555555555",
  "run_id": "run_20260418_03",
  "agent_id": "planner-alpha",
  "task_hash": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "started_at": "2026-04-18T11:59:00.000Z",
  "sealed_at": "2026-04-18T12:10:00.000Z",
  "completion_status": "succeeded",
  "trace_hash": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  "delegation_requests": ["dreq_01"],
  "delegation_decisions": ["ddec_01"],
  "authority_receipts": ["authrecv_99"],
  "tool_execution_receipts": ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  "delegation_summary": { "total_requested": 1, "total_approved": 1, "total_denied": 0, "total_narrowed": 1, "total_escalated": 0 },
  "permission_summary": { "total_granted": 2, "total_consumed": 2, "total_expired": 0, "total_revoked": 0 },
  "budget_final": {
    "tokens_used": 4200, "tokens_remaining": 800, "cost_used": 0.04, "cost_remaining": 0.06,
    "steps_used": 6, "steps_remaining": 14, "tool_calls_used": 2, "tool_calls_remaining": 8,
    "retries_used": 0, "retries_remaining": 5
  },
  "policy_violations": [],
  "integrity": { "hash_algorithm": "sha256", "content_hash": "0000000000000000000000000000000000000000000000000000000000000000" }
}
```

## 10. Cross-references

- **RFC 0007** — Governed FSM: `execute_tool` produces receipts; `audit_seal` produces the envelope.  
- **RFC 0035** — Provenance: shared integrity model.  
- **RFC 0038** — Budget: `budget_final` / `BudgetSnapshot`.  
- **RFC 0042** — Permissions: `permission_id` on receipts.  
- **RFC 0043** — Auditing: events reference receipts; envelope is run-level artifact.  
- **RFC 0047** — Delegation: `authority_receipt_id` links delegation to execution.  
- **RFC 0018** — Tool errors: `error_category` subset.

## 11. Open Questions & Resolution

| # | Question | v0.1 stance |
|---|----------|-------------|
| A | Canonical serialization for hashed payloads? | Document and version per harness; future RFC MAY mandate JCS. |
| B | Mandatory signature algorithm? | Signatures optional; algorithm tied to `signing_key_id` registry. |
| C | Seal with active permissions? | Default **fail closed** unless a later RFC defines degraded sealing. |
| D | `quarantined` vs `postcondition_check`? | Prefer `failed` when postconditions caused quarantine; policy-only quarantine MAY use `skipped`. |

## 12. Acceptance Criteria

- [ ] Both JSON Schemas validate instances (examples need real computed `content_hash` values).  
- [ ] Harness emits one receipt per governed tool execution and one sealed envelope per terminal run.  
- [ ] Verifiers mark **INVALID** on hash or signature mismatch.  
- [ ] No raw tool I/O in receipts or envelopes.  
- [ ] RFC 0043 / RFC 0047 cross-link this RFC when next revised.

## 13. Conclusion

Execution receipts and audit envelopes provide a privacy-preserving, tamper-evident chain from delegation through execution to audit, aligned with the governed FSM and shared integrity across Open-CoT.
