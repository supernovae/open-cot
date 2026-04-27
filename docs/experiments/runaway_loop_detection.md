# Runaway Reasoning Loop Detection

## Hypothesis

Loop-level guardrails can prevent infinite/redundant reasoning traces without collapsing answer quality.

## Required RFC/schema artifacts

- `schemas/rfc-0007-cognitive-pipeline.json`
- `schemas/rfc-0017-cognitive-pipeline-safety-sandboxing.json`
- `schemas/rfc-0038-cost-aware-reasoning-budget.json`

## Run command

```bash
python experiments/factory/eval_pre_post.py --tasks benchmarks/tasks/task_specs.json --output-dir experiments/runs/loop_card --use-mock --split test
```

## Metrics to report

- average steps per trace
- number of repeated step patterns
- termination reason distribution

## Expected failure modes

- repetitive thought loops
- missing explicit termination
- excessive token/step growth on simple tasks
