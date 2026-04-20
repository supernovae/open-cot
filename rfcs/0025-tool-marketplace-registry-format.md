# RFC 0025 — Tool Marketplace & Registry Format, Status: Draft, Author: Open CoT Community, Created: 2026-04-14

**Discussion:** https://github.com/supernovae/open-cot/discussions/25

## 1. Summary

This RFC defines the **Tool Marketplace & Registry Format** for Open-CoT: a versioned **`tool_registry`** catalog of **`tool_registry_entry`** records for publishing and discovering tools under governance. Entries include **input** / **output** JSON Schemas, **`required_permissions[]`**, **`risk_level`**, **`cost_estimate`**, **`timeout_default_ms`**, **`categories[]`**, **`author`**, **`documentation_url`**, and optional **`health_check_endpoint`**.

The format extends [RFC 0003](0003-tool-invocation-schema.md) (runtime invocation shape) and [RFC 0016](0016-tool-capability-negotiation.md) (caller capabilities). Policy and cost systems consume the same metadata ([RFC 0039](0039-tool-cost-modeling-biling.md), [RFC 0041](0041-policy-enforcement-schema.md)).

## 2. Motivation

Without a **canonical contract**, metadata and permission names diverge; policy cannot reliably target tools. A normative registry enables indexing, CI validation, risk routing, and cost-aware scheduling. This RFC defines **document shape** only—not storage backend, signing, or discovery transport.

## 3. Design

**`tool_registry_entry`:** `tool_name` (stable logical id), SemVer **`version`**, **`description`**. **`input_schema`** / **`output_schema`** MUST be JSON Schema documents for [RFC 0003](0003-tool-invocation-schema.md) args/results. **`required_permissions[]`** lists tokens required of callers ([RFC 0016](0016-tool-capability-negotiation.md), [RFC 0042](0042-permission-acl.md)); policy may map to `require_approval` ([RFC 0041](0041-policy-enforcement-schema.md)). **`risk_level`** is `low` \| `medium` \| `high`. **`cost_estimate`** is advisory for [RFC 0039](0039-tool-cost-modeling-biling.md) (`model`: `per_call_flat` \| `per_token` \| `custom`, plus `amount` / `currency` / `notes`). **`timeout_default_ms`**, **`categories[]`**, **`author`**, **`documentation_url`** are required; **`health_check_endpoint`** is optional (HTTP liveness).

**`tool_registry`:** envelope **`version`** (this format, currently `0.1`), RFC 3339 **`updated_at`**, **`entries[]`**. Reject duplicate `(tool_name, version)` within one document. Policy SHOULD use resources `tool:<tool_name>` ([RFC 0041](0041-policy-enforcement-schema.md)) with fields mirrored from the registry snapshot under evaluation.

## 4. JSON Schema

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/tool-registry/v0.1",
  "title": "Open CoT RFC 0025 — Tool Registry",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "entries", "updated_at"],
  "properties": {
    "version": { "type": "string", "const": "0.1" },
    "updated_at": { "type": "string", "format": "date-time" },
    "entries": { "type": "array", "items": { "$ref": "#/definitions/tool_registry_entry" } }
  },
  "definitions": {
    "tool_registry_entry": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "tool_name", "version", "description", "input_schema", "output_schema",
        "required_permissions", "risk_level", "cost_estimate", "timeout_default_ms",
        "categories", "author", "documentation_url"
      ],
      "properties": {
        "tool_name": { "type": "string", "minLength": 1 },
        "version": { "type": "string", "minLength": 1 },
        "description": { "type": "string", "minLength": 1 },
        "input_schema": { "type": "object" },
        "output_schema": { "type": "object" },
        "required_permissions": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "risk_level": { "type": "string", "enum": ["low", "medium", "high"] },
        "cost_estimate": {
          "type": "object",
          "additionalProperties": false,
          "required": ["model"],
          "properties": {
            "model": { "type": "string", "enum": ["per_call_flat", "per_token", "custom"] },
            "amount": { "type": "number" },
            "currency": { "type": "string" },
            "notes": { "type": "string" }
          }
        },
        "timeout_default_ms": { "type": "integer", "minimum": 1 },
        "categories": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "author": { "type": "string", "minLength": 1 },
        "documentation_url": { "type": "string", "format": "uri" },
        "health_check_endpoint": { "type": "string", "format": "uri" }
      }
    }
  }
}
```
<!-- opencot:schema:end -->

## 5. Examples

### 5.1 Search tool entry

```json
{
  "version": "0.1",
  "updated_at": "2026-04-14T12:00:00Z",
  "entries": [{
    "tool_name": "com.example.web_search",
    "version": "2.4.1",
    "description": "Approved web index; ranked snippets with citations.",
    "input_schema": { "type": "object", "required": ["query"], "properties": { "query": { "type": "string" }, "max_results": { "type": "integer", "minimum": 1, "maximum": 20 } } },
    "output_schema": { "type": "object", "required": ["results"], "properties": { "results": { "type": "array", "items": { "type": "object", "required": ["title", "url"], "properties": { "title": { "type": "string" }, "url": { "type": "string" }, "snippet": { "type": "string" } } } } } },
    "required_permissions": ["network.read", "tool.search.invoke"],
    "risk_level": "low",
    "cost_estimate": { "model": "per_call_flat", "amount": 0.002, "currency": "USD" },
    "timeout_default_ms": 15000,
    "categories": ["search", "external-knowledge"],
    "author": "Example Corp",
    "documentation_url": "https://docs.example.com/tools/web_search",
    "health_check_endpoint": "https://search.example.com/healthz"
  }]
}
```

### 5.2 File-write tool entry

```json
{
  "version": "0.1",
  "updated_at": "2026-04-14T12:00:00Z",
  "entries": [{
    "tool_name": "com.opencot.fs.write_file",
    "version": "1.0.0",
    "description": "Writes UTF-8 text inside the workspace sandbox.",
    "input_schema": { "type": "object", "required": ["path", "content"], "properties": { "path": { "type": "string" }, "content": { "type": "string" }, "create_parents": { "type": "boolean" } } },
    "output_schema": { "type": "object", "required": ["bytes_written"], "properties": { "bytes_written": { "type": "integer", "minimum": 0 } } },
    "required_permissions": ["filesystem.write", "tool.fs.write_file.invoke"],
    "risk_level": "high",
    "cost_estimate": { "model": "custom", "notes": "Storage quota; see RFC 0039 metering." },
    "timeout_default_ms": 5000,
    "categories": ["filesystem", "side-effect"],
    "author": "Open CoT Community",
    "documentation_url": "https://opencot.dev/rfcs/0003-tool-invocation-schema"
  }]
}
```

## 6. Cross-references

| RFC | Title | Relationship |
|-----|--------|----------------|
| [RFC 0003](0003-tool-invocation-schema.md) | Tool Invocation | Runtime calls follow entry schemas. |
| [RFC 0016](0016-tool-capability-negotiation.md) | Capability Negotiation | Aligns with `required_permissions`. |
| [RFC 0039](0039-tool-cost-modeling-biling.md) | Tool Cost Modeling | Uses `cost_estimate` + actuals. |
| [RFC 0041](0041-policy-enforcement-schema.md) | Policy Enforcement | Rules target `tool:<tool_name>`. |
| [RFC 0042](0042-permission-acl.md) | Permissions & ACL | Grants cover `required_permissions`. |

## 7. Open Questions Resolution

| Question | Resolution |
|----------|------------|
| Required `health_check_endpoint`? | **Optional**—non-HTTP tools exist. |
| Nested / bundled tools? | **Out of scope v0.1**; future `bundle_id` possible. |
| JSON Schema draft for nested schemas? | Nested objects SHOULD set their own `$schema`; validators introspect. |

## 8. Acceptance Criteria

1. Parsed **`tool_registry`** includes `version`, `updated_at`, non-empty `entries`.
2. Each entry validates and includes `input_schema`, `output_schema`, `risk_level`, `required_permissions`.
3. Policy can match `tool:<tool_name>` and permissions without extra heuristics ([RFC 0041](0041-policy-enforcement-schema.md), [RFC 0042](0042-permission-acl.md)).
4. Duplicate `(tool_name, version)` in one file is rejected by conforming loaders.
