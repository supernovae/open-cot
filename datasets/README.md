# Datasets

Data for training, distillation, or evaluating chain-of-thought and reasoning traces in the open-cot ecosystem.

## Layout

| Directory | Purpose |
|-----------|---------|
| `synthetic/` | Generated or programmatically constructed traces. |
| `human-annotated/` | Curated or labeled human reasoning data. |
| `converters/` | Scripts to transform external formats into `schemas/rfc-0001-reasoning.json`. |
| `external/` | External dataset registry, policy, and ingestion pipeline outputs. |

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

## External dataset policy

Open CoT accepts external datasets only when licensing and provenance are explicit.

- Allowed: `MIT`, `Apache-2.0`, `CC-BY-4.0`
- Blocked by default: unknown/custom/ambiguous redistribution terms
- Required for ingestion:
  - source URL
  - owner/org
  - intended usage
  - risk notes
  - deterministic transform and filter details

See `datasets/external/README.md` and `datasets/external/registry.json`.
