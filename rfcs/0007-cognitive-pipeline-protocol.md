# RFC 0007 — Governed Execution FSM (Cognitive Pipeline Protocol)

**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Schema v0.3  
**Discussion:** https://github.com/supernovae/open-cot/discussions/7

---

## 1. Summary

This RFC replaces the earlier linear **Cognitive Pipeline Protocol** with the **Governed Execution FSM**: a fourteen-state finite state machine that defines how Open CoT pipelines move from accepted input to sealed audit output under explicit authority, policy, and tooling constraints.

Open CoT is positioned as a **cognitive control plane**. The FSM is the normative contract between model output (proposals only), schema validation, harness enforcement, policy evaluation, delegation, tool execution, and audit. The governing principle is strict: **the model cannot self-authorize**. The model may request capabilities; only the harness, policy engine, and authorized brokers may grant, narrow, or deny them.

This document specifies state semantics, allowed transitions, receipt obligations, JSON Schemas for machine-readable FSM definitions and governed traces, and a full worked trajectory. It extends and unifies related RFCs listed in Section 7.

---

## 2. Motivation

Ad-hoc cognitive pipelines conflate planning, permissioning, tool use, and completion. That makes it easy for a model’s natural-language output to be mistaken for authorization, for tool calls to run without an auditable grant chain, and for policy to be applied inconsistently before versus after side effects occur.

A governed FSM separates **proposal** from **commitment**: structured envelopes express intent; the harness validates against schema; policy evaluates; an auth broker narrows grants; tools run only in one state with consumed permissions; receipts prove what happened; a terminal audit state seals integrity. Implementers get a single interoperable execution backbone suitable for regulated, cost-aware, and sandboxed deployments (see RFC 0017, RFC 0038).

---

## 3. Design Goals

### 3.1 Must-have goals

- Define a **normative** fourteen-state FSM with explicit entry (`receive`) and terminal audit (`audit_seal`).
- Ensure **exactly one** state may perform tool side effects: `execute_tool`.
- Require **non-forgeable** authority: every tool dispatch MUST hold either a valid, non-expired `AuthorityReceipt` with `granted_scope` not broader than the approved request, **or** a documented **standing authorization** (Section 10.1) cited on the execution receipt.
- Make **policy consultation** explicit at interpretation, planning, authority validation, observation, critique, and finalization boundaries.
- Preserve a **pre-authorized shortcut** from `plan` to `execute_tool` for standing grants (e.g., sandbox allowlists) so simple loops remain representable without abandoning governance.
- Support deterministic replay: state order, transitions, and receipt identifiers MUST be serializable.

### 3.2 Non-goals

- Prescribing a specific planner, critic, or model family.
- Defining the full content of `DelegationRequest`, `DelegationDecision`, or receipt payloads (normative detail lives in RFC 0047 and RFC 0048).
- Mandating a particular human-approval UX for `escalate` (only the control flow is normative here).

---

## 4. Architectural thesis

Normative separation of roles: **models propose**; **schemas express**; **harnesses validate and drive state**; **policy evaluates** at consultation points (with per-capability evaluation in `validate_authority`); **auth brokers narrow** to `AuthorityReceipt` with `granted_scope ≤ requested_scope` (non-forwardable by default); **tools execute only** in `execute_tool` under valid grant with **atomic** permission consumption (RFC 0048); **audit seals** the trace in `audit_seal`.

---

## 5. State definitions (normative)

Every compliant run **MUST** begin in `receive` and **MUST** end in `audit_seal` (external abort SHOULD still yield a sealed partial audit per deployer policy).

**Execution path.** `receive` — accept input, establish run context, emit `run_init_receipt`; no tools or policy. `frame` — `ReasoningEnvelope` (intent, constraints, `requested_capabilities`); schema validation; task-level policy; no tools. `plan` — ordered plan with per-action capabilities; plan-level policy; inspectable before execution; no tools. `request_authority` — record `DelegationRequest` (justification, scope, audience, TTL preference); no tools; **no self-authorization**. `validate_authority` — harness + policy; `DelegationDecision` (`approved` / `denied` / `narrowed` / `escalated`); **each capability evaluated individually**. `delegate_narrow` — broker `AuthorityReceipt`, narrowed scope. `execute_tool` — **sole** tool side-effect state (RFC 0003); requires valid grant or standing authorization (Section 10.1); `ToolExecutionReceipt`. `observe_result` — model reads tool output; policy postconditions; violations → quarantine → `fail_safe` without model exposure. `critique_verify` — trajectory / evidence / completion; may return to `plan` or `request_authority`; policies like `requireEvidenceBeforeDone`. `finalize` — final answer; harness revokes outstanding grants; final policy gate. `audit_seal` — terminal; immutable audit envelope + integrity seal (RFC 0048).

**Authority and failure terminal routing.** `deny` — record denial → `audit_seal` only. `escalate` — pause for human approval → `delegate_narrow`, `deny`, or `audit_seal` on timeout (**default timeout = denial-equivalent**). `fail_safe` — unrecoverable; quarantined results never returned to model → `audit_seal` only.

---

## 6. Transition map and policy hooks (normative)

```text
receive -> [frame]
frame -> [plan]
plan -> [request_authority, execute_tool, finalize]
request_authority -> [validate_authority]
validate_authority -> [delegate_narrow, deny, escalate]
delegate_narrow -> [execute_tool]
execute_tool -> [observe_result, fail_safe]
observe_result -> [critique_verify, fail_safe]
critique_verify -> [plan, request_authority, finalize]
finalize -> [audit_seal]
audit_seal -> []   (terminal)
deny -> [audit_seal]
escalate -> [delegate_narrow, deny, audit_seal]
fail_safe -> [audit_seal]
```

Implementations **MUST** reject unlisted transitions. **`plan -> execute_tool`** is the **pre-authorized shortcut** for standing grants (RFC 0017 allowlists, org-wide grants): delegation states MAY be skipped only when the harness cites standing authorization on the `ToolExecutionReceipt` (RFC 0048).

Implementations **MUST** consult policy (RFC 0041) at minimum on entry to: `frame`, `plan`, `validate_authority`, `observe_result`, `critique_verify`, `finalize`. Extra checks (e.g. RFC 0038 budget) **MAY** augment but **MUST NOT** replace these.

---

## 7. Cross-references

Extends: **RFC 0001** ([Reasoning / trace structure](0001-initial-schema.md)); **RFC 0003** ([Tool invocation](0003-tool-invocation-schema.md)); **RFC 0017** ([Sandbox](0017-runtime-safety-sandboxing.md)); **RFC 0038** ([Budget](0038-cost-aware-reasoning-budget.md) → `termination: budget_exhausted`); **RFC 0041** ([Policy](0041-policy-enforcement-schema.md)); **RFC 0042** ([Permissions](0042-permission-acl.md)). Delegation payloads (**RFC 0047**) and receipts / audit envelope (**RFC 0048**) are authoritative for artifact bodies; **this RFC owns control flow and attachment points**.

---

## 8. JSON Schemas

### 8.1 Governed Execution FSM definition

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0007 — Governed Execution FSM Definition",
  "type": "object",
  "required": ["version", "phases", "transitions", "terminal_phases", "tool_execution_phases", "policy_consultation_phases"],
  "properties": {
    "version": { "type": "string", "enum": ["0.3"] },
    "phases": {
      "type": "array",
      "minItems": 14,
      "maxItems": 14,
      "uniqueItems": true,
      "items": {
        "type": "string",
        "enum": [
          "receive",
          "frame",
          "plan",
          "request_authority",
          "validate_authority",
          "delegate_narrow",
          "execute_tool",
          "observe_result",
          "critique_verify",
          "finalize",
          "audit_seal",
          "deny",
          "escalate",
          "fail_safe"
        ]
      }
    },
    "transitions": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "receive",
        "frame",
        "plan",
        "request_authority",
        "validate_authority",
        "delegate_narrow",
        "execute_tool",
        "observe_result",
        "critique_verify",
        "finalize",
        "audit_seal",
        "deny",
        "escalate",
        "fail_safe"
      ],
      "properties": {
        "receive": { "type": "array", "items": { "const": "frame" } },
        "frame": { "type": "array", "items": { "const": "plan" } },
        "plan": {
          "type": "array",
          "items": { "enum": ["request_authority", "execute_tool", "finalize"] }
        },
        "request_authority": { "type": "array", "items": { "const": "validate_authority" } },
        "validate_authority": {
          "type": "array",
          "items": { "enum": ["delegate_narrow", "deny", "escalate"] }
        },
        "delegate_narrow": { "type": "array", "items": { "const": "execute_tool" } },
        "execute_tool": {
          "type": "array",
          "items": { "enum": ["observe_result", "fail_safe"] }
        },
        "observe_result": {
          "type": "array",
          "items": { "enum": ["critique_verify", "fail_safe"] }
        },
        "critique_verify": {
          "type": "array",
          "items": { "enum": ["plan", "request_authority", "finalize"] }
        },
        "finalize": { "type": "array", "items": { "const": "audit_seal" } },
        "audit_seal": { "type": "array", "maxItems": 0, "items": { "type": "string" } },
        "deny": { "type": "array", "items": { "const": "audit_seal" } },
        "escalate": {
          "type": "array",
          "items": { "enum": ["delegate_narrow", "deny", "audit_seal"] }
        },
        "fail_safe": { "type": "array", "items": { "const": "audit_seal" } }
      }
    },
    "terminal_phases": {
      "type": "array",
      "minItems": 1,
      "maxItems": 1,
      "items": { "const": "audit_seal" }
    },
    "tool_execution_phases": {
      "type": "array",
      "minItems": 1,
      "maxItems": 1,
      "items": { "const": "execute_tool" }
    },
    "policy_consultation_phases": {
      "type": "array",
      "minItems": 6,
      "maxItems": 6,
      "uniqueItems": true,
      "items": {
        "type": "string",
        "enum": ["frame", "plan", "validate_authority", "observe_result", "critique_verify", "finalize"]
      }
    }
  }
}
```
<!-- opencot:schema:end -->

### 8.2 Governed trace extension

The `governed_trace` object **SHOULD** embed in or link from a RFC 0001 trace. Reference strings are URIs or opaque ids pointing to **RFC 0047** / **RFC 0048** artifacts (delegation, receipts, audit envelope).

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0007 — Governed Trace Extension",
  "type": "object",
  "required": [
    "version",
    "delegation_requests",
    "delegation_decisions",
    "authority_receipts",
    "tool_execution_receipts",
    "audit_envelope",
    "termination"
  ],
  "properties": {
    "version": { "type": "string", "enum": ["0.3"] },
    "delegation_requests": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "delegation_decisions": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "authority_receipts": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "tool_execution_receipts": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "audit_envelope": { "type": "string", "minLength": 1 },
    "termination": {
      "type": "string",
      "enum": [
        "succeeded",
        "failed",
        "denied",
        "budget_exhausted",
        "external_stop",
        "escalation_timeout",
        "fail_safe"
      ]
    }
  }
}
```
<!-- opencot:schema:end -->

---

## 9. Worked example (happy path)

Illustrative trace (artifact shapes per RFCs 0001, 0003, 0047, 0048): **`receive`** user task “Fetch Q2 revenue from `internal_metrics` and summarize risks”; `run_init_receipt` `rri_001`. **`frame`** validated `ReasoningEnvelope` with intent `internal_reporting`, `PII_MINIMIZE`, `requested_capabilities: ["tool:internal_metrics.read"]`; policy allows. **`plan`** two-step plan (query, summarize) with read capability on step (a); policy allows. **`request_authority`** `DelegationRequest` `dr_01` (scope Q2 revenue slice, TTL 15m). **`validate_authority`** `DelegationDecision` `dd_01` = `narrowed` (row cap, column allowlist). **`delegate_narrow`** `AuthorityReceipt` `ar_01` (`granted ⊆ requested`). **`execute_tool`** RFC 0003 dispatch `internal_metrics.query`; atomic grant consumption; `ToolExecutionReceipt` `ter_01` → `ar_01`. **`observe_result`** sanitized table; postconditions pass. **`critique_verify`** evidence gate satisfied. **`finalize`** answer + grant revocation. **`audit_seal`** envelope `ae_99`, `termination: succeeded`.

```json
{
  "version": "0.3",
  "delegation_requests": ["dr_01"],
  "delegation_decisions": ["dd_01"],
  "authority_receipts": ["ar_01"],
  "tool_execution_receipts": ["ter_01"],
  "audit_envelope": "ae_99",
  "termination": "succeeded"
}
```

---

## 10. Open Questions Resolution

### 10.1 FSM flexibility versus strict sequencing

- **Question:** Must every tool pass through `request_authority` even when policy already allows a tool class?
- **Decision:** The transition map is **normative**, but pipelines **MAY** skip delegation states for capabilities covered by **standing authorization**, using the **`plan -> execute_tool`** shortcut. The harness **MUST** record how standing authorization satisfies the dispatch obligation in the tool execution receipt.
- **Rationale:** Keeps enterprise-grade governance while preserving the ergonomics of a simple sandboxed cognitive pipeline.

### 10.2 Multi-tool execution

- **Question:** Can multiple tools run inside one `execute_tool` visit?
- **Decision:** Each distinct tool invocation **SHOULD** be modeled as its own `request_authority` → … → `execute_tool` cycle (or one shortcut cycle per invocation). Atomic permission consumption applies per dispatch.
- **Rationale:** Per-call receipts and per-capability decisions simplify auditing, partial failure handling, and replay.

### 10.3 Streaming and asynchronous runtimes

- **Question:** How does streaming partial model output interact with phases?
- **Decision:** Streaming and async execution are **extension capabilities**. The core FSM in this RFC is **synchronous** with respect to state commits: a harness **MUST** be able to emit a linearized phase log equivalent to the FSM for replay.
- **Rationale:** Async runtimes interleave I/O; auditors need a canonical total order of state transitions and receipts.

---

## 11. Acceptance Criteria

This RFC should be considered ready for **Implementers’ Draft** when:

- At least **three** maintainers approve the FSM and transition table.
- A **reference harness** emits valid `governed_trace` sidecars for both shortcut and full-delegation paths.
- Conformance tests demonstrate **rejection** of tool dispatch without valid authority (except documented standing authorization).
- At least one **dataset or evaluation harness** records runs using the fourteen-state linearized log.

---

## 12. Conclusion

The Governed Execution FSM turns the Open CoT cognitive pipeline into an explicit, permission-aware control plane: proposals are typed and validated, authority is brokered and narrowed, tools run only under receipts, failures quarantine unsafe knowledge, and every run seals into an auditable envelope. Together with RFCs 0001, 0003, 0017, 0038, 0041, 0042, 0047, and 0048, it provides a serious, implementable standard for trustworthy cognitive pipeline execution.
