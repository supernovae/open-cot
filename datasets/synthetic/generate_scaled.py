#!/usr/bin/env python3
"""Generate a larger deterministic synthetic task bank (phase-1 scale-up)."""

from __future__ import annotations

import json
from pathlib import Path


def build_scaled_traces() -> list[dict[str, object]]:
    traces: list[dict[str, object]] = []

    # Math tier
    for i in range(1, 21):
        a = 10 + i
        b = 3 * i
        ans = a + b
        traces.append(
            {
                "version": "0.1",
                "task": f"What is {a} + {b}?",
                "steps": [
                    {"id": "s1", "type": "thought", "content": "Add the two integers directly."},
                    {"id": "s2", "type": "calculation", "content": f"{a} + {b} = {ans}", "parent": "s1"},
                ],
                "final_answer": str(ans),
            }
        )

    # String/code tier
    words = ["open-cot", "reasoning", "schema", "benchmark", "validator", "trace", "agent", "memory", "policy", "budget"]
    for idx, word in enumerate(words, start=1):
        rev = word[::-1]
        traces.append(
            {
                "version": "0.1",
                "task": f"Reverse the string '{word}'.",
                "steps": [
                    {"id": "s1", "type": "thought", "content": "Read characters from right to left."},
                    {"id": "s2", "type": "code", "content": f"'{word}'[::-1] -> '{rev}'", "parent": "s1"},
                ],
                "final_answer": rev,
            }
        )

    # Planning tier
    topics = [
        "prepare tea",
        "write a bug report",
        "run schema validation",
        "publish a release",
        "onboard a contributor",
        "review an RFC",
        "triage experiment feedback",
        "configure a benchmark run",
        "package a dataset",
        "debug tool failure",
        "audit policy constraints",
        "compare model outputs",
        "document migration notes",
        "set token budget controls",
        "summarize benchmark findings",
        "prepare HF model card",
        "check data licenses",
        "create a release changelog",
        "run pre/post eval",
        "collect community feedback",
    ]
    for topic in topics:
        traces.append(
            {
                "version": "0.1",
                "task": f"Plan three steps to {topic}.",
                "steps": [
                    {"id": "s1", "type": "subgoal", "content": f"Define objective for {topic}."},
                    {"id": "s2", "type": "subgoal", "content": "Execute the core actions in order.", "parent": "s1"},
                    {"id": "s3", "type": "subgoal", "content": "Verify outcome and log results.", "parent": "s2"},
                ],
                "final_answer": "1) Define objective 2) Execute actions 3) Verify and log",
            }
        )

    return traces


def main() -> int:
    out_path = Path(__file__).resolve().parent / "task_bank_v1_large.jsonl"
    traces = build_scaled_traces()
    with out_path.open("w", encoding="utf-8") as f:
        for trace in traces:
            f.write(json.dumps(trace, ensure_ascii=False) + "\n")
    print(f"Wrote {len(traces)} traces to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
