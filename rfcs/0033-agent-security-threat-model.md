# RFC 0033 — Agent Security & Threat Model, Status: Draft, Author: Open CoT Community, Created: 2026-04-14

**Discussion:** https://github.com/supernovae/open-cot/discussions/33

## 1. Summary

This RFC documents the **security threat landscape** for governed agents on the Open-CoT cognitive control plane and explains how architectural choices—especially the separation of **proposal** (model) from **authorization** (harness, policy, brokers)—reduce impact for each major threat class. It introduces a machine-readable **`threat_catalog`**: a versioned collection of **`threat_entry`** records linking each threat to severities, mitigations (by RFC or mechanism), and honest **residual risk** statements for security reviewers and auditors.

## 2. Motivation

Language models are stochastic, user-influenceable, and occasionally incoherent with respect to organizational intent. Treating their outputs as instructions with ambient authority guarantees eventual compromise. Open-CoT instead treats the model as an **untrusted planner** whose outputs become **structured proposals** evaluated by policy, permissions, and delegation machinery. This RFC makes that stance explicit: security teams need a shared vocabulary (categories, severities, mitigations) and a catalog format they can attach to SOC reviews, customer questionnaires, and internal risk registers.

## 3. Design

### 3.1 Threat model overview

We protect **organizational data**, **downstream systems reachable by tools**, **user privacy**, **financial and compute budgets**, and **audit integrity** against attackers who may control portions of prompts, tool results, third-party content, or compromised dependencies. We do **not** assume the model is benign; we assume **humans and policies** are the ultimate authority for irreversible or high-risk actions unless pre-approved standing grants exist and are themselves policy-bound.

### 3.2 Trust boundary analysis

| Boundary | Trusts | Does not trust |
|----------|--------|----------------|
| Model | Capability to suggest plans and text. | Self-judgment of legality, scope, or safety; any narrative claiming urgency or override. |
| Harness | Verified identity ([RFC 0026](0026-agent-identity-auth.md)), trace binding, schema validation, FSM transitions ([RFC 0007](0007-agent-loop-protocol.md)). | Raw model JSON without normalization and size limits. |
| Policy engine | Rule evaluation, obligation logs ([RFC 0041](0041-policy-enforcement-schema.md)). | Model-authored “policy” fields. |
| Permissions / delegation | Stored grants, audience-bound receipts ([RFC 0042](0042-permission-acl.md), [RFC 0047](0047-delegation-extension.md)). | Tool-selected scope expansion. |
| Tools & hosts | Correct implementation when inputs stay within granted scope. | Arbitrary URLs or paths offered by the model without validation. |
| Human operators | Break-glass and governance configuration ([RFC 0044](0044-governance-organizational-controls.md)). | Routine model text. |

### 3.3 How the governed FSM mitigates key threats

**Prompt injection** — Outputs are proposals; FSM blocks tools without authority ([RFC 0007](0007-agent-loop-protocol.md), [RFC 0047](0047-delegation-extension.md)). **Privilege escalation** — Model cannot author `delegation_decision` / `authority_receipt`. **Confused deputy** — Audience-bound scopes/receipts ([RFC 0042](0042-permission-acl.md), [RFC 0047](0047-delegation-extension.md)). **Data exfiltration** — Narrowing + sandbox allowlists ([RFC 0017](0017-agent-safety-sandboxing.md)). **Replay** — Hashed/signed receipts ([RFC 0048](0048-execution-receipts-audit-envelopes.md)).

### 3.4 Threat catalog record (`threat_entry`)

Each entry uses a stable **`threat_id`**, a **`category`** enum aligned with common agentic abuse cases, narrative **`description`**, **`severity`** (`critical` / `high` / `medium` / `low`), structured **`mitigations[]`** referencing RFCs or concrete mechanisms, and **`residual_risk`** for transparency after controls.

## 4. JSON Schema

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/rfc0033/threat-catalog.json",
  "title": "Open CoT RFC 0033 — Threat Catalog",
  "type": "object",
  "additionalProperties": false,
  "$defs": {
    "threat_category": {
      "type": "string",
      "enum": ["prompt_injection", "privilege_escalation", "data_exfiltration", "confused_deputy", "denial_of_service", "replay_attack", "supply_chain"]
    },
    "severity": {
      "type": "string",
      "enum": ["critical", "high", "medium", "low"]
    },
    "mitigation": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "mechanism": { "type": "string", "minLength": 1 },
        "rfc_ref": { "type": "string", "description": "e.g. RFC 0047" },
        "notes": { "type": "string" }
      },
      "required": ["mechanism"]
    },
    "threat_entry": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "threat_id": { "type": "string", "minLength": 1 },
        "category": { "$ref": "#/$defs/threat_category" },
        "description": { "type": "string", "minLength": 1 },
        "severity": { "$ref": "#/$defs/severity" },
        "mitigations": {
          "type": "array",
          "items": { "$ref": "#/$defs/mitigation" },
          "minItems": 1
        },
        "residual_risk": { "type": "string", "minLength": 1 }
      },
      "required": ["threat_id", "category", "description", "severity", "mitigations", "residual_risk"]
    },
    "threat_catalog": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "schema_version": { "type": "string", "enum": ["0.1"] },
        "catalog_id": { "type": "string", "minLength": 1 },
        "title": { "type": "string", "minLength": 1 },
        "entries": {
          "type": "array",
          "items": { "$ref": "#/$defs/threat_entry" },
          "minItems": 1
        }
      },
      "required": ["schema_version", "catalog_id", "title", "entries"]
    }
  },
  "properties": {
    "threat_catalog": { "$ref": "#/$defs/threat_catalog" }
  },
  "required": ["threat_catalog"]
}
```
<!-- opencot:schema:end -->

## 5. Examples

```json
{
  "threat_catalog": {
    "schema_version": "0.1",
    "catalog_id": "tc_acme_agents_core_2026q2",
    "title": "ACME governed agents — baseline threats",
    "entries": [
      {
        "threat_id": "THR-PROMPT-INJECT-001",
        "category": "prompt_injection",
        "description": "Attacker embeds instructions in retrieved documents, tool output, or user messages to coerce the model into harmful tool use or disclosure.",
        "severity": "high",
        "mitigations": [
          {
            "mechanism": "Model outputs are proposals; harness validates schema and strips privileged fields.",
            "rfc_ref": "RFC 0007",
            "notes": "FSM blocks tool execution without prior authority path."
          },
          {
            "mechanism": "Sandbox tool allowlists and argument validation.",
            "rfc_ref": "RFC 0017"
          },
          {
            "mechanism": "Delegation requests evaluated by policy; model cannot mint receipts.",
            "rfc_ref": "RFC 0047"
          }
        ],
        "residual_risk": "Medium — policy misconfiguration or overly broad standing grants could still allow unintended tool calls if content influences argument choice within allowed scope."
      },
      {
        "threat_id": "THR-PRIV-ESC-002",
        "category": "privilege_escalation",
        "description": "Model attempts to expand scopes, reuse tokens, or manipulate traces to obtain permissions beyond the user or tenant intent.",
        "severity": "critical",
        "mitigations": [
          {
            "mechanism": "Strict separation: only harness/policy author delegation_decision and authority_receipt.",
            "rfc_ref": "RFC 0047"
          },
          {
            "mechanism": "Permission ACLs and stored grants bound to roles and resources.",
            "rfc_ref": "RFC 0042"
          },
          {
            "mechanism": "Policy bundles deny-by-default for high-risk actions.",
            "rfc_ref": "RFC 0041"
          }
        ],
        "residual_risk": "Low to medium — compromised harness or policy engine process breaks the model; operational controls (HSM, segmentation) out of scope for this RFC."
      }
    ]
  }
}
```

## 6. Cross-references

[RFC 0007](0007-agent-loop-protocol.md) · [RFC 0017](0017-agent-safety-sandboxing.md) · [RFC 0026](0026-agent-identity-auth.md) · [RFC 0041](0041-policy-enforcement-schema.md) · [RFC 0042](0042-permission-acl.md) · [RFC 0044](0044-governance-organizational-controls.md) · [RFC 0047](0047-delegation-extension.md) · [RFC 0048](0048-execution-receipts-audit-envelopes.md)

## 7. Open Questions Resolution

| Topic | Resolution |
|-------|------------|
| Catalog vs. live SOC tickets | `threat_catalog` is **strategic** baseline; operational incidents reference `threat_id` in ticketing integrations (out of band). |
| Severity calibration | Deployments MAY map `severity` to internal risk scores; schema values stay coarse for interoperability. |
| Non-listed categories | Use `supply_chain` or extend in a minor schema bump; avoid free-text categories in conforming documents. |

## 8. Acceptance Criteria

Entries validate against §4; each SHOULD include `rfc_ref` on ≥1 mitigation when an Open-CoT RFC applies. Production risk acceptance SHOULD cite `threat_id`. New control RFCs SHOULD update affected catalog entries.
