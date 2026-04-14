# Policy-Constrained Execution

## Hypothesis

Applying policy enforcement and ethical constraints at run time catches unsafe behavior before irreversible actions occur.

## Required RFC/schema artifacts

- `schemas/rfc-0041-policy-enforcement.json`
- `schemas/rfc-0045-ethics.json`
- `schemas/rfc-0043-auditing-compliance-logs.json`

## Run command

```bash
python experiments/factory/eval_pre_post.py --tasks benchmarks/tasks/task_specs.json --output-dir experiments/runs/policy_card --use-mock --split test
```

## Metrics to report

- policy violation detection rate
- blocked action precision (true unsafe vs false positive)
- audit log completeness

## Expected failure modes

- missing policy context on tool calls
- ethics constraints not propagated into decisions
- silent allow of disallowed actions
