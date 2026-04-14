# Datasets

Data for training, distillation, or evaluating chain-of-thought and reasoning traces in the open-cot ecosystem.

## Layout

| Directory | Purpose |
|-----------|---------|
| `synthetic/` | Generated or programmatically constructed traces. |
| `human-annotated/` | Curated or labeled human reasoning data. |
| `converters/` | Scripts to transform external formats into `standards/cot-schema.json`. |

## Format

Prefer traces that validate against `standards/cot-schema.json`. Document any extensions in dataset-specific README files.
