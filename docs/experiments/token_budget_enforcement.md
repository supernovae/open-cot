# Token Budget Enforcement

## Hypothesis

Explicit token/step budgets improve predictability and cost control while maintaining acceptable answer quality.

## Required RFC/schema artifacts

- `schemas/rfc-0038-cost-aware-reasoning-budget.json`
- `schemas/rfc-0039-tool-cost-modeling.json`
- `schemas/rfc-0040-multi-agent-economic-incentives.json`

## Run command

```bash
python experiments/factory/eval_pre_post.py --tasks benchmarks/tasks/task_specs.json --output-dir experiments/runs/budget_card --use-mock --split test
```

## Metrics to report

- completion under budget rate
- final_answer_exact vs baseline
- schema validity under constrained decoding

## Expected failure modes

- premature truncation causing wrong final answers
- hidden over-budget behavior not reflected in traces
- budget policy mismatches between components
