# RFC 0018 — Tool Error Taxonomy (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/supernovae/open-cot/discussions/18
---

## 1. Summary

This RFC defines a structured error taxonomy for tool invocation failures and degraded responses.

It extends:

- RFC 0003 — Tool Invocation Schema
- RFC 0007 — Cognitive Pipeline Protocol

---

## 2. Error classes

- `auth_error`: credential or identity failure
- `permission_error`: policy or ACL denial
- `timeout_error`: request exceeded deadline
- `input_validation_error`: malformed arguments
- `tool_unavailable`: service dependency unavailable
- `execution_error`: runtime failure in tool execution
- `rate_limited`: quota/rate limit triggered
- `unknown_error`: uncategorized failure

---

## 3. Full Schema (JSON)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Open CoT RFC 0018 — Tool Error Taxonomy",
  "type": "object",
  "properties": {
    "version": { "type": "string", "enum": ["0.1"] },
    "tool_name": { "type": "string" },
    "error_code": {
      "type": "string",
      "enum": [
        "auth_error",
        "permission_error",
        "timeout_error",
        "input_validation_error",
        "tool_unavailable",
        "execution_error",
        "rate_limited",
        "unknown_error"
      ]
    },
    "message": { "type": "string" },
    "retryable": { "type": "boolean" },
    "metadata": { "type": "object" }
  },
  "required": ["version", "tool_name", "error_code", "message", "retryable"]
}
```

---

## 4. Example

```json
{
  "version": "0.1",
  "tool_name": "weather_api",
  "error_code": "timeout_error",
  "message": "Request timed out after 5s.",
  "retryable": true,
  "metadata": { "timeout_seconds": 5 }
}
```

---

## 5. Conclusion

RFC 0018 provides a shared, machine-readable error vocabulary for tool-augmented reasoning systems.
