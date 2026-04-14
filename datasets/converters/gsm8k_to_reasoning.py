#!/usr/bin/env python3
"""Convert simple GSM8K-like JSONL records into Open CoT reasoning traces.

Expected input fields per JSON line:
  - question (required)
  - answer (required)
  - rationale (optional)
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def convert_record(record: dict[str, Any], idx: int) -> dict[str, Any]:
    question = str(record.get("question", "")).strip()
    answer = str(record.get("answer", "")).strip()
    rationale = str(record.get("rationale", "")).strip()
    if not question or not answer:
        raise ValueError(f"record {idx}: missing question or answer")

    steps: list[dict[str, Any]] = []
    if rationale:
        steps.append(
            {
                "id": "s1",
                "type": "thought",
                "content": rationale,
            }
        )
    else:
        steps.append(
            {
                "id": "s1",
                "type": "thought",
                "content": "Solve the problem step by step.",
            }
        )

    return {
        "version": "0.1",
        "task": question,
        "steps": steps,
        "final_answer": answer,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Input JSONL path")
    parser.add_argument("--output", required=True, type=Path, help="Output JSONL path")
    args = parser.parse_args()

    out_rows: list[dict[str, Any]] = []
    with args.input.open(encoding="utf-8") as f:
        for i, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            out_rows.append(convert_record(record, i))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        for row in out_rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"Converted {len(out_rows)} records to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
