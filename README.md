<div align="center">

<img src="./assets/open-cot-banner.png" alt="Open CoT banner" width="100%" />

### Schemas for Cognitive Artifacts, Capabilities, and Reconciliation

**Open CoT** — an open standard for portable cognitive artifacts, capability snapshots, execution intent, observations, policy boundaries, receipts, and reconciliation results.

<img src="https://img.shields.io/badge/Project-Open%20CoT-5c6bc0?style=for-the-badge" alt="Open CoT" />
<a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License: MIT" /></a>
<a href="./docs/contributing.md"><img src="https://img.shields.io/badge/Contributions-Welcome-4caf50?style=for-the-badge" alt="Contributions welcome" /></a>
<a href="./schemas/rfc-0052-cognitive-artifact.json"><img src="https://img.shields.io/badge/Schema-JSON%20Draft-ff9800?style=for-the-badge" alt="JSON Schema" /></a>

</div>

---

## Why This Exists

Modern AI systems need a stable contract between fuzzy cognition and concrete capability. The model-like component can interpret, summarize, propose, and produce typed artifacts, but it must not own runtime authority or side effects.

Open CoT defines the portable interface layer for that boundary:

- what cognitive artifacts look like,
- how available capabilities are represented,
- how execution intent binds to an immutable capability snapshot,
- how policy, delegation, budget, and receipts are recorded,
- how observations and final reconciliation results are serialized.

Earlier runtime-governance language was useful while the project was searching for the right security shape. The standard is now moving toward a sharper inversion: **cognition emits structured artifacts; runtimes reconcile those artifacts against capability, policy, budget, and evidence**.

## The Core Insight

The LLM is not the runtime, orchestrator, or authority boundary. It is a non-deterministic cognitive function. A runtime can use its output only after validation and reconciliation.

**Cognition emits.** Schemas express. Capability snapshots bound what may be requested. Policy gates authorize or refuse. Runtimes execute through explicit endpoints. Observations, receipts, and reconciliation results prove what happened.

This makes Open CoT useful beyond any one framework. An implementation can use Restate, Temporal, a queue worker, a local process, MCP, HTTP, or a custom executor. The portable layer is the schema contract, not the implementation stack.

## What This Repo Contains

| Area | Role |
|------|------|
| [`rfcs/`](./rfcs/) | **53 RFCs** covering reasoning traces, tool invocation, governed execution, policy, delegation, receipts, capability manifests, cognitive artifacts, and reconciliation results |
| [`schemas/`](./schemas/) | Versioned JSON Schemas per RFC, including `registry.json` |
| [`harness/`](./harness/) | Reference TypeScript core package that exercises earlier governed execution RFCs |
| [`examples/`](./examples/) | Validated instance fixtures keyed by registry shortname |
| [`reference/python/`](./reference/python/) | Reference Python tooling |
| [`tools/`](./tools/) | Schema and fixture validation, registry sync, and RFC helpers |
| [`standards/`](./standards/) | Human-readable reasoning patterns and evaluation metrics |
| [`datasets/`](./datasets/) | Conventions and converters for training-ready data |
| [`benchmarks/`](./benchmarks/) | Tasks, scoring, leaderboards |
| [`conformance/`](./conformance/) | Conformance and interoperability material |
| [`docs/`](./docs/) | Architecture, philosophy, contributing, experiments, and launch notes |

For the current architecture framing, see [`docs/architecture.md`](./docs/architecture.md).

## Forward Spine

The newer reconciliation-oriented spine is:

- **RFC 0052** — cognitive artifacts, execution intent, observations, and immutable capability snapshots.
- **RFC 0053** — reconciliation result envelope and structured error taxonomy.
- **RFC 0049** — capability manifests, now a predecessor to more precise capability snapshots.
- **RFC 0041** — policy documents and policy gate semantics.
- **RFC 0047** — delegation requests, decisions, and authority receipts.
- **RFC 0048** — execution receipts and audit envelopes.
- **RFC 0051** — temporal semantics for validity, replay, and ordering.

Older RFCs still matter. RFC 0001, 0003, and 0007 define foundational reasoning, tool invocation, and governed execution concepts. The new RFCs clarify how those ideas become a portable schema layer for reconciliation runtimes.

## Design Principles

- **Typed artifacts over prompt contracts** — model output is structured input, not authority.
- **Capability snapshots over ambient tools** — cognition sees an explicit inventory and cannot invent endpoints.
- **Execution intent over direct execution** — proposed work is reconciled before side effects.
- **Policy gates over schema-only safety** — valid shape is not permission.
- **Observations and receipts over logs alone** — every side effect should leave replayable evidence.
- **Implementation neutrality** — Open CoT should not require Restate, MCP, Vercel AI SDK, Open Lagrange, or any specific runtime.
- **Spec gaps become RFC work** — if an implementation needs a general interface, it belongs here.

## Quick Start

Validate schemas and examples:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-tools.txt
python tools/validate.py
```

Run the reference package:

```bash
cd harness && npm install && npm test
```

## Open Lagrange Relationship

Open Lagrange is the opinionated TypeScript proving ground for this standard. It uses Restate for durable reconciliation, Zod for runtime boundaries, Vercel AI SDK for structured cognitive artifact generation, and MCP-shaped endpoints for side effects.

That implementation pressure-tests Open CoT. If Open Lagrange needs a portable structure, this repo should receive the RFC/schema update instead of letting a private dialect grow elsewhere.

## Current Status

- **53 RFCs** and a versioned JSON Schema registry.
- New draft schemas for cognitive artifacts and reconciliation results.
- Reference package coverage for governed execution, policy, delegation, receipts, budgets, and capability manifests.
- Cross-language validation tooling for schemas and examples.
- Experiment cards and local runbooks under [`docs/experiments/`](./docs/experiments/).

## Contributing

See [`docs/contributing.md`](./docs/contributing.md). Normative changes belong in RFCs first; implementations should follow the spec and feed gaps back into it.

## License

This project is licensed under the **MIT License**. See [`LICENSE`](./LICENSE).
