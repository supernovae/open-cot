#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR=".venv"

if [[ ! -d "$VENV_DIR" ]]; then
  echo "[quickstart] Creating virtual environment at $VENV_DIR..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

PYTHON_BIN="$VENV_DIR/bin/python"

echo "[quickstart] Installing minimal dependencies..."
"$PYTHON_BIN" -m pip install -r requirements-tools.txt >/dev/null
RUN_DIR="experiments/runs/quickstart"
DATA_DIR="experiments/data/quickstart_sft"

echo "[quickstart] Preparing SFT data..."
"$PYTHON_BIN" experiments/factory/prepare_cot_sft.py \
  --input datasets/synthetic/task_bank_v0.jsonl \
  --output-dir "$DATA_DIR" \
  --val-ratio 0.2 \
  --seed 42

echo "[quickstart] Running pre/post eval with mock generator..."
"$PYTHON_BIN" experiments/factory/eval_pre_post.py \
  --tasks benchmarks/tasks/task_specs.json \
  --output-dir "$RUN_DIR" \
  --split test \
  --seed 42 \
  --use-mock

echo "[quickstart] Validating schemas/examples..."
"$PYTHON_BIN" tools/validate.py

echo "[quickstart] Exporting artifact hashes..."
"$PYTHON_BIN" experiments/factory/export_artifacts.py \
  --run-dir "$RUN_DIR"

echo "[quickstart] Complete."
echo "Outputs:"
echo "  - $RUN_DIR/pre_post_summary.json"
echo "  - $RUN_DIR/artifact_summary.json"
