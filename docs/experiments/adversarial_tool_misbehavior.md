# Adversarial Tool Misbehavior Stress Test

## Hypothesis

Structured tool invocation and error taxonomy reduce catastrophic failure propagation under adversarial or flaky tool responses.

## Required RFC/schema artifacts

- `schemas/rfc-0003-tool.json`
- `schemas/rfc-0018-tool-error-taxonomy.json`
- `schemas/rfc-0041-policy-enforcement.json`

## Run command

```bash
python experiments/factory/eval_pre_post.py --tasks benchmarks/tasks/task_specs.json --output-dir experiments/runs/tool_card --use-mock --split test
```

## Metrics to report

- tool error categorization coverage
- recovery success rate after injected tool failures
- rate of unsafe tool retries

## Expected failure modes

- untyped error blobs that bypass policy checks
- invalid tool arguments causing repeated failures
- answer hallucination after tool failure
