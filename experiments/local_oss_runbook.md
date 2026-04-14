# Local OSS Model Runbook (Qwen2.5-1.5B + PEFT)

## Goal

Fine-tune `Qwen/Qwen2.5-1.5B-Instruct` on Open CoT traces with a low-friction PyTorch + Transformers + PEFT workflow, then verify pre/post quality with schema + benchmark scoring.

## Why this model

`Qwen2.5-1.5B-Instruct` is a practical 1.5B instruct model with strong structured-output behavior and broad community usage, making it a strong 0.1 baseline for reproducible OSS experiments.

## Stack choice (least-friction path)

- Framework: PyTorch + Transformers + PEFT
- Adapter method: LoRA (QLoRA optional with 4-bit loading)
- Data shape: RFC 0001 traces -> SFT JSONL via factory script
- Verification: `reference/python/validator.py` + `benchmarks/scoring/scorer.py`

## Hardware guidance

- **GPU recommended for training**: 12GB+ VRAM for practical LoRA/QLoRA runs.
- **CPU path**: data prep + pre/post eval + validation works; training is possible but slow and mainly for smoke tests.
- **Determinism**: use fixed seeds and fixed decode params.

## 1) Environment setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-tools.txt
pip install -r experiments/requirements-qwen-peft.txt
```

## 2) Prepare SFT data from Open CoT traces

```bash
python experiments/factory/prepare_cot_sft.py \
  --input datasets/synthetic/task_bank_v0.jsonl \
  --output-dir experiments/data/qwen_cot_sft \
  --val-ratio 0.2 \
  --seed 42
```

Outputs:

- `experiments/data/qwen_cot_sft/train.jsonl`
- `experiments/data/qwen_cot_sft/validation.jsonl`
- `experiments/data/qwen_cot_sft/manifest.json`

## 3) Run pre-train baseline eval

```bash
python experiments/factory/eval_pre_post.py \
  --tasks benchmarks/tasks/task_specs.json \
  --output-dir experiments/runs/qwen2.5-1.5b-peft \
  --base-model Qwen/Qwen2.5-1.5B-Instruct \
  --max-new-tokens 128
```

For CPU/test-only smoke runs without model downloads:

```bash
python experiments/factory/eval_pre_post.py \
  --tasks benchmarks/tasks/task_specs.json \
  --output-dir experiments/runs/qwen2.5-1.5b-peft \
  --use-mock
```

## 4) Train PEFT adapter

Minimal LoRA run:

```bash
python experiments/factory/train_qwen_peft.py \
  --model-name Qwen/Qwen2.5-1.5B-Instruct \
  --train-file experiments/data/qwen_cot_sft/train.jsonl \
  --val-file experiments/data/qwen_cot_sft/validation.jsonl \
  --output-dir experiments/runs/qwen2.5-1.5b-peft \
  --epochs 1 \
  --batch-size 1 \
  --gradient-accumulation-steps 8 \
  --learning-rate 2e-4 \
  --max-length 1024
```

QLoRA mode (GPU + bitsandbytes):

```bash
python experiments/factory/train_qwen_peft.py \
  --model-name Qwen/Qwen2.5-1.5B-Instruct \
  --train-file experiments/data/qwen_cot_sft/train.jsonl \
  --val-file experiments/data/qwen_cot_sft/validation.jsonl \
  --output-dir experiments/runs/qwen2.5-1.5b-peft \
  --use-4bit
```

## 5) Run post-train eval

```bash
python experiments/factory/eval_pre_post.py \
  --tasks benchmarks/tasks/task_specs.json \
  --output-dir experiments/runs/qwen2.5-1.5b-peft \
  --base-model Qwen/Qwen2.5-1.5B-Instruct \
  --adapter-path experiments/runs/qwen2.5-1.5b-peft/adapter \
  --max-new-tokens 128
```

## 6) Export reproducibility artifacts

```bash
python experiments/factory/export_artifacts.py \
  --run-dir experiments/runs/qwen2.5-1.5b-peft
```

## 7) Verify schema and benchmark alignment

Global schema/fixture checks:

```bash
python tools/validate.py
pytest -q
```

Per-run key outputs to inspect:

- `pre_metrics.json`
- `post_metrics.json`
- `pre_post_summary.json`
- `artifact_summary.json`

## Minimum reproducibility fields

- model id and revision/hash
- adapter path and training config
- seed and decode params (`temperature`, `top_p`, `max_new_tokens`)
- dataset source + manifest hash
- pre/post metrics + delta summary
- output artifact hashes
