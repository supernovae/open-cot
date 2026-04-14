#!/usr/bin/env python3
"""Generate a deterministic Open CoT seed task bank."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def build_traces() -> list[dict[str, Any]]:
    return [
        {
            "version": "0.1",
            "task": "What is 27 + 15?",
            "steps": [
                {"id": "s1", "type": "thought", "content": "Add tens and ones separately."},
                {"id": "s2", "type": "calculation", "content": "20 + 10 = 30", "parent": "s1"},
                {"id": "s3", "type": "calculation", "content": "7 + 5 = 12", "parent": "s1"},
                {"id": "s4", "type": "thought", "content": "30 + 12 = 42", "parent": "s1"},
            ],
            "final_answer": "42",
        },
        {
            "version": "0.1",
            "task": "Reverse the string 'open-cot'.",
            "steps": [
                {"id": "s1", "type": "thought", "content": "Read characters from right to left."},
                {"id": "s2", "type": "code", "content": "'open-cot'[::-1] -> 'toc-nepo'", "parent": "s1"},
            ],
            "final_answer": "toc-nepo",
        },
        {
            "version": "0.1",
            "task": "Plan three steps to prepare tea.",
            "steps": [
                {"id": "s1", "type": "subgoal", "content": "Boil water."},
                {"id": "s2", "type": "subgoal", "content": "Steep tea leaves in hot water.", "parent": "s1"},
                {"id": "s3", "type": "subgoal", "content": "Pour and serve.", "parent": "s2"},
            ],
            "final_answer": "1) Boil water 2) Steep leaves 3) Pour and serve",
        },
        {
            "version": "0.1",
            "task": "Compute 9 * 8.",
            "steps": [
                {"id": "s1", "type": "thought", "content": "Use multiplication fact."},
                {"id": "s2", "type": "calculation", "content": "9 * 8 = 72", "parent": "s1"},
            ],
            "final_answer": "72",
        },
        {
            "version": "0.1",
            "task": "Identify the first prime number greater than 10.",
            "steps": [
                {"id": "s1", "type": "thought", "content": "Check numbers 11, 12, 13 in order."},
                {"id": "s2", "type": "thought", "content": "11 has no divisors except 1 and 11.", "parent": "s1"},
            ],
            "final_answer": "11",
        },
    ]


def main() -> int:
    out_path = Path(__file__).resolve().parent / "task_bank_v0.jsonl"
    traces = build_traces()
    with out_path.open("w", encoding="utf-8") as f:
        for trace in traces:
            f.write(json.dumps(trace, ensure_ascii=False) + "\n")
    print(f"Wrote {len(traces)} traces to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
