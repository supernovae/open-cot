from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from benchmarks.scoring.scorer import score_trace  # noqa: E402


def test_benchmark_scorer_exact_match() -> None:
    trace = {
        "version": "0.1",
        "task": "Compute 9 * 8.",
        "steps": [{"id": "s1", "type": "calculation", "content": "9 * 8 = 72"}],
        "final_answer": "72",
    }
    scores = score_trace(trace, "72")
    assert scores["schema_valid"] == 1.0
    assert scores["final_answer_exact"] == 1.0
    assert scores["step_validity_proxy"] > 0.0


def test_task_specs_exist() -> None:
    path = Path(__file__).resolve().parents[1] / "benchmarks" / "tasks" / "task_specs.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["tasks"]
