<div align="center">

<img src="./assets/open-cot-banner.png" alt="Open CoT banner" width="100%" />

### Chain of Thought Reasoning Framework

**Open CoT Standard &amp; Toolkit** — an open-source, community-driven home for interoperable reasoning traces.

<img src="https://img.shields.io/badge/Project-Open%20CoT-5c6bc0?style=for-the-badge" alt="Open CoT" />
<a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License: MIT" /></a>
<a href="./docs/contributing.md"><img src="https://img.shields.io/badge/Contributions-Welcome-4caf50?style=for-the-badge" alt="Contributions welcome" /></a>
<a href="./schemas/rfc-0001-reasoning.json"><img src="https://img.shields.io/badge/Schema-JSON%20Draft-ff9800?style=for-the-badge" alt="JSON Schema" /></a>

</div>

---

## Why this exists

Many models now hide or encrypt reasoning traces, making systems harder to audit, compare, and improve. Open CoT defines open, versioned standards for structured reasoning so teams can build interoperable tooling instead of one-off formats.

The schema is not just descriptive — it is **executable**. The [reference harness](./harness/) proves the standard works by running real agent loops that emit, consume, and validate RFC-compliant traces. The harness becomes the reference implementation; the schema becomes the contract the harness proves out.

In practice, this project gives you:

- **Shared JSON Schemas** for reasoning traces, tool calls, budgets, and telemetry.
- **A working TypeScript harness** that runs agents end-to-end against the schemas.
- **Validation + sync tooling** to keep RFCs, schemas, and examples aligned.
- **A path to model training** with synthetic data and reproducible benchmarks.

If you are evaluating quickly:

1. If you are new to this space, start with the beginner guide: [`docs/eli5_guide.md`](./docs/eli5_guide.md).
2. Run the **reference harness** to see the schema in action: `cd harness && npm install && npm test`.
3. Run the local Python checks in **Quick start** below.
4. Review contribution and governance expectations in [`docs/contributing.md`](./docs/contributing.md).

---

## What this repo contains

| Area | Role |
|------|------|
| [`harness/`](./harness/) | **Reference harness** — TypeScript agents that prove the schema is executable, testable, and operational |
| [`schemas/`](./schemas/) | Versioned JSON Schemas per RFC (`registry.json`, `rfc-*-*.json`) |
| [`examples/`](./examples/) | Validated instance fixtures keyed by registry shortname |
| [`standards/`](./standards/) | Human-readable patterns, metrics, narrative docs |
| [`datasets/`](./datasets/) | Conventions and converters for training-ready data |
| [`reference/python/`](./reference/python/) | Reference Python tooling |
| [`benchmarks/`](./benchmarks/) | Tasks, scoring, leaderboards |
| [`docs/`](./docs/) | Contributing, ELI5 guide, experiment cards |

## The idea: schema as contract, harness as proof

The schema and the harness verify each other:

**Schema verifies the harness** by forcing valid event structure, consistent state transitions, budget accounting, tool result shape, completion criteria, and replayability.

**Harness verifies the schema** by proving the schema is sufficient, ergonomic, debuggable, and works under real loops — not just on paper.

This means model creators, framework authors, and tool builders can use the same standard. Reasoning/CoT becomes something you can standardize across OSS models — reducing what each project needs to reinvent and reducing what end users need to implement.

## Reference harness quick start

The TypeScript harness runs two agent implementations against the schema:

```bash
cd harness
npm install
npm test                                    # 54 tests, mock backend, zero external deps
npx tsx examples/chat-demo.ts               # conversational agent demo
npx tsx examples/coder-demo.ts              # plan-do-act coding agent demo
```

Use a real LLM (Ollama, OpenAI, vLLM, LiteLLM):

```bash
OPENAI_BASE_URL=http://localhost:11434/v1 npx tsx examples/chat-demo.ts "Explain recursion"
```

See [`harness/README.md`](./harness/README.md) for full architecture, FSM transition map, budget enforcement, and how to add your own agents and tools.

## Python quick start

Run a CPU-friendly smoke experiment end-to-end:

```bash
bash scripts/quickstart_experiment.sh
```

Validate schemas and example fixtures locally:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-tools.txt
python tools/validate.py
pytest -q
```

Next step for real model experimentation:

- [`experiments/local_oss_runbook.md`](./experiments/local_oss_runbook.md) for Qwen PEFT train/eval
- [`experiments/factory/eval_pre_post.py`](./experiments/factory/eval_pre_post.py) for scripted pre/post checks

## What the harness covers

| Capability | RFCs | Harness layer |
|-----------|------|---------------|
| Reasoning trace format | RFC 0001 | `src/schemas/trace.ts`, validated by `src/core/validator.ts` |
| Tool invocation contracts | RFC 0003, 0018 | `src/core/tool-registry.ts`, `src/tools/` |
| Agent loop FSM | RFC 0007 | `src/core/transitions.ts` — plan, inspect, act, verify, repair, summarize, stop |
| Safety sandboxing | RFC 0017 | `src/schemas/sandbox.ts`, enforced in tool registry |
| Observability telemetry | RFC 0031 | `src/schemas/telemetry.ts`, emitted in agent state |
| Token cost modeling | RFC 0037 | Tracked via budget tracker |
| Budget enforcement | RFC 0038 | `src/core/budget-tracker.ts` — hard/soft/warn modes |

## Canonical patterns

Open CoT tracks reusable reasoning structures, including:

- Deductive chain
- Inductive chain
- Hypothesis -> test -> revision
- Multi-agent debate
- Self-critique loop
- Planning -> execution -> verification
- Error-driven refinement

See [`standards/reasoning-patterns.md`](./standards/reasoning-patterns.md) for definitions and pattern taxonomy.

## Current status

- RFC-backed schema registry (45 RFCs) and CI validation are in place.
- **Reference harness** implements two agents (chat + coder) with full FSM, budgets, tools, and schema validation.
- Tier A examples, synthetic seed data, and reproducible experiment runbooks are implemented.
- Cross-language validation: TypeScript harness traces can be validated by Python tooling.

## Experiment cards

To explore high-interest concerns (hidden reasoning, runaway loops, token budgets, policy safety), start with experiment cards:

- [`docs/experiments/`](./docs/experiments/README.md)

For launch packaging, see [`docs/public-launch.md`](./docs/public-launch.md).

## Contributing

See [`docs/contributing.md`](./docs/contributing.md). Contributions that improve schema quality, harness coverage, examples, conversion pipelines, and benchmark reproducibility are especially valuable.

### RFC feedback process

- RFC discussion happens in each RFC's linked GitHub **Discussion** thread.
- Use GitHub **Issues** for actionable implementation work (bugs/tasks), not normative RFC debate.
- If you propose an RFC change in a PR, include links to both the RFC file and its Discussion thread.
- Browse all active RFC discussion threads in [`docs/rfc-discussions.md`](./docs/rfc-discussions.md).

## License

This project is licensed under the **MIT License**. See [`LICENSE`](./LICENSE) for the full text.
