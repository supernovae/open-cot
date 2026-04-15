#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR=".venv"

if [[ ! -d "$VENV_DIR" ]]; then
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi
PYTHON_BIN="$VENV_DIR/bin/python"

echo "[gpu-quickstart] Installing dependencies..."
"$PYTHON_BIN" -m pip install -r requirements-tools.txt -r requirements-qwen-peft.txt >/dev/null

RUN_ROOT="experiments/runs/gpu_quickstart"
DATA_DIR="$RUN_ROOT/data"
TRAIN_DIR="$RUN_ROOT/train"
EVAL_DIR="$RUN_ROOT/eval"

echo "[gpu-quickstart] Prepare SFT data..."
"$PYTHON_BIN" experiments/factory/prepare_cot_sft.py \
  --input datasets/synthetic/task_bank_v0.jsonl \
  --output-dir "$DATA_DIR" \
  --val-ratio 0.2 \
  --seed 42

echo "[gpu-quickstart] Train PEFT adapter..."
"$PYTHON_BIN" experiments/factory/train_qwen_peft.py \
  --train-file "$DATA_DIR/train.jsonl" \
  --val-file "$DATA_DIR/validation.jsonl" \
  --output-dir "$TRAIN_DIR" \
  --epochs 1 \
  --batch-size 1 \
  --gradient-accumulation-steps 4 \
  --use-4bit

echo "[gpu-quickstart] Evaluate pre/post..."
"$PYTHON_BIN" experiments/factory/eval_pre_post.py \
  --tasks benchmarks/tasks/task_specs.json \
  --output-dir "$EVAL_DIR" \
  --base-model Qwen/Qwen2.5-1.5B-Instruct \
  --adapter-path "$TRAIN_DIR/adapter" \
  --split test \
  --seed 42 \
  --num-samples 3 \
  --answer-mode final_answer_friendly

echo "[gpu-quickstart] Export artifacts..."
"$PYTHON_BIN" experiments/factory/export_artifacts.py \
  --run-dir "$EVAL_DIR" \
  --require-lineage

echo "[gpu-quickstart] Done. Summary: $EVAL_DIR/pre_post_summary.json"
