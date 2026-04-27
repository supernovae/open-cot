# Architecture

Open CoT defines a stable interface between non-deterministic cognition and deterministic execution.

## Boundary

- Cognition emits a `cognitive_artifact`.
- The artifact references a `capability_snapshot`.
- Requested work is expressed as `execution_intent`.
- Runtime code applies a `policy_gate`, budget bounds, and schema validation.
- Endpoint results become observations and receipts.
- The run ends with a `reconciliation_result`.

Reasoning is evidence for audit and review. It cannot grant permission, execute endpoints, or override policy.
