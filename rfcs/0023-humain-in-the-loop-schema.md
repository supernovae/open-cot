# RFC 0023 — Human-in-the-Loop Interaction Schema, Status: Draft, Author: Open CoT Community, Created: 2026-04-14

**Discussion:** https://github.com/supernovae/open-cot/discussions/23

## 1. Summary

This RFC defines the **Human-in-the-Loop (HITL) Interaction Schema** for Open-CoT, the cognitive control plane for governed agent execution. It standardizes how agents **request** human judgment (`approval`, `clarification`, `review`, `override`), how supervisors **respond**, and how responses **resume** execution. Payloads are transport-agnostic (UIs, tickets, chatops, async queues).

In [RFC 0007](0007-agent-loop-protocol.md), HITL maps to **`escalate`**: the run pauses on a `human_interaction_request` correlated to `run_id`, `agent_id`, and `step_ref`, until a `human_interaction_response`, **timeout**, or cancellation.

## 2. Motivation

**`require_approval`** ([RFC 0041](0041-policy-enforcement-schema.md)) needs a typed contract—otherwise urgency, timeouts, and linkage to human-consent grants ([RFC 0042](0042-permission-acl.md)) drift across integrations. This RFC specifies **auditable** request/response records composable with traces and receipts. It excludes UI layout, notification routing, and cryptographic proof of human presence.

## 3. Design

**Types:** `approval` (sign-off before side effects), `clarification` (disambiguation), `review` (artifact review), `override` (supersede prior decisions within bounds). **`options[]`** holds `{ id, label, description?, risk_hint? }`; `approval`/`clarification` SHOULD include options for deterministic automation. **`human_interaction_response.decision`** is `approved`, `rejected`, `modified`, or `timeout`; `modified` SHOULD carry **`justification`** (extensions hold extra payload).

**`urgency`** (`low`…`critical`) affects queueing only—not ACL bypass. **`timeout_seconds`** bounds wait before auto-`timeout` (policy defines deny vs retry). **`context`** MUST include `run_id`, `agent_id`, `step_ref`. **`requested_by.agent`** identifies the principal; **`presented_to.human`** names role, person, or queue.

**FSM:** On **`escalate`**, emit `human_interaction_request` before the governed action. On `approved` (+ `selected_option` when options exist), resume per [RFC 0007](0007-agent-loop-protocol.md) toward `validate_authority` / `observe_result`. On `rejected` or timeout-as-deny, do not perform the blocked effect without new delegation ([RFC 0047](0047-delegation-extension.md)).

## 4. JSON Schema

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/human-interaction/v0.1",
  "title": "Open CoT RFC 0023 — Human Interaction",
  "definitions": {
    "human_interaction_request": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "prompt", "urgency", "timeout_seconds", "context", "requested_by", "presented_to"],
      "properties": {
        "type": { "type": "string", "enum": ["approval", "clarification", "review", "override"] },
        "prompt": { "type": "string", "minLength": 1 },
        "options": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["id", "label"],
            "properties": {
              "id": { "type": "string", "minLength": 1 },
              "label": { "type": "string", "minLength": 1 },
              "description": { "type": "string" },
              "risk_hint": { "type": "string", "enum": ["low", "medium", "high"] }
            }
          }
        },
        "urgency": { "type": "string", "enum": ["low", "medium", "high", "critical"] },
        "timeout_seconds": { "type": "integer", "minimum": 1 },
        "context": {
          "type": "object",
          "additionalProperties": false,
          "required": ["run_id", "agent_id", "step_ref"],
          "properties": {
            "run_id": { "type": "string", "minLength": 1 },
            "agent_id": { "type": "string", "minLength": 1 },
            "step_ref": { "type": "string", "minLength": 1 }
          }
        },
        "requested_by": {
          "type": "object",
          "additionalProperties": false,
          "required": ["agent"],
          "properties": {
            "agent": { "type": "string", "minLength": 1 },
            "role": { "type": "string" }
          }
        },
        "presented_to": {
          "type": "object",
          "additionalProperties": false,
          "required": ["human"],
          "properties": {
            "human": { "type": "string", "minLength": 1 },
            "queue": { "type": "string" },
            "channel": { "type": "string" }
          }
        },
        "request_id": { "type": "string", "minLength": 1 }
      }
    },
    "human_interaction_response": {
      "type": "object",
      "additionalProperties": false,
      "required": ["request_id", "decision", "responder_id", "timestamp"],
      "properties": {
        "request_id": { "type": "string", "minLength": 1 },
        "decision": { "type": "string", "enum": ["approved", "rejected", "modified", "timeout"] },
        "selected_option": { "type": "string" },
        "justification": { "type": "string" },
        "responder_id": { "type": "string", "minLength": 1 },
        "timestamp": { "type": "string", "format": "date-time" }
      }
    }
  },
  "oneOf": [
    { "$ref": "#/definitions/human_interaction_request" },
    { "$ref": "#/definitions/human_interaction_response" }
  ]
}
```
<!-- opencot:schema:end -->

## 5. Examples

### 5.1 Approval request (database write)

```json
{
  "request_id": "hitl_req_8f3c2a",
  "type": "approval",
  "prompt": "Approve INSERT into customers (PII) on prod shard?",
  "options": [
    { "id": "approve", "label": "Approve write", "risk_hint": "high" },
    { "id": "reject", "label": "Reject", "risk_hint": "low" }
  ],
  "urgency": "high",
  "timeout_seconds": 900,
  "context": { "run_id": "run_7b91", "agent_id": "support-agent-prod", "step_ref": "plan/12/tool/sql.execute" },
  "requested_by": { "agent": "support-agent-prod", "role": "tier2" },
  "presented_to": { "human": "oncall-db", "queue": "risk-review", "channel": "pager" }
}
```

### 5.2 Clarification request

```json
{
  "request_id": "hitl_req_4410bb",
  "type": "clarification",
  "prompt": "Does 'archive' mean cold storage only, or delete originals after 30d?",
  "options": [
    { "id": "cold_only", "label": "Cold only; retain originals" },
    { "id": "cold_delete", "label": "Cold + delete after 30d", "risk_hint": "high" }
  ],
  "urgency": "medium",
  "timeout_seconds": 3600,
  "context": { "run_id": "run_2aa4", "agent_id": "records-agent", "step_ref": "plan/4/delegate/archive_policy" },
  "requested_by": { "agent": "records-agent" },
  "presented_to": { "human": "legal-ops", "queue": "clarifications" }
}
```

## 6. Cross-references

| RFC | Title | Relationship |
|-----|--------|----------------|
| [RFC 0007](0007-agent-loop-protocol.md) | Agent Loop Protocol | `escalate` pause/resume. |
| [RFC 0041](0041-policy-enforcement-schema.md) | Policy Enforcement | `require_approval` → typed requests. |
| [RFC 0042](0042-permission-acl.md) | Permissions & ACL | Human-consent grants bind `request_id` / context. |
| [RFC 0047](0047-delegation-extension.md) | Delegation | Overrides may require re-delegation. |
| [RFC 0048](0048-execution-receipts-audit-envelopes.md) | Execution Receipts | Responses SHOULD link from envelopes. |

## 7. Open Questions Resolution

| Question | Resolution |
|----------|------------|
| Subsume RLHF / eval feedback ([RFC 0005](0005-rl-reward-trace-schema.md), [RFC 0022](0022-agent-evaluation-protocol.md))? | **No**—those are training/eval traces; this is **runtime governance**. |
| Mandatory `options`? | **SHOULD** for `approval`/`clarification`; optional for `review`/`override` if freeform is allowed. |
| Who may respond? | **`responder_id`** MUST be authenticated; tie to [RFC 0026](0026-agent-identity-auth.md) where possible. |

## 8. Acceptance Criteria

1. Each `human_interaction_request` validates and includes `context.run_id`, `context.agent_id`, `context.step_ref`.
2. Each `human_interaction_response` references `request_id` and a normative `decision`.
3. [RFC 0007](0007-agent-loop-protocol.md) implementations MUST emit these records on `escalate` for [RFC 0041](0041-policy-enforcement-schema.md) `require_approval` when using this profile.
4. Auto-timeout responses use `decision: "timeout"`; policy documents timeout semantics and clocks.
