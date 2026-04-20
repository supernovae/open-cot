# RFC 0051 Temporal Migration Guide

RFC 0051 introduces a breaking temporal normalization across the governance spine. This guide summarizes the required field migrations for downstream consumers.

## Core field migrations

| Legacy | Canonical (RFC 0051) | Notes |
|---|---|---|
| `timestamp` | `observed_at` or `decided_at` | Use `observed_at` for observations/events; `decided_at` for policy/delegation decisions. |
| `effective_from` | `effective_at` | Inclusive lower bound of validity window. |
| `effective_until` | `expires_at` | Exclusive upper bound of validity window. |
| `granted_at` | `effective_at` | Permission/receipt validity start. |
| `sealed_at` | `completed_at` | Run envelope completion instant. |
| `previous_event_id` | `parent_event_id` | Causal predecessor pointer for audit chains. |
| `time_window.start/end` | `validity_window.effective_at/expires_at` | Rule-level validity constraints in policy conditions. |

## Ordering model updates

Time alone is no longer sufficient for deterministic ordering in governance artifacts.

- Audit events now carry `ordering.event_seq`.
- Causal links use `parent_event_id` and optional `causal_predecessors`.
- Consumers should order by `event_seq` first, then causal linkage, then wall-clock as tie-breaker.

## Harness/runtime alignment

Reference harness producers now emit the canonical temporal model:

- Delegation request/decision/receipt use `observed_at`, `decided_at`, and `effective_at`.
- Permission lifecycle events use `observed_at`.
- Audit envelope uses `completed_at` and schema versioned temporal semantics.
- Telemetry records use `observed_at` plus logical ordering metadata.

## Consumer upgrade checklist

1. Update deserializers and storage columns for renamed fields.
2. Rebuild indexes/queries that used `timestamp` or `sealed_at`.
3. Enforce half-open validity windows: `effective_at <= now < expires_at`.
4. Adopt replay/freshness handling where available (`freshness.*`, `replay_window_ms`).
5. Reject mixed old/new temporal aliases in newly written records.
