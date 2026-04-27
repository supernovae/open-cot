# Philosophy

Open CoT exists to make the boundary between cognition and capability portable.

The model-like component is useful because it can interpret, compress, explain, and propose. It is not useful as an authority boundary. Open CoT treats its output as a cognitive artifact: structured, inspectable, and untrusted until a runtime reconciles it against capability, policy, budget, and evidence.

## Principles

### Typed artifacts over ambiguous prose

Every serious boundary should be expressed as JSON Schema: cognitive artifact, capability snapshot, execution intent, policy material, observation, receipt, and reconciliation result. Natural language can explain context; it cannot grant permission.

### Capability snapshots over ambient access

Cognition receives an explicit snapshot of available endpoints. The snapshot binds endpoint names, input shape, risk, approval requirement, and digest. Requests outside that snapshot are invalid.

### Execution intent is not execution

An execution intent is a proposal. A runtime must validate shape, snapshot identity, capability digest, arguments, policy, risk, approval, budget, and preconditions before side effects occur.

### Policy is separate from validation

Zod, JSON Schema, or any other validator can prove shape. They cannot prove permission. Policy gates are separate artifacts and should leave their own evidence.

### Observations over transcript trust

Endpoint output becomes an observation. Observations are structured runtime records, not loose transcript text. They can carry result data, skipped work, validation failures, policy refusals, and reconciliation errors.

### Reconciliation over orchestration by text

The runtime owns progression. The cognitive step emits an artifact, then yields to the runtime boundary. This keeps retries, crash recovery, endpoint execution, and audit in deterministic code.

### Implementation pressure should improve the standard

Open Lagrange is a proving ground, not a competing dialect. If it needs a portable structure, Open CoT should gain or refine an RFC/schema. Runtime-specific choices stay local; reusable interfaces belong here.

### Backward compatibility without freezing vocabulary

Earlier RFCs use historical terms from the project’s transitional period. Those documents remain part of the record. New work should prefer cognition, capability, execution intent, observation, policy gate, runtime boundary, and reconciliation terminology.
