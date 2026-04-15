#!/usr/bin/env python3
"""Run or ingest lm-eval-harness results and emit Open CoT artifacts."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from benchmarks.scoring.scorer import score_trace  # noqa: E402


def _load_task_specs(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    tasks = data.get("tasks", [])
    by_prompt: dict[str, str] = {}
    if isinstance(tasks, list):
        for task in tasks:
            if not isinstance(task, dict):
                continue
            prompt = str(task.get("prompt", "")).strip()
            expected = str(task.get("expected_final_answer", "")).strip()
            if prompt and expected:
                by_prompt[prompt] = expected
    return by_prompt


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.is_file():
        return rows
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            value = json.loads(line)
            if isinstance(value, dict):
                rows.append(value)
    return rows


def _extract_prompt(sample: dict[str, Any]) -> str:
    doc = sample.get("doc")
    if isinstance(doc, dict):
        for key in ("query", "question", "prompt", "input"):
            v = doc.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()
    for key in ("query", "question", "prompt", "input"):
        v = sample.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def _extract_gold(sample: dict[str, Any]) -> str:
    for key in ("target", "gold", "expected", "answer"):
        v = sample.get(key)
        if isinstance(v, str):
            return v.strip()
    doc = sample.get("doc")
    if isinstance(doc, dict):
        for key in ("target", "answer", "gold"):
            v = doc.get(key)
            if isinstance(v, str):
                return v.strip()
    return ""


def _extract_prediction(sample: dict[str, Any]) -> str:
    if isinstance(sample.get("prediction"), str):
        return str(sample["prediction"]).strip()
    if isinstance(sample.get("pred"), str):
        return str(sample["pred"]).strip()

    resps = sample.get("resps")
    if isinstance(resps, list) and resps:
        first = resps[0]
        if isinstance(first, list) and first:
            return str(first[0]).strip()
        if isinstance(first, str):
            return first.strip()
    return ""


def _to_trace(prompt: str, prediction: str, *, source_task: str) -> dict[str, Any]:
    step_content = prediction or "No model output"
    return {
        "version": "0.1",
        "task": prompt or f"lm-eval sample from {source_task}",
        "steps": [{"id": "s1", "type": "thought", "content": step_content}],
        "final_answer": prediction.strip(),
    }


def _run_lm_eval(
    *,
    output_json: Path,
    samples_jsonl: Path,
    tasks: str,
    model: str,
    model_args: str,
    device: str,
    batch_size: str,
    limit: int,
) -> None:
    cmd = [
        sys.executable,
        "-m",
        "lm_eval",
        "--model",
        model,
        "--model_args",
        model_args,
        "--tasks",
        tasks,
        "--device",
        device,
        "--batch_size",
        batch_size,
        "--output_path",
        str(output_json),
        "--log_samples",
    ]
    if limit > 0:
        cmd += ["--limit", str(limit)]
    subprocess.run(cmd, check=True, cwd=ROOT)

    # lm-eval writes one sample file per task under output dir for some versions.
    # Keep a merged file for deterministic adapter processing.
    merged: list[dict[str, Any]] = []
    output_dir = output_json.parent
    for path in sorted(output_dir.glob("*.jsonl")):
        merged.extend(_read_jsonl(path))
    if merged:
        samples_jsonl.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in merged) + "\n", encoding="utf-8")


def _aggregate(scores: list[dict[str, float]]) -> dict[str, float]:
    if not scores:
        return {
            "num_samples": 0.0,
            "final_answer_exact_avg": 0.0,
            "step_validity_proxy_avg": 0.0,
            "step_semantic_proxy_avg": 0.0,
            "self_consistency_avg": 0.0,
            "schema_valid_rate": 0.0,
        }
    n = float(len(scores))
    return {
        "num_samples": n,
        "final_answer_exact_avg": sum(s["final_answer_exact"] for s in scores) / n,
        "step_validity_proxy_avg": sum(s["step_validity_proxy"] for s in scores) / n,
        "step_semantic_proxy_avg": sum(s["step_semantic_proxy"] for s in scores) / n,
        "self_consistency_avg": sum(s["self_consistency"] for s in scores) / n,
        "schema_valid_rate": sum(s["schema_valid"] for s in scores) / n,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--harness-results-json", type=Path, default=None)
    parser.add_argument("--samples-jsonl", type=Path, default=None)
    parser.add_argument("--task-specs", type=Path, default=ROOT / "benchmarks" / "tasks" / "task_specs.json")
    parser.add_argument("--answer-mode", choices=("strict", "final_answer_friendly"), default="final_answer_friendly")

    parser.add_argument("--run-harness", action="store_true", help="Run lm-eval-harness before adapting outputs")
    parser.add_argument("--tasks", default="gsm8k")
    parser.add_argument("--model", default="hf")
    parser.add_argument("--model-args", default="pretrained=Qwen/Qwen2.5-1.5B-Instruct,dtype=auto")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--batch-size", default="1")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    out_dir = args.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    harness_json = args.harness_results_json or (out_dir / "lm_eval_results.json")
    samples_jsonl = args.samples_jsonl or (out_dir / "lm_eval_samples.jsonl")

    if args.run_harness:
        _run_lm_eval(
            output_json=harness_json,
            samples_jsonl=samples_jsonl,
            tasks=args.tasks,
            model=args.model,
            model_args=args.model_args,
            device=args.device,
            batch_size=args.batch_size,
            limit=args.limit,
        )

    harness_results = {}
    if harness_json.is_file():
        harness_results = json.loads(harness_json.read_text(encoding="utf-8"))
    prompt_to_gold = _load_task_specs(args.task_specs)

    scores: list[dict[str, float]] = []
    traces: list[dict[str, Any]] = []
    sample_rows = _read_jsonl(samples_jsonl)
    for sample in sample_rows:
        prompt = _extract_prompt(sample)
        gold = _extract_gold(sample) or prompt_to_gold.get(prompt, "")
        pred = _extract_prediction(sample)
        task_name = str(sample.get("task_name", "lm_eval"))
        trace = _to_trace(prompt, pred, source_task=task_name)
        traces.append(trace)
        if gold:
            scores.append(score_trace(trace, gold, answer_mode=args.answer_mode))

    traces_path = out_dir / "adapter_traces.jsonl"
    with traces_path.open("w", encoding="utf-8") as f:
        for trace in traces:
            f.write(json.dumps(trace, ensure_ascii=False) + "\n")

    summary = {
        "adapter": "lm_eval_harness",
        "num_samples_in": len(sample_rows),
        "num_scored_samples": len(scores),
        "scored_metrics": _aggregate(scores),
        "harness_summary": harness_results.get("results", {}),
        "files": {
            "harness_results_json": str(harness_json) if harness_json.is_file() else None,
            "samples_jsonl": str(samples_jsonl) if samples_jsonl.is_file() else None,
            "traces_jsonl": str(traces_path),
        },
    }
    summary_path = out_dir / "adapter_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
