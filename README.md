<div align="center">

<img src="./assets/open-cot-banner.png" alt="Open CoT banner" width="100%" />

### Cognitive Control Plane for Governed Agent Execution

**Open CoT** — an open standard and reference implementation for model-agnostic governed agent execution.

<img src="https://img.shields.io/badge/Project-Open%20CoT-5c6bc0?style=for-the-badge" alt="Open CoT" />
<a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License: MIT" /></a>
<a href="./docs/contributing.md"><img src="https://img.shields.io/badge/Contributions-Welcome-4caf50?style=for-the-badge" alt="Contributions welcome" /></a>
<a href="./schemas/rfc-0001-reasoning.json"><img src="https://img.shields.io/badge/Schema-JSON%20Draft-ff9800?style=for-the-badge" alt="JSON Schema" /></a>

</div>

---

## Why this exists

Agents need to reach tools, data, and services, but every stack reinvents authorization, safety boundaries, and audit. Models are often treated as if their natural-language output were both intent and permission. There is no **portable contract** between what a model *proposes* and what a deployment *allows*.

> Open-CoT is a model-agnostic cognitive control plane that standardizes the trusted contract between model output, harness/runtime enforcement, policy, delegation, tool execution, provenance, and audit.

Open-CoT separates those layers: typed schemas for proposals and artifacts, a **normative governed execution model**, and a reference harness that enforces the contract end to end. The same envelopes and state machine can sit behind different models and runtimes because the control plane is explicit, not inferred from free-form text.

That matters wherever you need **comparable audit**, **shared tooling across vendors**, or **defensible denial** when a model asks for something unsafe. The goal is not prettier logs; it is a **trusted contract** between proposal and execution.

## The core insight

If reasoning, tool intent, provenance, budgets, state transitions, and delegation are carried in **stable typed schemas**, then a harness or runtime can be **portable** across models: it does not have to reverse-engineer each vendor’s behavior.

**Models propose.** Schemas **express**. The harness **validates**. Policy **decides**. The auth broker **narrows** scope and issues receipts. Tools **execute** only under granted authority. Receipts and audit artifacts **prove** what ran and who allowed it.

## What this repo contains

| Area | Role |
|------|------|
| [`rfcs/`](./rfcs/) | **48 RFCs** — normative definitions for reasoning traces, tool invocation, the governed FSM, sandboxing, budgets, permissions, policy, delegation, provenance, identity, org governance, receipts, and audit |
| [`schemas/`](./schemas/) | Versioned JSON Schemas per RFC (`registry.json`, `rfc-*-*.json`) |
| [`harness/`](./harness/) | **Reference harness** (TypeScript) — governed FSM, validation, tools, budgets, trace emission |
| [`examples/`](./examples/) | Validated instance fixtures keyed by registry shortname |
| [`reference/python/`](./reference/python/) | Reference Python tooling |
| [`tools/`](./tools/) | Schema and fixture validation (`validate.py`, sync helpers) |
| [`standards/`](./standards/) | Human-readable patterns, metrics, narrative docs |
| [`datasets/`](./datasets/) | Conventions and converters for training-ready data |
| [`benchmarks/`](./benchmarks/) | Tasks, scoring, leaderboards |
| [`conformance/`](./conformance/) | Conformance and interoperability material |
| [`tests/`](./tests/) | Shared Python tests for validation and tooling |
| [`docs/`](./docs/) | Contributing, architecture, philosophy, ELI5 guide, experiment cards |

For a concise layout of control plane vs data plane, see [`docs/architecture.md`](./docs/architecture.md).

**If you are evaluating quickly:** (1) read [`docs/eli5_guide.md`](./docs/eli5_guide.md), (2) run the harness tests above, (3) run `python tools/validate.py`, (4) skim RFC 0007 plus RFCs 0041, 0042, 0047, and 0048 for the governance spine.

## The governed execution model

RFC 0007 defines a **fourteen-state** finite state machine. A compliant run starts in **`receive`** and ends in **`audit_seal`**. Along the main path:

`receive` → `frame` → `plan` → `request_authority` → `validate_authority` → `delegate_narrow` → `execute_tool` → `observe_result` → `critique_verify` → `finalize` → `audit_seal`

Authority and failure routing adds **`deny`**, **`escalate`**, and **`fail_safe`**, each terminating into a sealed audit according to policy.

**The model cannot self-authorize.** It may only request capabilities; the harness, policy engine, and broker decide, narrow, and record grants. **Tool side effects occur only in `execute_tool`**, with explicit permission or a documented standing authorization cited on the execution receipt (RFC 0048).

RFC 0007 also allows a **pre-authorized shortcut** from `plan` to `execute_tool` when a deployment holds a **standing grant** (for example, sandbox allowlists): the shortcut must still be cited on the receipt so auditors can see why delegation states were skipped.

## Design principles

- **Typed schemas over ambiguous prose** — contracts are JSON Schema, not instructions embedded in model copy.
- **The model is an untrusted proposer** — output is validated input, not implicit command.
- **Portable harness semantics** — the same FSM and envelopes apply across models and adapters.
- **Explicit provenance and evidence** — receipts, delegation records, and audit envelopes close the loop.
- **Permission-aware tool execution** — grants are scoped, consumable, and auditable.
- **Delegation as a bounded request** — narrow, time-bounded authority; no self-issued power of attorney.
- **Policy-enforced narrowing and auditability** — policy consults at defined boundaries; runs seal into tamper-evident audit material.

Values behind these bullets are expanded in [`docs/philosophy.md`](./docs/philosophy.md).

## Quick start

**Reference harness** (mock backend, no API keys required):

```bash
cd harness && npm install && npm test
```

Optional demos: `npx tsx examples/chat-demo.ts` and `npx tsx examples/coder-demo.ts` (see [`harness/README.md`](./harness/README.md)).

**Python validation** (schemas + examples):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-tools.txt
python tools/validate.py
```

**New to the project?** Start with [`docs/eli5_guide.md`](./docs/eli5_guide.md).

**Optional:** CPU-friendly smoke path `bash scripts/quickstart_experiment.sh`; after installing `requirements-tools.txt`, run `pytest -q` for repo tests. For local OSS train/eval, see [`experiments/local_oss_runbook.md`](./experiments/local_oss_runbook.md).

**Live LLM** (OpenAI-compatible endpoint such as Ollama):

```bash
cd harness && OPENAI_BASE_URL=http://localhost:11434/v1 npx tsx examples/chat-demo.ts "Explain recursion"
```

## What the harness covers

| Capability | RFC | Harness touchpoints |
|------------|-----|---------------------|
| Governed execution FSM | RFC 0007 | `src/schemas/agent-loop.ts`, `src/core/transitions.ts` |
| Permission system | RFC 0042 | `src/schemas/permission.ts` (grants; model cannot mint) |
| Policy enforcement (consult hooks + loop guardrails) | RFC 0041 | `src/core/loop-policy.ts`, schema alignment with RFC 0041 / 0043 |
| Delegation flow | RFC 0047 | `src/schemas/delegation.ts`, `AgentState` delegation fields |
| Execution receipts | RFC 0048 | `src/schemas/receipt.ts` |
| Audit envelopes | RFC 0043 | `src/schemas/audit-envelope.ts` |
| Budget enforcement | RFC 0038 | `src/core/budget-tracker.ts` |
| Tool contracts | RFC 0003 (+ 0018 errors) | `src/core/tool-registry.ts`, `src/tools/` |
| Safety sandboxing | RFC 0017 | `src/schemas/sandbox.ts`, enforcement in tool registry |
| Observability telemetry | RFC 0031 | `src/schemas/telemetry.ts`, metrics on `AgentState` |

The harness and schemas **mutually stress-test** each other: invalid transitions or shapes fail fast in CI; gaps in the spec show up as harness friction.

Reasoning **patterns** (plan–verify, debate, and similar) remain documented for datasets and evaluation in [`standards/reasoning-patterns.md`](./standards/reasoning-patterns.md); they sit alongside the control plane, not instead of it.

## Current status

- **48 RFCs** and a versioned JSON Schema registry with CI validation.
- Reference harness implements the governed FSM, delegation and receipt types, budgets, sandboxed tools, and trace validation (see table above).
- Cross-language checks: TypeScript-emitted traces validate under Python tooling.
- Tiered examples, synthetic seed data, and experiment runbooks under [`experiments/`](./experiments/).

## Experiment cards

For focused scenarios (hidden reasoning, runaway loops, token budgets, policy hooks), see [`docs/experiments/`](./docs/experiments/README.md). Launch packaging notes live in [`docs/public-launch.md`](./docs/public-launch.md).

## Contributing

See [`docs/contributing.md`](./docs/contributing.md). Improvements to schema clarity, harness coverage, examples, and benchmarks are especially welcome.

Normative changes belong in RFCs first; reference code should follow the spec, not the other way around. Small harness fixes that clarify an already-intended RFC are welcome when they include a pointer to the RFC section they implement.

### RFC feedback process

- Use each RFC’s linked GitHub **Discussion** for normative debate.
- Use **Issues** for actionable implementation work.
- RFC changes in PRs should link the RFC file and its Discussion thread.
- Index of discussions: [`docs/rfc-discussions.md`](./docs/rfc-discussions.md).

## License

This project is licensed under the **MIT License**. See [`LICENSE`](./LICENSE) for the full text.
