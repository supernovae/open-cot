#!/usr/bin/env python3
"""Prepare Open CoT reasoning traces for SFT fine-tuning."""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from experiments.factory.lineage import get_git_commit, sha256_file, utc_now_iso, write_json  # noqa: E402


def _trace_to_record(trace: dict[str, Any], include_steps: bool = True) -> dict[str, str]:
    task = str(trace.get("task", "")).strip()
    final_answer = str(trace.get("final_answer", "")).strip()
    steps = trace.get("steps", [])
    reasoning_lines: list[str] = []
    if include_steps and isinstance(steps, list):
        for idx, step in enumerate(steps, start=1):
            if not isinstance(step, dict):
                continue
            text = str(step.get("content", "")).strip()
            if text:
                reasoning_lines.append(f"{idx}. {text}")
    reasoning_text = "\n".join(reasoning_lines)
    assistant = final_answer
    if reasoning_text:
        assistant = f"{reasoning_text}\n\nFinal answer: {final_answer}"
    return {
        "instruction": task,
        "response": assistant,
        "text": f"### Instruction:\n{task}\n\n### Response:\n{assistant}",
    }


def load_traces(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            if isinstance(data, dict):
                rows.append(data)
    return rows


def write_jsonl(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Input RFC0001 trace JSONL")
    parser.add_argument("--output-dir", type=Path, required=True, help="Output directory for train/val JSONL")
    parser.add_argument("--val-ratio", type=float, default=0.2, help="Validation ratio")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument(
        "--exclude-steps", action="store_true", help="Do not include step-by-step rationale in response"
    )
    args = parser.parse_args()

    traces = load_traces(args.input)
    records = [_trace_to_record(t, include_steps=not args.exclude_steps) for t in traces]
    rng = random.Random(args.seed)  # noqa: S311
    rng.shuffle(records)

    val_count = int(len(records) * args.val_ratio)
    val = records[:val_count]
    train = records[val_count:]

    write_jsonl(args.output_dir / "train.jsonl", train)
    write_jsonl(args.output_dir / "validation.jsonl", val)

    manifest = {
        "source": str(args.input),
        "source_sha256": sha256_file(args.input),
        "train_rows": len(train),
        "validation_rows": len(val),
        "seed": args.seed,
        "val_ratio": args.val_ratio,
        "generated_at_utc": utc_now_iso(),
        "git_commit": get_git_commit(ROOT),
    }
    write_json(args.output_dir / "manifest.json", manifest)
    write_json(
        args.output_dir / "lineage_prepare.json",
        {
            "stage": "prepare_cot_sft",
            "source_trace_jsonl": str(args.input),
            "source_trace_sha256": manifest["source_sha256"],
            "outputs": {
                "train_jsonl": str(args.output_dir / "train.jsonl"),
                "validation_jsonl": str(args.output_dir / "validation.jsonl"),
            },
            "parameters": {
                "seed": args.seed,
                "val_ratio": args.val_ratio,
                "exclude_steps": bool(args.exclude_steps),
            },
            "generated_at_utc": manifest["generated_at_utc"],
            "git_commit": manifest["git_commit"],
        },
    )
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
