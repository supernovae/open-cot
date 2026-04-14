# Encrypted/Hidden Reasoning Observability

## Hypothesis

If models hide internal reasoning, enforcing RFC0001 structured traces with verifier sidecars still provides useful observability.

## Required RFC/schema artifacts

- `schemas/rfc-0001-reasoning.json`
- `schemas/rfc-0002-verifier.json`
- `schemas/rfc-0007-agent-loop.json`

## Run command

```bash
bash scripts/quickstart_experiment.sh
python experiments/factory/eval_pre_post.py --tasks benchmarks/tasks/task_specs.json --output-dir experiments/runs/obs_card --use-mock --split test
```

## Metrics to report

- schema validity rate
- step_validity_proxy
- proportion of traces with minimally interpretable reasoning steps

## Expected failure modes

- empty or generic step content while final answer is correct
- non-actionable verifier outputs
- model outputs that avoid structured reasoning even when prompted
