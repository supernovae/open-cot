#!/usr/bin/env python3
"""Ingest permissive-license external JSONL into Open CoT RFC0001 traces."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from reference.python.validator import validate_trace  # noqa: E402

ALLOWED_LICENSES = {"MIT", "Apache-2.0", "CC-BY-4.0"}

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b")
SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _normalize_text(s: Any) -> str:
    return " ".join(str(s or "").strip().split())


def _fingerprint_trace(trace: dict[str, Any]) -> str:
    task = _normalize_text(trace.get("task", ""))
    answer = _normalize_text(trace.get("final_answer", ""))
    return hashlib.sha256(f"{task}\n{answer}".encode("utf-8")).hexdigest()


def _has_sensitive_text(text: str) -> bool:
    return bool(EMAIL_RE.search(text) or PHONE_RE.search(text) or SSN_RE.search(text))


def _row_to_trace(row: dict[str, Any], row_idx: int) -> dict[str, Any]:
    task = _normalize_text(row.get("task") or row.get("question") or row.get("prompt"))
    answer = _normalize_text(row.get("final_answer") or row.get("answer") or row.get("output"))
    rationale = _normalize_text(row.get("rationale") or row.get("reasoning") or "")
    if not task or not answer:
        raise ValueError(f"row {row_idx}: missing task/question or answer")
    steps: list[dict[str, Any]] = []
    if rationale:
        steps.append({"id": "s1", "type": "thought", "content": rationale})
    else:
        steps.append({"id": "s1", "type": "thought", "content": "Solve the task and provide a final answer."})
    return {"version": "0.1", "task": task, "steps": steps, "final_answer": answer}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-jsonl", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--dataset-name", required=True)
    parser.add_argument("--license", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--owner", required=True)
    parser.add_argument("--split", choices=("train", "validation", "test"), default="train")
    parser.add_argument("--max-rows", type=int, default=0, help="0 means no limit")
    args = parser.parse_args()

    if args.license not in ALLOWED_LICENSES:
        raise SystemExit(f"Blocked license '{args.license}'. Allowed: {sorted(ALLOWED_LICENSES)}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    traces_path = args.output_dir / "traces.jsonl"
    invalid_path = args.output_dir / "rejected_rows.jsonl"

    kept = 0
    rejected = 0
    pii_rejections = 0
    invalid_rejections = 0
    duplicate_rejections = 0
    seen_fingerprints: set[str] = set()
    with (
        args.input_jsonl.open(encoding="utf-8") as src,
        traces_path.open("w", encoding="utf-8") as out,
        invalid_path.open("w", encoding="utf-8") as rej,
    ):
        for idx, line in enumerate(src, start=1):
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            if not isinstance(row, dict):
                rejected += 1
                invalid_rejections += 1
                rej.write(json.dumps({"row": idx, "reason": "not_object"}) + "\n")
                continue
            try:
                trace = _row_to_trace(row, idx)
            except Exception as e:
                rejected += 1
                invalid_rejections += 1
                rej.write(json.dumps({"row": idx, "reason": f"mapping_error:{e}"}) + "\n")
                continue

            if _has_sensitive_text(trace["task"]) or _has_sensitive_text(trace["final_answer"]):
                rejected += 1
                pii_rejections += 1
                rej.write(json.dumps({"row": idx, "reason": "pii_filter"}) + "\n")
                continue

            try:
                validate_trace(trace)
            except Exception as e:
                rejected += 1
                invalid_rejections += 1
                rej.write(json.dumps({"row": idx, "reason": f"schema_invalid:{e}"}) + "\n")
                continue

            fingerprint = _fingerprint_trace(trace)
            if fingerprint in seen_fingerprints:
                rejected += 1
                duplicate_rejections += 1
                rej.write(json.dumps({"row": idx, "reason": "duplicate_trace"}) + "\n")
                continue
            seen_fingerprints.add(fingerprint)

            out.write(json.dumps(trace, ensure_ascii=False) + "\n")
            kept += 1
            if args.max_rows and kept >= args.max_rows:
                break

    manifest = {
        "name": args.dataset_name,
        "version": "0.1.0",
        "schema_target": "schemas/rfc-0001-reasoning.json",
        "registry_shortname": "reasoning",
        "license": args.license,
        "source_url": args.source_url,
        "owner": args.owner,
        "split": args.split,
        "counts": {"kept": kept, "rejected": rejected},
        "filters": {
            "pii_rejections": pii_rejections,
            "invalid_rejections": invalid_rejections,
            "duplicate_rejections": duplicate_rejections,
        },
        "input_sha256": _sha256(args.input_jsonl),
        "provenance_fields_present": True,
    }
    (args.output_dir / "dataset_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
