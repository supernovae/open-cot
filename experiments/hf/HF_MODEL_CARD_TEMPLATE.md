# Open CoT Qwen Adapter Model Card Template

Use this template when publishing a Qwen/Open CoT adapter to Hugging Face.

## Model

- Base model: `Qwen/Qwen2.5-1.5B-Instruct`
- Adapter type: LoRA/QLoRA (PEFT)
- Intended use: Open CoT structured reasoning experiments

## Data

- Training sources:
  - synthetic Open CoT dataset manifest path:
  - external dataset manifests (if used):
- License policy check:
  - allowed licenses only (`MIT`, `Apache-2.0`, `CC-BY-4.0`)

## Training config

- seed:
- epochs:
- batch size:
- learning rate:
- max length:
- LoRA params (`r`, `alpha`, `dropout`):

## Evaluation (pre/post)

- split:
- answer mode:
- pre metrics:
  - final_answer_exact_avg:
  - step_validity_proxy_avg:
  - schema_validity_rate:
- post metrics:
  - final_answer_exact_avg:
  - step_validity_proxy_avg:
  - schema_validity_rate:
- delta summary:

## Reproducibility

- run config path:
- pre/post summary path:
- artifact hash summary path:
- commit SHA:

## Schema conformance statement

This model/run pipeline emits traces targeting `schemas/rfc-0001-reasoning.json` and validates outputs via Open CoT validation tooling.

## Caveats

- This is an experimental adapter for reproducibility and community feedback.
- Not intended for high-risk production use without additional safety controls.
