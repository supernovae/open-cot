# RFC 0051 — Temporal Semantics & Validity Extension (v0.1)

**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-20  
**Target Version:** Schema v0.9  
**Discussion:** https://github.com/supernovae/open-cot/discussions/51

---

## 1. Summary

Open CoT already carries many time-like fields (`timestamp`, `started_at`, `completed_at`, `expires_at`, `effective_from`, `effective_until`) but lacks one cross-cutting temporal model. This RFC defines that model for governed execution.

The extension standardizes:

- canonical temporal fields and meanings,
- ordering semantics beyond wall-clock sorting,
- validity, freshness, and replay-window requirements,
- supersession semantics for append-only governance,
- temporal uncertainty and clock-domain provenance.

This RFC is control-plane focused: it standardizes artifact semantics and enforcement obligations, not internal model cognition.

---

## 2. Scope and non-goals

**In scope**

- Control-plane semantics for temporal fields across policy, delegation, permissions, receipts, audit, memory, lifecycle, telemetry, and governed execution.
- Normative ordering rules that remain stable under clock skew and distributed runtimes.
- Replay/freshness/supersession guarantees for auditable execution.

**Out of scope**

- Human-style temporal reasoning within model chain-of-thought.
- Transformer architecture changes, sequence-modeling research, or training-only behavior guarantees.
- Replacing RFC 0007 state-machine governance with timestamp-only ordering.

---

## 3. Canonical temporal fields

Implementations MUST use these canonical semantics when fields appear:

| Field | Meaning | Typical producer |
|------|---------|------------------|
| `observed_at` | When evidence/observation became known to the harness | tool executor, observation path |
| `decided_at` | When an authority/policy decision was finalized | policy engine, harness |
| `effective_at` | Inclusive start time when an artifact becomes valid | policy, grants, approvals |
| `expires_at` | Exclusive end time when validity ends | policy, grants, approvals |
| `started_at` | Start time of an execution span | tool executor, run lifecycle |
| `completed_at` | End time of an execution span | tool executor, run lifecycle |
| `superseded_at` | Time an artifact revision was superseded by another | harness or governance service |

If an artifact has validity bounds, it MUST use `effective_at` + `expires_at` (half-open interval: `[effective_at, expires_at)`).

---

## 4. Ordering semantics

Temporal ordering MUST NOT rely on wall-clock time alone.

Implementations MUST evaluate order using this precedence:

1. **Logical sequence order** (`ordering.event_seq`) when present.
2. **Causal linkage** (`ordering.parent_event_id` and/or `ordering.causal_predecessors`) when sequence ties or is absent.
3. **Version transition order** (`ordering.version_order`) for lifecycle-governed revisions.
4. **Wall clock order** (`*.at` fields) only as a tie-breaker.

Normative requirement: artifacts used for governance/audit decisions MUST carry at least one non-wall-clock ordering signal (`event_seq`, causal predecessor, or version order).

---

## 5. Validity, freshness, and replay

### 5.1 Validity windows

- `effective_at` is inclusive.
- `expires_at` is exclusive.
- Artifact is valid at time `t` iff `effective_at <= t < expires_at`.
- If `effective_at` is omitted, validity starts immediately when emitted.
- If `expires_at` is omitted, validity is unbounded unless constrained by policy.

### 5.2 Freshness requirements

When freshness is specified:

- `freshness.max_staleness_ms` defines allowed age of observed evidence at decision/execution time.
- `freshness.max_observation_lag_ms` bounds delay between real-world event and `observed_at`.
- If freshness cannot be proven, implementations MUST fail closed (`deny`, `escalate`, or `fail_safe` per governing RFC).

### 5.3 Replay windows

- `freshness.replay_window_ms` bounds reuse of replay-sensitive artifacts (receipts, approvals, delegation artifacts).
- If artifact age exceeds replay window, it MUST be rejected as stale for privileged operations.

---

## 6. Supersession model

Supersession is append-only and provenance-preserving.

When an artifact revision replaces prior intent/constraints:

- new artifact MUST reference predecessor via `supersession.supersedes_id`,
- predecessor MAY be marked with `superseded_at`,
- historical records MUST remain immutable and auditable.

Supersession MUST NOT destructively erase prior approved intent, grant lineage, or provenance evidence.

---

## 7. Temporal uncertainty and clock domains

Each canonical instant SHOULD carry source metadata using `time_instant`:

- `source` in `{harness_recorded, source_reported, inferred, unknown}`,
- `clock_domain` in `{harness_wall_clock, source_wall_clock, logical_only}`,
- optional uncertainty interval (`lower_bound_at`, `upper_bound_at`) when exact time is unknown.

If `source` is `unknown`, exact `at` MAY be omitted but ordering and governance constraints still require non-wall-clock ordering metadata.

---

## 8. Migration from legacy fields (breaking)

This RFC defines a breaking normalization:

| Legacy field | Canonical target |
|-------------|------------------|
| `timestamp` (generic) | one of `observed_at`, `decided_at`, or lifecycle span fields with explicit semantics |
| `effective_from` | `effective_at` |
| `effective_until` | `expires_at` |
| `granted_at` | `effective_at` (grant validity start) |
| `sealed_at` | `completed_at` for sealing span OR explicit terminal lifecycle event timestamp |
| policy rule `time_window.start` | `effective_at` |
| policy rule `time_window.end` | `expires_at` |

Implementations adopting v0.9 MUST emit canonical names and MUST NOT emit deprecated aliases in new artifacts.

---

## 9. Cross-RFC integration targets

This extension is cross-cutting for:

- RFC 0007 (governed FSM),
- RFC 0010 (memory),
- RFC 0030 (lifecycle/versioning),
- RFC 0031 (telemetry),
- RFC 0041 (policy),
- RFC 0042 (permissions),
- RFC 0043 (audit logs),
- RFC 0047 (delegation),
- RFC 0048 (execution receipts/audit envelopes),
- RFC 0049 (capability manifest freshness projection).

---

## 10. Normative JSON Schema

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/rfc0051/temporal-semantics.json",
  "title": "Open CoT RFC 0051 - Temporal Semantics and Validity Extension",
  "type": "object",
  "additionalProperties": false,
  "$defs": {
    "isoDateTime": {
      "type": "string",
      "format": "date-time"
    },
    "timeSource": {
      "type": "string",
      "enum": ["harness_recorded", "source_reported", "inferred", "unknown"]
    },
    "clockDomain": {
      "type": "string",
      "enum": ["harness_wall_clock", "source_wall_clock", "logical_only"]
    },
    "timeUncertainty": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "lower_bound_at": { "$ref": "#/$defs/isoDateTime" },
        "upper_bound_at": { "$ref": "#/$defs/isoDateTime" }
      },
      "required": ["lower_bound_at", "upper_bound_at"]
    },
    "timeInstant": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "at": { "$ref": "#/$defs/isoDateTime" },
        "source": { "$ref": "#/$defs/timeSource" },
        "clock_domain": { "$ref": "#/$defs/clockDomain" },
        "uncertainty": { "$ref": "#/$defs/timeUncertainty" }
      },
      "required": ["source", "clock_domain"],
      "allOf": [
        {
          "if": {
            "properties": { "source": { "const": "unknown" } },
            "required": ["source"]
          },
          "then": {
            "not": { "required": ["at"] }
          },
          "else": {
            "required": ["at"]
          }
        }
      ]
    },
    "ordering": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "event_seq": { "type": "integer", "minimum": 0 },
        "parent_event_id": { "type": "string", "minLength": 1 },
        "causal_predecessors": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 },
          "uniqueItems": true
        },
        "version_order": { "type": "integer", "minimum": 0 }
      }
    },
    "validityWindow": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "effective_at": { "$ref": "#/$defs/isoDateTime" },
        "expires_at": { "$ref": "#/$defs/isoDateTime" }
      }
    },
    "freshness": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "max_staleness_ms": { "type": "integer", "minimum": 0 },
        "max_observation_lag_ms": { "type": "integer", "minimum": 0 },
        "replay_window_ms": { "type": "integer", "minimum": 0 }
      }
    },
    "supersession": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "supersedes_id": { "type": "string", "minLength": 1 },
        "superseded_at": { "$ref": "#/$defs/isoDateTime" },
        "reason": { "type": "string" }
      },
      "required": ["supersedes_id", "superseded_at"]
    }
  },
  "properties": {
    "observed_at": { "$ref": "#/$defs/timeInstant" },
    "decided_at": { "$ref": "#/$defs/timeInstant" },
    "effective_at": { "$ref": "#/$defs/isoDateTime" },
    "expires_at": { "$ref": "#/$defs/isoDateTime" },
    "started_at": { "$ref": "#/$defs/isoDateTime" },
    "completed_at": { "$ref": "#/$defs/isoDateTime" },
    "superseded_at": { "$ref": "#/$defs/isoDateTime" },
    "ordering": { "$ref": "#/$defs/ordering" },
    "validity": { "$ref": "#/$defs/validityWindow" },
    "freshness": { "$ref": "#/$defs/freshness" },
    "supersession": { "$ref": "#/$defs/supersession" }
  }
}
```
<!-- opencot:schema:end -->

---

## 11. Acceptance criteria

- Governance artifacts use canonical temporal names and semantics.
- Non-wall-clock ordering metadata is present for audit/governance records.
- Freshness and replay-window checks are enforceable at runtime.
- Supersession preserves predecessor links and immutable history.
- Cross-schema validation succeeds with regenerated registry artifacts.

