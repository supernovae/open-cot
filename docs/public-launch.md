# Public Launch Playbook

This playbook packages Open CoT for public feedback and fast experimentation.

## Track A: 15-minute smoke path (CPU-friendly)

```bash
bash scripts/quickstart_experiment.sh
```

Share:

- `experiments/runs/quickstart/pre_post_summary.json`
- `experiments/runs/quickstart/artifact_summary.json`
- commit SHA

## Track B: Qwen PEFT train/eval path (GPU recommended)

Follow:

- `experiments/local_oss_runbook.md`

Share:

- run config (`experiments/configs/qwen2_5_1_5b_peft.json`)
- dataset manifests and license notes
- pre/post metrics
- artifact hash summary

## Hugging Face publish checklist

Use:

- `experiments/hf/HF_MODEL_CARD_TEMPLATE.md`
- `experiments/reference_run/qwen_1p5b_release/`

Include:

- base model reference: `Qwen/Qwen2.5-1.5B-Instruct`
- schema conformance statement
- caveats and safety notes
- reproducibility fields (seed, config, hashes, metrics)
