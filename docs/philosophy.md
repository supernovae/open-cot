# Philosophy

Open-CoT exists to make **governed agent execution** interoperable: a shared, machine-verifiable contract between model output, runtime enforcement, policy, delegation, tools, provenance, and audit.

We are deliberately opinionated about **where trust lives**. Capability flows through grants, policy, and brokers—not through persuasive text in the model channel. That can feel heavier than ad-hoc agent scripts; the bet is that regulated and multi-vendor environments will prefer **one inspectable contract** over many implicit ones.

## Principles

### Typed schemas over ambiguous prose

Every serious boundary—reasoning steps, tool intent, FSM phase, delegation, permission, receipt, audit envelope—is expressed as **JSON Schema** and validated by the harness. Natural language may explain *why* a human approved something; it does not define *whether* a transition is legal.

### The model is an untrusted proposer

Models suggest plans and capability needs. They **never** authorize themselves. The harness treats model output like any other untrusted input: parse, validate, consult policy, then either advance the FSM or refuse. Obedience to the model is a bug.

### Portable harness semantics

The governed FSM and artifact shapes are **model-agnostic**. Any model that can emit structured output (or sit behind an adapter that shapes output) can participate. Portability comes from shared control-plane semantics, not from standardizing hidden chain-of-thought prose.

### Explicit provenance and evidence

Side effects and decisions leave **receipts** and audit-linked records. A completed run should answer: what was requested, what was allowed, what ran, and how integrity was sealed. Silence is not accountability.

### Permission-aware execution

Tool calls require **explicit authority**—grants with scope and lifetime, or a documented standing authorization cited on the execution receipt. Permission is a runtime object managed by the trust stack, not a vibe inferred from the prompt.

### Delegation as a bounded request

When more capability is needed, the agent issues a formal **delegation request**. Policy approves, narrows, denies, or escalates. The auth broker issues a narrowed receipt. Delegation is not a model-signed blank check.

### Fail-closed safety

If validation fails, **deny**. If observation violates policy, **quarantine** and route toward **`fail_safe`** rather than leaking unsafe material back to the model. If budgets exhaust, **stop**. Uncertainty defaults to refusal, not optimism.

Designs that “try the tool call and roll back” still owe the same receipts: optimism belongs in the training loss, not in the authorization boundary.

### Small credible proofs before ambitious claims

The reference harness exists to show that the **contract works**: one end-to-end path that respects the FSM, receipts, and validation. We aim for a narrow, correct slice of the ecosystem—not a declaration that every framework must adopt this stack tomorrow.

If a behavior cannot be expressed in schema and FSM transitions yet, we treat that as a **spec gap** to fix, not as encouragement to bypass the harness with bespoke glue code.
