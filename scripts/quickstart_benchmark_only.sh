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

echo "[benchmark-quickstart] Installing minimal dependencies..."
"$PYTHON_BIN" -m pip install -r requirements-tools.txt >/dev/null

RUN_DIR="experiments/runs/benchmark_only"
mkdir -p "$RUN_DIR"

echo "[benchmark-quickstart] Running benchmark-only mock eval..."
"$PYTHON_BIN" experiments/factory/eval_pre_post.py \
  --tasks benchmarks/tasks/task_specs.json \
  --output-dir "$RUN_DIR" \
  --split all \
  --seed 42 \
  --use-mock \
  --num-samples 5 \
  --answer-mode final_answer_friendly

echo "[benchmark-quickstart] Checking conformance fixtures..."
"$PYTHON_BIN" tools/check_conformance_fixtures.py

echo "[benchmark-quickstart] Adapting local sample output through lm-eval adapter..."
"$PYTHON_BIN" experiments/factory/run_lm_eval_adapter.py \
  --output-dir "$RUN_DIR/adapter"

echo "[benchmark-quickstart] Done. Summary: $RUN_DIR/pre_post_summary.json"
