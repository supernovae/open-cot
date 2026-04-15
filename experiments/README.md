# Experiments (0.1)

This directory hosts reproducible demonstration tracks for Open CoT.

## Tracks

- `local_oss_runbook.md`: local OSS training/eval runbook using `Qwen/Qwen2.5-1.5B-Instruct` + PEFT.
- `api_baseline_runbook.md`: API-backed baseline path.

Public launch tracks:

- **Track A:** CPU-friendly 15-minute smoke path (`scripts/quickstart_cpu_mock.sh`)
- **Track B:** GPU-recommended Qwen PEFT train/eval path (`local_oss_runbook.md`)
- **Track C:** Benchmark-only path (`scripts/quickstart_benchmark_only.sh`)

## Factory pipeline

Scripts under `factory/` provide the low-friction workflow:

- `prepare_cot_sft.py`: convert RFC0001 trace JSONL into SFT train/validation JSONL.
- `train_qwen_peft.py`: run LoRA/QLoRA fine-tuning.
- `eval_pre_post.py`: run pre/post eval and compute schema/benchmark metrics.
- `run_lm_eval_adapter.py`: run/adapt `lm-eval-harness` outputs into Open CoT traces + summary.
- `export_artifacts.py`: hash and bundle outputs for reproducibility.

## Config templates

- `configs/qwen2_5_1_5b_peft.json`: starter config values for Qwen2.5-1.5B.

## Dependencies

- Core repo tooling: `requirements-tools.txt`
- Minimal experiment pipeline deps (CPU smoke path): `requirements-tools.txt`
- Qwen PEFT stack: `requirements-qwen-peft.txt`

## One-command smoke path

From repo root:

```bash
bash scripts/quickstart_cpu_mock.sh
```

This runs the 15-minute CPU-friendly path:

1. Prepare SFT data from synthetic traces
2. Run pre/post eval with mock generator
3. Validate schemas/examples
4. Export artifact hashes

Additional paths:

```bash
# Benchmark-only profile check path
bash scripts/quickstart_benchmark_only.sh

# Real model train/eval path (GPU recommended)
bash scripts/quickstart_gpu_real.sh
```

## CPU/GPU guidance

- CPU: data prep + validation + mock eval + smoke checks.
- GPU: recommended for practical fine-tuning (LoRA/QLoRA).

## Reference run artifacts

See `reference_run/` for:

- prompts
- model outputs
- benchmark metrics
- config metadata
- output hashes

These artifacts demonstrate a reproducible evaluation/reporting pattern for 0.1.

For Hugging Face publication packaging:

- `experiments/hf/HF_MODEL_CARD_TEMPLATE.md`
- `experiments/reference_run/qwen_1p5b_release/`
