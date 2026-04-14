from __future__ import annotations

from benchmarks.scoring.scorer import score_trace


def test_final_answer_friendly_mode_extracts_marker() -> None:
    trace = {
        "version": "0.1",
        "task": "Compute 9 * 8.",
        "steps": [{"id": "s1", "type": "thought", "content": "Compute multiplication."}],
        "final_answer": "Reasoning...\nFinal answer: 72",
    }
    strict = score_trace(trace, "72", answer_mode="strict")
    friendly = score_trace(trace, "72", answer_mode="final_answer_friendly")
    assert strict["final_answer_exact"] == 0.0
    assert friendly["final_answer_exact"] == 1.0
