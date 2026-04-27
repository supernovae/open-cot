# RFC 0053 — Reconciliation Result & Error Taxonomy (v0.1)

**Status:** Draft  
**Author:** Open CoT Community  
**Created:** 2026-04-27  
**Target Version:** Schema v0.10
**Discussion:** https://github.com/supernovae/open-cot/discussions/53

---

## 1. Summary

This RFC defines a portable result envelope for runtimes that reconcile typed
cognitive artifacts against capability snapshots, policy gates, execution
bounds, endpoint results, and observations.

The result envelope records what executed, what was skipped, what errors were
observed, and the final reconciliation status.

## 2. Status values

- `completed`
- `completed_with_errors`
- `yielded`
- `requires_approval`
- `failed`

## 3. Error taxonomy

The portable taxonomy includes:

- `INVALID_ARTIFACT`
- `SNAPSHOT_MISMATCH`
- `UNKNOWN_MCP_SERVER`
- `UNKNOWN_CAPABILITY`
- `CAPABILITY_DIGEST_MISMATCH`
- `SCHEMA_VALIDATION_FAILED`
- `POLICY_DENIED`
- `APPROVAL_REQUIRED`
- `PRECONDITION_FAILED`
- `BUDGET_EXCEEDED`
- `MCP_EXECUTION_FAILED`
- `RESULT_VALIDATION_FAILED`
- `YIELDED`

## 4. Normative requirements

- Shape validation MUST NOT be treated as permission.
- Permission and policy gates MUST be represented separately from schema
  validation.
- Errors SHOULD be recorded as structured observations when possible.
- A reconciliation result SHOULD preserve enough evidence for replay and audit
  without requiring endpoint re-execution.

## 5. Schema

Machine-readable schema: `schemas/rfc-0053-reconciliation-result.json`.
