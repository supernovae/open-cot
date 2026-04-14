#!/usr/bin/env python3
"""Starter benchmark scorer for Open CoT 0.1."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from reference.python.validator import validate_trace


def normalize_text(s: str) -> str:
    return " ".join(str(s).strip().split()).lower()


def exact_match(pred: str, gold: str) -> float:
    return 1.0 if normalize_text(pred) == normalize_text(gold) else 0.0


def step_validity_proxy(trace: dict[str, Any]) -> float:
    steps = trace.get("steps", [])
    if not isinstance(steps, list) or not steps:
        return 0.0
    valid = 0
    for step in steps:
        if not isinstance(step, dict):
            continue
        if all(k in step for k in ("id", "type", "content")):
            valid += 1
    return valid / max(len(steps), 1)


def score_trace(trace: dict[str, Any], expected_final_answer: str) -> dict[str, float]:
    validate_trace(trace)
    final = str(trace.get("final_answer", ""))
    return {
        "final_answer_exact": exact_match(final, expected_final_answer),
        "step_validity_proxy": step_validity_proxy(trace),
        "schema_valid": 1.0,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--trace", required=True, type=Path, help="Path to one trace JSON")
    parser.add_argument("--expected", required=True, help="Expected final answer")
    args = parser.parse_args()

    trace = json.loads(args.trace.read_text(encoding="utf-8"))
    scores = score_trace(trace, args.expected)
    print(json.dumps(scores, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
