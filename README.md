<div align="center">

<pre>
____   ____  ______ _   _    ____   ___ _____
/ __ \ / __ \|  ____| \ | |  / __ \ / _ \_   _|
| |  | | |  | | |__  |  \| | | |  | | | | || |
| |  | | |  | |  __| | . ` | | |  | | | | || |
| |__| | |__| | |____| |\  | | |__| | |_| || |_
\____/ \____/|______|_| \_|  \____/ \___/_____|
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

### Start here in 15 minutes

Run a CPU-friendly smoke experiment end-to-end (prepare -> pre/post eval with mock generation -> validate -> artifact hashes):

```bash
bash scripts/quickstart_experiment.sh
```

Success criteria:

- `experiments/runs/quickstart/pre_post_summary.json` exists
- `experiments/runs/quickstart/artifact_summary.json` exists
- `tools/validate.py` passes

Next step for real model experimentation:

- [`experiments/local_oss_runbook.md`](./experiments/local_oss_runbook.md) for Qwen PEFT train/eval
- [`experiments/factory/eval_pre_post.py`](./experiments/factory/eval_pre_post.py) for scripted pre/post checks

### Validation and tooling checks

Validate schemas and example fixtures locally:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-tools.txt
python tools/validate.py
pytest -q
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
- Tier A examples are in place across core shortnames, including sidecars.
- Synthetic seed data, converter baseline, deterministic mock harness, tests, benchmark starter slice, and reproducible experiment runbooks are implemented.
- RFC cohesion hardening is in progress: open-question closures, stronger methodology/provenance/privacy specs, and interoperability guidance.

## Ideas to chew on

To explore high-interest concerns (hidden reasoning, runaway loops, token budgets, policy safety), start with experiment cards:

- [`docs/experiments/`](./docs/experiments/README.md)

See [`docs/roadmap.md`](./docs/roadmap.md) for phased implementation and conformance direction.
For launch packaging, see [`docs/public-launch.md`](./docs/public-launch.md).

## Contributing

See [`docs/contributing.md`](./docs/contributing.md). Contributions that improve schema quality, examples, conversion pipelines, and benchmark reproducibility are especially valuable.

## License

This project is licensed under the **MIT License**. See [`LICENSE`](./LICENSE) for the full text.
