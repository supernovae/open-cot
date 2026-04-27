# Open CoT

Open CoT is **Cognitive Operations Theory**: a compact, schema-first standard for the boundary between cognition and execution.

The model contributes a typed cognitive artifact. Runtime code validates, authorizes, executes endpoint capabilities, records observations, and reconciles final state. Reasoning remains important as evidence, but it is never authority.

## Core RFCs

The active RFC set is intentionally small and sequential:

1. Cognitive Artifact & Reasoning Evidence
2. Capability Snapshot & Endpoint Descriptor
3. Execution Intent & Endpoint Invocation
4. Policy Gate & Permission Evaluation
5. Observation, Receipt & Audit Evidence
6. Reconciliation Result & Error Taxonomy
7. Runtime Boundary & Cognitive Pipeline
8. Budget, Cost & Temporal Bounds
9. Requester Identity & Governance Context
10. Human Approval, Yield & Resume
11. Conformance, Registry & Compatibility Rules
12. Compact Context Serialization

Schemas are embedded in the RFC markdown and generated into `schemas/` with `python3 tools/sync_schemas_from_rfcs.py`.

## Validate

```bash
python3 tools/sync_schemas_from_rfcs.py
python3 tools/validate.py
cd harness && npm test
```

Open Lagrange is the opinionated implementation proving this interface under durable execution, policy gates, endpoint execution, and reconciliation.
