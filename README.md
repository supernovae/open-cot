<div align="center">

<pre>
 ██████╗ ██████╗ ████████╗
██╔════╝██╔═══██╗╚══██╔══╝
██║     ██║   ██║   ██║
██║     ██║   ██║   ██║
╚██████╗╚██████╔╝   ██║
 ╚═════╝ ╚═════╝    ╚═╝
</pre>

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

In practice, this project gives you:

- Shared JSON Schemas for reasoning and related sidecars.
- Validation + sync tooling to keep RFCs, schemas, and examples aligned.
- A path to synthetic data, reference harnesses, and reproducible benchmarks.

If you are evaluating quickly:

1. Read the phased implementation plan in [`docs/roadmap.md`](./docs/roadmap.md).
2. Run the local checks in **Quick start** below.
3. Review contribution and governance expectations in [`docs/contributing.md`](./docs/contributing.md).

---

## What this repo contains

| Area | Role |
|------|------|
| [`schemas/`](./schemas/) | Versioned JSON Schemas per RFC (`registry.json`, `rfc-*-*.json`) |
| [`examples/`](./examples/) | Validated instance fixtures keyed by registry shortname |
| [`standards/`](./standards/) | Human-readable patterns, metrics, narrative docs |
| [`datasets/`](./datasets/) | Conventions and converters for training-ready data |
| [`reference/python/`](./reference/python/) | Reference Python tooling |
| [`benchmarks/`](./benchmarks/) | Tasks, scoring, leaderboards |
| [`docs/`](./docs/) | Philosophy, roadmap, contributing |

## Core goals

- Universal schema for reasoning traces.
- Library of canonical reasoning patterns.
- Dataset format for synthetic and human-annotated reasoning.
- Reference tooling for parsing, validating, converting, and loop execution.
- Benchmark slices for comparing reasoning quality.

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

## Quick start

Validate schemas and example fixtures locally:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-tools.txt
python tools/validate.py
```

Regenerate schema artifacts from RFCs:

```bash
python tools/sync_schemas_from_rfcs.py
```

Run semantic schema diff checks (for PR review):

```bash
python tools/diff_checker.py /path/to/before/schemas ./schemas --strict --min-severity major
```

## Current status

- RFC-backed schema registry and CI validation are in place.
- Examples exist for key shortnames (`reasoning`, `verifier_output`, `reward_fusion`, `agent_loop`, `dataset_packaging`).
- Dataset generators, converters, benchmark tasks, and richer harness code are active roadmap items.

See [`docs/roadmap.md`](./docs/roadmap.md) for phased implementation and conformance direction.

## Contributing

See [`docs/contributing.md`](./docs/contributing.md). Contributions that improve schema quality, examples, conversion pipelines, and benchmark reproducibility are especially valuable.

## License

This project is licensed under the **MIT License**. See [`LICENSE`](./LICENSE) for the full text.
