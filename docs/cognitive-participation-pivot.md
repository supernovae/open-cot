# Cognitive Participation Pivot

Open CoT defines a portable interface between cognition and execution. The
model contributes fuzzy text processing and structured cognitive artifacts; the
runtime boundary validates, authorizes, executes, records observations, and
reconciles final state.

This distinction matters because natural-language reasoning is useful evidence,
but it is not authority. A reasoning trace can explain how a model reached a
proposal. It cannot grant permission, prove correctness, or bypass policy.

| Common market framing | Open CoT framing |
| --- | --- |
| A model owns the loop | A runtime boundary owns reconciliation |
| Tool use is part of the model experience | Endpoint execution is a governed side effect |
| Prompts carry safety expectations | Capability snapshots and policy gates carry authority |
| Reasoning explains the whole run | Reasoning is cognitive evidence inside a larger audit record |
| A failed tool call is explained by natural language | A failed endpoint execution is recorded as a structured observation and error |
| Safety is mostly instruction-following | Safety is layered validation, permission, budget, and result reconciliation |
| Interfaces are private runtime details | Interfaces are portable schemas that independent runtimes can implement |

## Reasoning Remains Central

Open CoT keeps reasoning traces because they are evidence of cognitive
participation. They help answer:

- What objective did the cognitive step believe it was handling?
- What constraints and assumptions shaped the proposal?
- What uncertainty was present before execution?
- What explanation can be shared safely with reviewers?
- What detailed evidence, if any, must remain restricted or redacted?

The trace is intentionally separated from execution authority. A runtime may use
reasoning evidence during review, auditing, debugging, or evaluation, but it
must reconcile execution intents against capability snapshots, policy gates,
budgets, preconditions, and endpoint results.

## Interface Boundary

Open CoT should standardize portable artifacts:

- Cognitive artifacts.
- Capability snapshots.
- Execution intents.
- Reasoning evidence.
- Observations.
- Policy evaluation records.
- Reconciliation results.
- Error taxonomy.
- Budget and cost boundaries.

Open Lagrange and other implementations can then choose their own durable
runtime, transport, endpoint registry, policy engine, and storage model while
still sharing the same interface contract.
