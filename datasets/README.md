# Datasets

Data for training, distillation, or evaluating chain-of-thought and reasoning traces in the open-cot ecosystem.

## Layout

| Directory | Purpose |
|-----------|---------|
| `synthetic/` | Generated or programmatically constructed traces. |
| `human-annotated/` | Curated or labeled human reasoning data. |
| `converters/` | Scripts to transform external formats into `schemas/rfc-0001-reasoning.json`. |

## Format

Prefer traces that validate against `schemas/rfc-0001-reasoning.json`. Document any extensions in dataset-specific README files.

## Dataset manifest minimum fields

Each releasable dataset package should declare:

- `name`
- `version`
- `schema_target`
- `license`
- `provenance`
- `safety_release_checks` (PII, unsafe-content, license review)
- split metadata (`train`/`validation`/`test` counts or IDs)
