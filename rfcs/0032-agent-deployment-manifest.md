# RFC 0032 — Agent Deployment Manifest, Status: Draft, Author: Open CoT Community, Created: 2026-04-14

**Discussion:** https://github.com/supernovae/open-cot/discussions/32

## 1. Summary

This RFC defines the **`deployment_manifest`**: a declarative document for running Open-CoT–governed agents with fixed runtime, resources, policy bindings, governance reference, sandbox ([RFC 0017](0017-agent-safety-sandboxing.md)), default budgets ([RFC 0038](0038-cost-aware-reasoning-budget.md)), tools, dependencies, health checks, and scaling. It is **infrastructure-as-code** for governed agents so rollouts are reproducible and provably aligned with org policy before the FSM ([RFC 0007](0007-agent-loop-protocol.md)) starts.

## 2. Motivation

Scattered Helm values and shell exports hide which policies, sandboxes, and budgets actually applied in production. One manifest ties identity, execution surface, constraints, **`policies[]`**, **`governance_ref`**, sandbox, budgets, tool exposure, dependencies, health, and replica bounds into a diffable artifact for the control plane.

## 3. Design

**Lifecycle:** (1) Author manifest in CI/registry. (2) Control plane merges tenant overrides; conflicts fail closed. (3) Runtime provisions workload, wires `policies[]` / `governance_ref`, applies `sandbox_config` and `budget_defaults`. (4) `health_check` gates traffic.

| Field | Role |
|-------|------|
| `manifest_id` | Stable id for this manifest revision (≠ `agent_id`). |
| `runtime` | OCI `container_image`, optional `entrypoint`, `environment` (no secrets). |
| `resources` | `cpu`, `memory`, `gpu` (gpu MAY be fractional). |
| `policies[]` | Ordered policy bundle ids ([RFC 0041](0041-policy-enforcement-schema.md)). |
| `governance_ref` | Org governance config ([RFC 0044](0044-governance-organizational-controls.md)). |
| `sandbox_config` | RFC 0017 object; MUST NOT widen beyond governance. |
| `budget_defaults` | RFC 0038 defaults; per-run overrides if policy allows. |
| `tool_allowlist[]` | Deployed tools; intersected with sandbox + policy. |
| `dependencies[]` | Agents, datasets, tool packs, models. |
| `health_check` | Probe (`http` \| `tcp` \| `exec` \| `grpc`); orchestrator may extend. |
| `scaling` | `min_replicas`, `max_replicas`. |

## 4. JSON Schema

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/rfc0032/deployment-manifest.json",
  "title": "Open CoT RFC 0032 — Agent Deployment Manifest",
  "type": "object",
  "additionalProperties": false,
  "$defs": {
    "runtime": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "container_image": { "type": "string", "minLength": 1 },
        "entrypoint": { "type": "array", "items": { "type": "string" } },
        "environment": { "type": "object", "additionalProperties": { "type": "string" } }
      },
      "required": ["container_image"]
    },
    "resources": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "cpu": { "type": "string" },
        "memory": { "type": "string" },
        "gpu": { "type": "number", "minimum": 0 }
      }
    },
    "health_check": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "kind": { "type": "string", "enum": ["http", "tcp", "exec", "grpc"] },
        "path": { "type": "string" },
        "port": { "type": "integer", "minimum": 1, "maximum": 65535 },
        "interval_seconds": { "type": "integer", "minimum": 1 },
        "timeout_seconds": { "type": "integer", "minimum": 1 },
        "success_threshold": { "type": "integer", "minimum": 1 },
        "failure_threshold": { "type": "integer", "minimum": 1 }
      },
      "required": ["kind"]
    },
    "scaling": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "min_replicas": { "type": "integer", "minimum": 0 },
        "max_replicas": { "type": "integer", "minimum": 1 }
      },
      "required": ["min_replicas", "max_replicas"]
    },
    "dependency": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "ref": { "type": "string", "minLength": 1 },
        "kind": { "type": "string", "enum": ["agent", "dataset", "tool_pack", "model", "other"] },
        "version_constraint": { "type": "string" }
      },
      "required": ["ref", "kind"]
    },
    "deployment_manifest": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "schema_version": { "type": "string", "enum": ["0.1"] },
        "manifest_id": { "type": "string", "minLength": 1 },
        "agent_id": { "type": "string", "minLength": 1 },
        "version": { "type": "string", "minLength": 1 },
        "runtime": { "$ref": "#/$defs/runtime" },
        "resources": { "$ref": "#/$defs/resources" },
        "policies": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "governance_ref": { "type": "string", "minLength": 1 },
        "sandbox_config": { "type": "object" },
        "budget_defaults": { "type": "object" },
        "tool_allowlist": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "dependencies": { "type": "array", "items": { "$ref": "#/$defs/dependency" } },
        "health_check": { "$ref": "#/$defs/health_check" },
        "scaling": { "$ref": "#/$defs/scaling" },
        "metadata": { "type": "object", "additionalProperties": { "type": "string" } }
      },
      "required": ["schema_version", "manifest_id", "agent_id", "version", "runtime", "policies", "governance_ref", "sandbox_config", "budget_defaults", "tool_allowlist", "scaling"]
    }
  },
  "properties": { "deployment_manifest": { "$ref": "#/$defs/deployment_manifest" } },
  "required": ["deployment_manifest"]
}
```
<!-- opencot:schema:end -->

## 5. Examples

**Code-assistant agent** — strict sandbox, org governance, hard budget, repo tools, GPU for embeddings.

```json
{
  "deployment_manifest": {
    "schema_version": "0.1",
    "manifest_id": "dm_acme_codeassist_2026q2_14",
    "agent_id": "agent:org/acme/code-assistant",
    "version": "2.4.1",
    "runtime": {
      "container_image": "registry.acme.example/agents/code-assistant:2.4.1",
      "entrypoint": ["/opt/opencot/bin/agentd", "--config", "/etc/opencot/agent.yaml"],
      "environment": { "OPENCOT_LOG_LEVEL": "info" }
    },
    "resources": { "cpu": "4", "memory": "16Gi", "gpu": 1 },
    "policies": ["policy_bundle:acme/base", "policy_bundle:acme/code_assistant_prod"],
    "governance_ref": "gov://acme/prod/eu-west/code_agents",
    "sandbox_config": {
      "allowed_tools": ["repo.read", "repo.search", "linter.run", "tests.run", "patch.propose"],
      "blocked_tools": ["shell", "network_raw", "secrets.read"],
      "max_steps": 96,
      "max_branches": 4
    },
    "budget_defaults": {
      "budget": { "max_tokens": 120000, "max_cost": 4.5, "max_steps": 96, "max_tool_calls": 200, "max_retries": 3 },
      "enforcement": "hard"
    },
    "tool_allowlist": ["repo.read", "repo.search", "linter.run", "tests.run", "patch.propose"],
    "dependencies": [{ "ref": "dataset:acme/styleguide-embed", "kind": "dataset", "version_constraint": "^3" }],
    "health_check": { "kind": "http", "path": "/healthz", "port": 8080, "interval_seconds": 10, "timeout_seconds": 2, "success_threshold": 1, "failure_threshold": 3 },
    "scaling": { "min_replicas": 2, "max_replicas": 20 },
    "metadata": { "team": "platform-agents", "region": "eu-west-1" }
  }
}
```

## 6. Cross-references

[RFC 0007](0007-agent-loop-protocol.md) · [RFC 0017](0017-agent-safety-sandboxing.md) · [RFC 0038](0038-cost-aware-reasoning-budget.md) · [RFC 0041](0041-policy-enforcement-schema.md) · [RFC 0044](0044-governance-organizational-controls.md)

## 7. Open Questions Resolution

| Topic | Resolution |
|-------|------------|
| Secrets | Not in `runtime.environment`; use platform mounts. |
| Partial sandbox | Merge with org baseline; log merged config at startup. |
| GPU vendor extras | Optional `metadata` keys prefixed `x_`. |

## 8. Acceptance Criteria

Manifests validate against §4. Empty `policies` MUST NOT start without audited org exception. `tool_allowlist` ∩ sandbox ∩ policy MUST be non-empty. `max_replicas` ≥ `min_replicas`.
