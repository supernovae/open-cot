# RFC 0030 — Agent Lifecycle & Versioning, Status: Draft, Author: Open CoT Community, Created: 2026-04-14

**Discussion:** https://github.com/supernovae/open-cot/discussions/30

## 1. Summary

This RFC defines **agent lifecycle states** and **versioning** of agent configurations for Open-CoT. Long-running governed agents need a model where **configuration can evolve** (prompts, tools, policies) without silently mutating in-flight runs or breaking permission grants. The **`agent_lifecycle`** record binds an **`agent_id`** to a semantic **`version`**, a **`lifecycle_state`**, capability and policy references, and a **`configuration_hash`** for reproducibility. **`version_transition`** documents approved rollout strategies (**rolling**, **blue-green**, **canary**) and whether **rollback** is permitted.

Lifecycle and versioning intersect **identity** ([RFC 0026](0026-agent-identity-auth.md)), **organizational governance** ([RFC 0044](0044-governance-organizational-controls.md)), and **permissions** that are often scoped to a specific agent version ([RFC 0042](0042-permission-acl.md)).

## 2. Motivation

Operators routinely ship prompt and tool updates weekly, yet auditors require proof of **which binary/configuration** executed a given run. Without explicit lifecycle metadata, “the planner agent” is an ambiguous moving target: ACLs may grant access to a name that no longer matches behavior. Clear **`lifecycle_state`** gates which versions may receive traffic, while **`version_transition`** records who approved a rollout and whether emergency rollback is allowed.

This RFC does not define CI/CD mechanics, container image formats, or canary metrics collection; it specifies **authoritative records** that control planes and observability systems can store and query.

## 3. Design

### 3.1 `agent_lifecycle`

**`agent_id`** is the stable logical identity ([RFC 0026](0026-agent-identity-auth.md)); **`version`** follows semantic versioning for human expectations but MUST be treated as an opaque string for matching grants. **`lifecycle_state`** values:

| State | Meaning |
|-------|---------|
| `draft` | Under development; MUST NOT serve production traffic unless explicitly allowed by internal policy (not overridden by this RFC). |
| `active` | Eligible for production assignment subject to governance and ACLs. |
| `suspended` | Temporarily blocked (incident, quota, compliance hold); existing runs MAY drain per implementation. |
| `deprecated` | Still runnable for compatibility but SHOULD not start new long-lived sessions; migrations encouraged. |
| `retired` | MUST NOT schedule new work; historical traces remain addressable. |

**`created_at`** / **`observed_at`** are RFC 3339 timestamps. **`configuration_hash`** hashes the canonical serialized bundle (system prompt, tool allow list, model route, feature flags) so two hosts can verify they run identical configs. **`capabilities[]`** mirrors outward-facing skills for routing ([RFC 0021](0021-agent-capability-declaration.md) may elaborate). **`policy_refs[]`** lists attached policy documents or snapshots ([RFC 0041](0041-policy-enforcement-schema.md)). **`governance_ref`** points to organizational controls ([RFC 0044](0044-governance-organizational-controls.md))—team ownership, data classes, approval workflow ids.

### 3.2 `version_transition`

**`from_version`** / **`to_version`** describe the movement between semver strings. **`migration_strategy`** selects rollout mechanics: **`rolling`** (gradual instance replacement), **`blue-green`** (atomic switch), **`canary`** (percentage traffic). **`rollback_allowed`** documents whether automated or manual rollback to `from_version` remains approved. **`approved_by`** is a human or system principal id; **`decided_at`** records the decision instant. `version_order` provides deterministic transition ordering independent of wall-clock drift.

### 3.3 Permissions and governance coupling

Permission grants ([RFC 0042](0042-permission-acl.md)) SHOULD include optional `agent_version` constraints. When absent, grants apply to all versions at own risk; when present, **`active`** versions outside the grant MUST be denied. [RFC 0044](0044-governance-organizational-controls.md) may require `approved_by` for transitions affecting regulated data classes.

## 4. JSON Schema

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/agent-lifecycle/v0.2",
  "title": "Open CoT RFC 0030 — Agent Lifecycle",
  "definitions": {
    "agent_lifecycle": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "agent_id",
        "version",
        "lifecycle_state",
        "created_at",
        "observed_at",
        "configuration_hash",
        "capabilities",
        "policy_refs",
        "governance_ref"
      ],
      "properties": {
        "agent_id": { "type": "string", "minLength": 1 },
        "version": { "type": "string", "minLength": 1 },
        "lifecycle_state": {
          "type": "string",
          "enum": ["draft", "active", "suspended", "deprecated", "retired"]
        },
        "created_at": { "type": "string", "format": "date-time" },
        "observed_at": { "type": "string", "format": "date-time" },
        "configuration_hash": { "type": "string", "minLength": 1 },
        "capabilities": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        },
        "policy_refs": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        },
        "governance_ref": { "type": "string", "minLength": 1 }
      }
    },
    "version_transition": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "from_version",
        "to_version",
        "migration_strategy",
        "rollback_allowed",
        "approved_by",
        "decided_at",
        "version_order"
      ],
      "properties": {
        "from_version": { "type": "string", "minLength": 1 },
        "to_version": { "type": "string", "minLength": 1 },
        "migration_strategy": {
          "type": "string",
          "enum": ["rolling", "blue-green", "canary"]
        },
        "rollback_allowed": { "type": "boolean" },
        "approved_by": { "type": "string", "minLength": 1 },
        "decided_at": { "type": "string", "format": "date-time" },
        "version_order": { "type": "integer", "minimum": 0 }
      }
    }
  },
  "oneOf": [
    { "$ref": "#/definitions/agent_lifecycle" },
    { "$ref": "#/definitions/version_transition" }
  ]
}
```
<!-- opencot:schema:end -->

## 5. Examples

### 5.1 Agent lifecycle record

```json
{
  "agent_id": "com.opencot.support.triage",
  "version": "3.6.0",
  "lifecycle_state": "active",
  "created_at": "2026-03-01T09:00:00Z",
  "observed_at": "2026-04-14T08:15:00Z",
  "configuration_hash": "sha256:9aa7…21",
  "capabilities": ["ticketing.read", "email.summarize", "kb.search"],
  "policy_refs": [
    "policy://org/support-tier2@v2026.04.01",
    "policy://safety/default@v7"
  ],
  "governance_ref": "gov://teams/support#workload-class-c"
}
```

### 5.2 Version transition (informative)

```json
{
  "from_version": "3.5.4",
  "to_version": "3.6.0",
  "migration_strategy": "canary",
  "rollback_allowed": true,
  "approved_by": "alice@example.com",
  "decided_at": "2026-04-13T17:45:00Z",
  "version_order": 42
}
```

## 6. Cross-references

| RFC | Title | Relationship |
|-----|--------|----------------|
| [RFC 0026](0026-agent-identity-auth.md) | Agent Identity | Stable `agent_id` and authentication for lifecycle APIs. |
| [RFC 0044](0044-governance-organizational-controls.md) | Governance | `governance_ref` and approval workflows for transitions. |
| [RFC 0042](0042-permission-acl.md) | Permissions & ACL | Grants may be pinned to `agent_id` + `version`. |
| [RFC 0041](0041-policy-enforcement-schema.md) | Policy Enforcement | `policy_refs` attach evaluation snapshots to versions. |
| [RFC 0021](0021-agent-capability-declaration.md) | Capability Declaration | `capabilities` alignment for discovery. |

## 7. Open Questions Resolution

| Question | Resolution |
|----------|------------|
| Do we embed full configuration inline? | **No.** Only `configuration_hash` is normative; config blobs live in secure config stores or OCI layers. |
| Can multiple `active` versions coexist? | **Yes** for canary/rolling; schedulers MUST tag runs with the exact `version` executed for trace replay. |
| How does `suspended` interact with incidents? | **Operational.** This RFC only records state; automation sets `suspended` when [RFC 0044](0044-governance-organizational-controls.md) incident hooks fire. |

## 8. Acceptance Criteria

1. Every stored **`agent_lifecycle`** record validates against the schema and includes `configuration_hash`, `policy_refs`, and `governance_ref`.
2. Runs log the **`agent_id`** and **`version`** pair actually executed, enabling ACL checks per [RFC 0042](0042-permission-acl.md).
3. **`version_transition`** records exist for production-impacting changes when [RFC 0044](0044-governance-organizational-controls.md) mandates approvals, including `migration_strategy` and `rollback_allowed`.
4. **`retired`** versions cannot be selected for new assignments by conforming schedulers without an explicit out-of-band exception flag (documented locally, not part of this schema).
