from __future__ import annotations

import json
from pathlib import Path


def test_reference_run_artifacts_present() -> None:
    root = Path(__file__).resolve().parents[1] / "experiments" / "reference_run"
    required = ["config.json", "prompts.jsonl", "outputs.jsonl", "metrics.json", "hashes.txt"]
    for name in required:
        assert (root / name).is_file(), f"missing {name}"


def test_reference_run_metrics_shape() -> None:
    path = Path(__file__).resolve().parents[1] / "experiments" / "reference_run" / "metrics.json"
    metrics = json.loads(path.read_text(encoding="utf-8"))
    assert metrics["schema_validity_rate"] >= 0.0
    assert metrics["benchmark"]["num_tasks"] > 0
