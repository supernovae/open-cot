# RFC 0027 — Distributed Cognitive pipeline Execution Protocol, Status: Draft, Author: Open CoT Community, Created: 2026-04-14

**Discussion:** https://github.com/supernovae/open-cot/discussions/27

## 1. Summary

This RFC defines the **Distributed Cognitive pipeline Execution Protocol** for Open-CoT: **`execution_node`** advertisements, **`task_assignment`** with explicit **`delegated_scope`**, and terminal **`execution_result`** records (hashes, trace pointers, **`receipt_refs[]`**). Each node runs its own governed FSM ([RFC 0007](0007-cognitive-pipeline-protocol.md)); coordination is explicit.

Participants have distinct identities ([RFC 0026](0026-requester-identity-auth.md)) and MUST obtain authority independently ([RFC 0047](0047-delegation-extension.md)). [RFC 0048](0048-execution-receipts-audit-envelopes.md) receipts chain cross-node work.

## 2. Motivation

Regulated workloads need sandboxes, residency, and blast-radius isolation. Ad hoc RPCs lose parent/child linkage and delegation evidence. These interchange types give orchestrators, workers, and audit pipelines shared semantics. Transport, schedulers, and consensus are out of scope.

## 3. Design

**`execution_node`:** `node_id` (unique), `requester_id` ([RFC 0026](0026-requester-identity-auth.md)), `endpoint` (URL, queue, etc.), `capabilities[]` (e.g. `code.exec`, `tool.invoke`; see [RFC 0016](0016-tool-capability-negotiation.md)), `trust_level` (`low` \| `medium` \| `high`), `status` (`active` \| `draining` \| `offline`).

**`task_assignment`:** `assignment_id`, `task_hash` (canonical task bytes), `assigned_to` (`node_id`), `parent_run_id` ([RFC 0007](0007-cognitive-pipeline-protocol.md)), `delegated_scope` (at minimum `summary`; MAY include `allowed_tools`, `max_risk_level`, `valid_until`) proven under [RFC 0047](0047-delegation-extension.md), `timeout_seconds`, `priority`.

**`execution_result`:** `assignment_id`, `node_id`, `status` (`completed` \| `failed` \| `timeout`), `result_hash`, `trace_ref`, `receipt_refs[]` ([RFC 0048](0048-execution-receipts-audit-envelopes.md)).

**Delegation:** Children re-evaluate policy locally; parent approval does not bypass child `validate_authority`. Mismatch → `failed` plus explanatory receipts.

**Idempotency:** Workers SHOULD treat `assignment_id` as idempotent: redelivered assignments with the same `task_hash` and `delegated_scope` MUST yield the same side effects or a deterministic `failed`/`completed` outcome without double application. Parents SHOULD rotate `assignment_id` when `task_hash` changes.

## 4. JSON Schema

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/distributed-execution/v0.1",
  "title": "Open CoT RFC 0027 — Distributed Execution",
  "definitions": {
    "execution_node": {
      "type": "object",
      "additionalProperties": false,
      "required": ["node_id", "requester_id", "endpoint", "capabilities", "trust_level", "status"],
      "properties": {
        "node_id": { "type": "string", "minLength": 1 },
        "requester_id": { "type": "string", "minLength": 1 },
        "endpoint": { "type": "string", "minLength": 1 },
        "capabilities": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "trust_level": { "type": "string", "enum": ["low", "medium", "high"] },
        "status": { "type": "string", "enum": ["active", "draining", "offline"] }
      }
    },
    "task_assignment": {
      "type": "object",
      "additionalProperties": false,
      "required": ["assignment_id", "task_hash", "assigned_to", "parent_run_id", "delegated_scope", "timeout_seconds", "priority"],
      "properties": {
        "assignment_id": { "type": "string", "minLength": 1 },
        "task_hash": { "type": "string", "minLength": 1 },
        "assigned_to": { "type": "string", "minLength": 1 },
        "parent_run_id": { "type": "string", "minLength": 1 },
        "delegated_scope": {
          "type": "object",
          "additionalProperties": true,
          "required": ["summary"],
          "properties": {
            "summary": { "type": "string", "minLength": 1 },
            "allowed_tools": { "type": "array", "items": { "type": "string" } },
            "max_risk_level": { "type": "string", "enum": ["low", "medium", "high"] },
            "valid_until": { "type": "string", "format": "date-time" }
          }
        },
        "timeout_seconds": { "type": "integer", "minimum": 1 },
        "priority": { "type": "integer" }
      }
    },
    "execution_result": {
      "type": "object",
      "additionalProperties": false,
      "required": ["assignment_id", "node_id", "status", "result_hash", "trace_ref", "receipt_refs"],
      "properties": {
        "assignment_id": { "type": "string", "minLength": 1 },
        "node_id": { "type": "string", "minLength": 1 },
        "status": { "type": "string", "enum": ["completed", "failed", "timeout"] },
        "result_hash": { "type": "string", "minLength": 1 },
        "trace_ref": { "type": "string", "minLength": 1 },
        "receipt_refs": { "type": "array", "items": { "type": "string", "minLength": 1 } }
      }
    }
  },
  "oneOf": [
    { "$ref": "#/definitions/execution_node" },
    { "$ref": "#/definitions/task_assignment" },
    { "$ref": "#/definitions/execution_result" }
  ]
}
```
<!-- opencot:schema:end -->

## 5. Examples

### 5.1 Task assignment to a remote code-execution node

The scheduler MUST select `assigned_to` such that the node’s `node_id` matches, `status` is `active` (or policy allows `draining`), and `capabilities` cover the delegated work (e.g. `code.exec`).

```json
{
  "assignment_id": "asg_9c21f4",
  "task_hash": "sha256:0f1e2d3c4b5a6978",
  "assigned_to": "node-sandbox-usw2-07",
  "parent_run_id": "run_parent_3a88",
  "delegated_scope": {
    "summary": "Execute untrusted snippet → CSV summary; no network; no secrets.",
    "allowed_tools": ["python.exec_cell", "filesystem.read_workspace"],
    "max_risk_level": "medium",
    "valid_until": "2026-04-14T15:30:00Z"
  },
  "timeout_seconds": 120,
  "priority": 10
}
```

## 6. Cross-references

| RFC | Title | Relationship |
|-----|--------|----------------|
| [RFC 0007](0007-cognitive-pipeline-protocol.md) | Cognitive Pipeline Protocol | Per-node FSM. |
| [RFC 0026](0026-requester-identity-auth.md) | Cognitive pipeline Identity | Node `requester_id` + authn/z. |
| [RFC 0047](0047-delegation-extension.md) | Delegation | `delegated_scope` vs proofs. |
| [RFC 0048](0048-execution-receipts-audit-envelopes.md) | Execution Receipts | `receipt_refs`. |
| [RFC 0016](0016-tool-capability-negotiation.md) | Capability Negotiation | Routing on `capabilities`. |

## 7. Open Questions Resolution

| Question | Resolution |
|----------|------------|
| Include proofs in `task_hash`? | **Recommended** canonicalization includes scope + policy snapshot ids; document per deployment. |
| Streaming partial results? | **Out of scope**—only terminal `execution_result` here. |
| Missing receipts? | Still emit `result_hash` / `trace_ref`; `receipt_refs` empty only if policy allows degraded audit ([RFC 0048](0048-execution-receipts-audit-envelopes.md)). |

## 8. Acceptance Criteria

1. `task_assignment` includes `task_hash`, `parent_run_id`, `delegated_scope.summary`, valid `assigned_to`.
2. Child nodes re-check [RFC 0047](0047-delegation-extension.md) before side effects.
3. `execution_result.assignment_id` matches the assignment; includes `status`, `result_hash`, `trace_ref`, `receipt_refs` per §3.
4. Schedulers honor `execution_node.status` per §3.1.
5. Workers document idempotency behavior for repeated `assignment_id` / `task_hash` pairs per §3.
