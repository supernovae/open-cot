from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from reference.python.cognitive_pipeline_runner import run_mock_cognitive_pipeline  # noqa: E402
from reference.python.validator import validate_trace  # noqa: E402


def test_mock_cognitive_pipeline_trace_validates() -> None:
    task = "Find the population of Tokyo and compute its square root."
    trace, verifier_output = run_mock_cognitive_pipeline(task)
    validate_trace(trace)
    assert verifier_output["version"] == "0.1"
    assert trace["final_answer"]
    assert any(step["type"] == "observation" for step in trace["steps"])
