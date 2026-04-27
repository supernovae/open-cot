# Architecture

Open CoT is a portable schema layer for reconciling non-deterministic cognition with concrete capability.

It does not require a particular runtime, model provider, endpoint protocol, storage backend, or workflow engine. It defines the artifacts that let those systems coordinate safely.

## Cognitive Layer vs Runtime Layer

| Cognitive layer | Runtime layer |
|-----------------|---------------|
| Emits a typed cognitive artifact | Validates and reconciles that artifact |
| Sees a capability snapshot | Discovers and signs capability inventory |
| Proposes execution intent | Applies policy, budget, and preconditions |
| Produces explanatory reasoning trace | Treats trace as audit material, not proof |
| Consumes observations | Executes endpoints and records receipts |

The boundary is intentionally asymmetric. Cognition may propose. Runtime reconciles.

## Core Data Flow

The current forward path is:

`Capability discovery` → **Capability Snapshot** → `Cognitive step` → **Cognitive Artifact** → `Runtime validation` → `Policy gate` → `Endpoint execution` → **Observation** → **Reconciliation Result** → `Receipts / audit`.

The cognitive step receives only the capability snapshot and prior observations. It does not receive ambient authority, live tool handles, filesystem access, credentials, or transport configuration.

## Primary Artifacts

1. **Capability Snapshot** — Immutable inventory of available endpoints. Each capability carries server name, capability name, JSON-schema-compatible input shape, optional output shape, risk level, approval requirement, and stable digest.
2. **Cognitive Artifact** — Structured proposal emitted by a model-like component. It includes intent verification, assumptions, reasoning trace, execution intent, uncertainty, observations, and optional yield reason.
3. **Execution Intent** — A requested endpoint action bound to a specific snapshot ID and capability digest.
4. **Policy Gate Result** — Runtime authorization result. Shape validation does not imply permission.
5. **Observation** — Structured record of endpoint output, skipped work, validation failure, or policy refusal.
6. **Reconciliation Result** — Final envelope describing completed, yielded, approval-required, failed, or completed-with-errors outcomes.
7. **Receipts and Audit Envelopes** — Integrity-backed execution and lifecycle evidence from RFC 0048 and related RFCs.

## Trust Boundaries

| Source | May supply | Must not supply |
|--------|------------|-----------------|
| Cognitive function | Structured artifact, execution intent, assumptions, explanation | Authority, forged receipts, endpoints outside the snapshot |
| Runtime | Validation, reconciliation, policy gates, endpoint dispatch, observations | Silent policy bypass, hidden side effects |
| Policy layer | Allow, deny, narrow, approval, yield semantics | Direct endpoint side effects |
| Endpoint executor | Endpoint output, errors, metadata | Expanded authority or altered snapshot semantics |
| Audit layer | Integrity and replay evidence | Retroactive mutation of prior artifacts |

## Validation Order

A conforming reconciliation runtime should evaluate execution intent in this order:

1. Validate the cognitive artifact shape.
2. Confirm the referenced snapshot ID.
3. Confirm endpoint server and capability names exist in the snapshot.
4. Confirm the capability digest.
5. Validate arguments against the original capability input schema.
6. Apply policy gates.
7. Check approval requirements, risk, budget, and preconditions.
8. Execute the endpoint through the runtime boundary.
9. Validate endpoint result shape when available.
10. Record observation, receipt, and reconciliation result.

## Normative vs Reference

- **Normative:** RFC text and JSON Schemas under `schemas/`.
- **Reference:** TypeScript harness, Python helpers, examples, and downstream implementations such as Open Lagrange.

Open Lagrange is an opinionated implementation: Restate for durable execution, Zod for runtime validation, Vercel AI SDK for structured generation, and MCP-shaped endpoint execution. Those choices prove the standard under pressure, but they are not required by Open CoT.

## RFC Map

- **RFC 0052** — Cognitive artifact and capability snapshot.
- **RFC 0053** — Reconciliation result and error taxonomy.
- **RFC 0049** — Capability manifest precursor and model-facing capability projection.
- **RFC 0041** — Policy documents and policy gate inputs.
- **RFC 0047** — Delegation and authority material.
- **RFC 0048** — Execution receipts and audit envelopes.
- **RFC 0051** — Temporal semantics, validity, replay, and ordering.
- **RFC 0001 / 0003 / 0007** — Foundational reasoning, tool invocation, and governed execution lineage.

## Closing Note

The standard should make implementations interchangeable at the artifact boundary. If a runtime discovers a missing portable concept, that concept should become an Open CoT RFC/schema change rather than a private extension.
