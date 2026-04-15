#!/usr/bin/env python3
"""Run executable data-governance checks for Open CoT datasets."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


def _normalize(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", str(text).lower()))


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            value = json.loads(line)
            if isinstance(value, dict):
                rows.append(value)
    return rows


def _load_benchmark_prompts(path: Path) -> set[str]:
    if not path.is_file():
        return set()
    data = json.loads(path.read_text(encoding="utf-8"))
    prompts: set[str] = set()
    for task in data.get("tasks", []):
        if isinstance(task, dict):
            prompt = str(task.get("prompt", "")).strip()
            if prompt:
                prompts.add(_normalize(prompt))
    return prompts


def _required_manifest_fields(manifest: dict[str, Any]) -> list[str]:
    required = ["name", "version", "license", "source_url", "owner"]
    missing: list[str] = []
    for field in required:
        if field not in manifest or not str(manifest.get(field, "")).strip():
            missing.append(field)
    return missing


def run_checks(
    *,
    train_jsonl: Path,
    benchmark_task_specs: Path | None,
    manifest_path: Path | None,
) -> dict[str, Any]:
    rows = _read_jsonl(train_jsonl)
    prompts = [str(r.get("task", r.get("instruction", ""))).strip() for r in rows]
    normalized_prompts = [_normalize(p) for p in prompts if p]

    duplicates = len(normalized_prompts) - len(set(normalized_prompts))
    bench_prompts = _load_benchmark_prompts(benchmark_task_specs) if benchmark_task_specs else set()
    contamination_hits = sorted({p for p in normalized_prompts if p in bench_prompts})

    missing_manifest_fields: list[str] = []
    if manifest_path and manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if isinstance(manifest, dict):
            missing_manifest_fields = _required_manifest_fields(manifest)
        else:
            missing_manifest_fields = ["manifest_not_object"]
    elif manifest_path:
        missing_manifest_fields = ["manifest_missing"]

    return {
        "num_rows": len(rows),
        "duplicate_prompt_rows": duplicates,
        "contamination_hits": len(contamination_hits),
        "contamination_examples": contamination_hits[:10],
        "missing_manifest_fields": missing_manifest_fields,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train-jsonl", type=Path, required=True)
    parser.add_argument("--benchmark-task-specs", type=Path, default=None)
    parser.add_argument("--manifest", type=Path, default=None)
    parser.add_argument("--output", type=Path, default=None)
    parser.add_argument("--fail-on-duplicates", action="store_true")
    parser.add_argument("--fail-on-contamination", action="store_true")
    parser.add_argument("--fail-on-missing-provenance", action="store_true")
    args = parser.parse_args()

    report = run_checks(
        train_jsonl=args.train_jsonl,
        benchmark_task_specs=args.benchmark_task_specs,
        manifest_path=args.manifest,
    )
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(report, indent=2))

    failed = False
    if args.fail_on_duplicates and report["duplicate_prompt_rows"] > 0:
        failed = True
    if args.fail_on_contamination and report["contamination_hits"] > 0:
        failed = True
    if args.fail_on_missing_provenance and report["missing_manifest_fields"]:
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
