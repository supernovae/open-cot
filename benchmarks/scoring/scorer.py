#!/usr/bin/env python3
"""Starter benchmark scorer for Open CoT 0.1."""

from __future__ import annotations

import argparse
import collections
import json
import math
import re
import sys
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from reference.python.validator import validate_trace  # noqa: E402


def normalize_text(s: str) -> str:
    return " ".join(str(s).strip().split()).lower()


def _tokenize(s: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", normalize_text(s))


def _extract_final_answer(pred: str) -> str:
    text = str(pred).strip()
    low = text.lower()
    marker = "final answer:"
    idx = low.rfind(marker)
    if idx != -1:
        return text[idx + len(marker) :].strip()
    return text


def exact_match(pred: str, gold: str, *, mode: str = "strict") -> float:
    if mode == "final_answer_friendly":
        pred = _extract_final_answer(pred)
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


def step_semantic_proxy(trace: dict[str, Any], expected_final_answer: str) -> float:
    """Lightweight semantic proxy: coverage of expected answer tokens in reasoning steps."""
    steps = trace.get("steps", [])
    if not isinstance(steps, list) or not steps:
        return 0.0
    gold_tokens = _tokenize(expected_final_answer)
    if not gold_tokens:
        return 0.0
    step_text = " ".join(str(step.get("content", "")) for step in steps if isinstance(step, dict))
    step_tokens = set(_tokenize(step_text))
    if not step_tokens:
        return 0.0
    matched = sum(1 for tok in gold_tokens if tok in step_tokens)
    return matched / max(len(gold_tokens), 1)


def _self_consistency_from_candidates(candidates: list[str]) -> float:
    if not candidates:
        return 0.0
    normalized = [normalize_text(c) for c in candidates if str(c).strip()]
    if not normalized:
        return 0.0
    counts = collections.Counter(normalized)
    modal_count = counts.most_common(1)[0][1]
    return modal_count / len(normalized)


def _prediction_entropy(candidates: list[str]) -> float:
    normalized = [normalize_text(c) for c in candidates if str(c).strip()]
    if not normalized:
        return 0.0
    counts = collections.Counter(normalized)
    total = len(normalized)
    probs = [c / total for c in counts.values()]
    return -sum(p * math.log2(p) for p in probs if p > 0)


def verifier_agreement_proxy(trace: dict[str, Any]) -> float:
    votes = trace.get("verifier_votes", [])
    if not isinstance(votes, list) or not votes:
        return 0.0
    normalized: list[str] = []
    for vote in votes:
        if not isinstance(vote, dict):
            continue
        if isinstance(vote.get("correct"), bool):
            normalized.append("true" if vote["correct"] else "false")
        elif isinstance(vote.get("correct"), str):
            normalized.append(vote["correct"].strip().lower())
    if not normalized:
        return 0.0
    counts = collections.Counter(normalized)
    return counts.most_common(1)[0][1] / len(normalized)


def score_trace(
    trace: dict[str, Any],
    expected_final_answer: str,
    *,
    answer_mode: str = "strict",
) -> dict[str, float]:
    validate_trace(trace)
    final = str(trace.get("final_answer", ""))
    candidates = trace.get("candidate_final_answers", [])
    if not isinstance(candidates, list) or not candidates:
        candidates = [final]
    return {
        "final_answer_exact": exact_match(final, expected_final_answer, mode=answer_mode),
        "step_validity_proxy": step_validity_proxy(trace),
        "step_semantic_proxy": step_semantic_proxy(trace, expected_final_answer),
        "self_consistency": _self_consistency_from_candidates([str(c) for c in candidates]),
        "prediction_entropy": _prediction_entropy([str(c) for c in candidates]),
        "verifier_agreement_proxy": verifier_agreement_proxy(trace),
        "schema_valid": 1.0,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--trace", required=True, type=Path, help="Path to one trace JSON")
    parser.add_argument("--expected", required=True, help="Expected final answer")
    parser.add_argument(
        "--answer-mode",
        choices=("strict", "final_answer_friendly"),
        default="strict",
        help="How to compare predicted final answer to expected",
    )
    args = parser.parse_args()

    trace = json.loads(args.trace.read_text(encoding="utf-8"))
    scores = score_trace(trace, args.expected, answer_mode=args.answer_mode)
    print(json.dumps(scores, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
