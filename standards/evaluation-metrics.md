# Evaluation metrics

Guidance for scoring chain-of-thought quality, faithfulness, and task success in open-cot benchmarks.

## Dimensions

- **Task correctness**: Did the final answer satisfy the task specification?
- **Step validity**: Are intermediate claims justified and non-contradictory?
- **Efficiency**: Reasonable step count versus a reference or ceiling.
- **Safety**: Refusal, escalation, or harm avoidance where applicable.

## Operationalization

Concrete rubrics and automated checks live under `benchmarks/scoring/`. This file stays high-level so standards and benchmarks can evolve independently.
