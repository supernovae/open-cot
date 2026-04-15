#!/usr/bin/env python3
"""Scan prompt-bearing dataset/task files for PII using Microsoft Presidio."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider

PROMPT_KEYWORDS = (
    "prompt",
    "task",
    "question",
    "instruction",
    "input",
    "user_prompt",
    "system_prompt",
)

DEFAULT_GLOBS = (
    "datasets/**/*.json",
    "datasets/**/*.jsonl",
    "benchmarks/**/*.json",
    "experiments/**/*.jsonl",
)

# Keep entity set narrow to reduce false positives while still catching sensitive prompt data.
DEFAULT_ENTITIES = (
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "US_SSN",
    "CREDIT_CARD",
    "IBAN_CODE",
    "IP_ADDRESS",
    "US_PASSPORT",
    "US_DRIVER_LICENSE",
)


def _build_analyzer(model_name: str) -> AnalyzerEngine:
    provider = NlpEngineProvider(
        nlp_configuration={
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "en", "model_name": model_name}],
        }
    )
    nlp_engine = provider.create_engine()
    return AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=["en"])


def _collect_files(repo_root: Path, globs: tuple[str, ...]) -> list[Path]:
    files: set[Path] = set()
    for pattern in globs:
        files.update(path for path in repo_root.glob(pattern) if path.is_file())
    return sorted(files)


def _extract_prompt_strings(value: Any, *, key_context: str | None = None) -> list[str]:
    out: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_key = str(key).lower()
            if any(token in child_key for token in PROMPT_KEYWORDS):
                out.extend(_extract_prompt_strings(child, key_context=child_key))
            else:
                out.extend(_extract_prompt_strings(child, key_context=key_context))
        return out
    if isinstance(value, list):
        for child in value:
            out.extend(_extract_prompt_strings(child, key_context=key_context))
        return out
    if isinstance(value, str) and key_context:
        text = value.strip()
        if text:
            out.append(text)
    return out


def _mask_span(text: str, start: int, end: int) -> str:
    start = max(start, 0)
    end = min(end, len(text))
    if start >= end:
        return text[:120]
    return (text[:start] + "[REDACTED]" + text[end:])[:200]


def _scan_file(
    path: Path,
    analyzer: AnalyzerEngine,
    entities: tuple[str, ...],
    score_threshold: float,
) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    texts_to_scan: list[str] = []
    if path.suffix == ".jsonl":
        with path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                texts_to_scan.extend(_extract_prompt_strings(obj))
    elif path.suffix == ".json":
        try:
            obj = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return findings
        texts_to_scan.extend(_extract_prompt_strings(obj))

    for text in texts_to_scan:
        for result in analyzer.analyze(
            text=text,
            entities=list(entities),
            language="en",
            score_threshold=score_threshold,
        ):
            findings.append(
                {
                    "file": str(path),
                    "entity": result.entity_type,
                    "score": round(float(result.score), 4),
                    "sample": _mask_span(text, result.start, result.end),
                }
            )
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--glob", action="append", default=[])
    parser.add_argument("--model-name", default="en_core_web_sm")
    parser.add_argument("--score-threshold", type=float, default=0.7)
    args = parser.parse_args()

    globs = tuple(args.glob) if args.glob else DEFAULT_GLOBS
    analyzer = _build_analyzer(args.model_name)
    files = _collect_files(args.repo_root, globs)

    all_findings: list[dict[str, Any]] = []
    for path in files:
        all_findings.extend(_scan_file(path, analyzer, DEFAULT_ENTITIES, args.score_threshold))

    if all_findings:
        print("PII findings detected in prompt-bearing files:")
        for finding in all_findings:
            rel = Path(finding["file"]).resolve().relative_to(args.repo_root.resolve())
            print(
                f"::error file={rel}::PII entity={finding['entity']} score={finding['score']} sample={finding['sample']}"
            )
        print(f"\nTotal findings: {len(all_findings)}")
        return 1

    print(f"No PII findings detected across {len(files)} scanned files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
