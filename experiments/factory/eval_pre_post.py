#!/usr/bin/env python3
"""Evaluate pre/post model outputs and produce Open CoT-compatible metrics."""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from benchmarks.scoring.scorer import score_trace
from reference.python.validator import validate_trace


def _load_task_specs(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    tasks = data.get("tasks", [])
    if not isinstance(tasks, list):
        return []
    return [t for t in tasks if isinstance(t, dict)]


def _mock_generate(prompt: str) -> str:
    p = prompt.lower()
    if "27 + 15" in p:
        return "42"
    if "reverse the string 'open-cot'" in p:
        return "toc-nepo"
    if "prepare tea" in p:
        return "1) Boil water 2) Steep leaves 3) Pour and serve"
    if "9 * 8" in p:
        return "72"
    return "mock-answer"


def _hf_generate(prompts: list[str], model_name_or_path: str, max_new_tokens: int) -> list[str]:
    from transformers import AutoModelForCausalLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(model_name_or_path)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(model_name_or_path, device_map="auto", torch_dtype="auto")
    outs: list[str] = []
    for prompt in prompts:
        text = tokenizer.apply_chat_template(
            [{"role": "user", "content": prompt}],
            tokenize=False,
            add_generation_prompt=True,
        )
        model_inputs = tokenizer([text], return_tensors="pt").to(model.device)
        generated_ids = model.generate(**model_inputs, max_new_tokens=max_new_tokens)
        trimmed = generated_ids[0][len(model_inputs.input_ids[0]) :]
        outs.append(tokenizer.decode(trimmed, skip_special_tokens=True).strip())
    return outs


def _to_trace(prompt: str, output: str) -> dict[str, Any]:
    return {
        "version": "0.1",
        "task": prompt,
        "steps": [{"id": "s1", "type": "thought", "content": output or "No output"}],
        "final_answer": output.strip(),
    }


def _aggregate(scores: list[dict[str, float]], schema_validity_rate: float) -> dict[str, float]:
    if not scores:
        return {
            "final_answer_exact_avg": 0.0,
            "step_validity_proxy_avg": 0.0,
            "schema_validity_rate": schema_validity_rate,
            "num_tasks": 0,
            "final_answer_exact_stddev": 0.0,
        }
    exacts = [s["final_answer_exact"] for s in scores]
    steps = [s["step_validity_proxy"] for s in scores]
    return {
        "final_answer_exact_avg": sum(exacts) / len(exacts),
        "step_validity_proxy_avg": sum(steps) / len(steps),
        "schema_validity_rate": schema_validity_rate,
        "num_tasks": len(scores),
        "final_answer_exact_stddev": statistics.pstdev(exacts) if len(exacts) > 1 else 0.0,
    }


def run_eval(
    tasks_path: Path,
    out_dir: Path,
    *,
    model_name_or_path: str | None,
    max_new_tokens: int,
    use_mock: bool,
    label: str,
) -> dict[str, Any]:
    tasks = _load_task_specs(tasks_path)
    prompts = [str(t.get("prompt", "")) for t in tasks]
    expected = [str(t.get("expected_final_answer", "")) for t in tasks]
    if use_mock:
        outputs = [_mock_generate(p) for p in prompts]
    else:
        if not model_name_or_path:
            raise RuntimeError("model_name_or_path is required when --use-mock is not set")
        outputs = _hf_generate(prompts, model_name_or_path, max_new_tokens)

    traces: list[dict[str, Any]] = []
    scores: list[dict[str, float]] = []
    schema_valid_count = 0
    for prompt, pred, gold in zip(prompts, outputs, expected):
        trace = _to_trace(prompt, pred)
        traces.append(trace)
        try:
            validate_trace(trace)
            schema_valid_count += 1
        except Exception:
            pass
        scores.append(score_trace(trace, gold))

    out_dir.mkdir(parents=True, exist_ok=True)
    traces_path = out_dir / f"{label}_traces.jsonl"
    with traces_path.open("w", encoding="utf-8") as f:
        for trace in traces:
            f.write(json.dumps(trace, ensure_ascii=False) + "\n")
    metrics = _aggregate(scores, schema_valid_count / max(len(traces), 1))
    metrics_path = out_dir / f"{label}_metrics.json"
    metrics_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    return {"traces_path": str(traces_path), "metrics_path": str(metrics_path), "metrics": metrics}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tasks", type=Path, default=ROOT / "benchmarks" / "tasks" / "task_specs.json")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-1.5B-Instruct")
    parser.add_argument("--adapter-path", default="", help="Optional adapter path for post run")
    parser.add_argument("--max-new-tokens", type=int, default=128)
    parser.add_argument("--use-mock", action="store_true", help="Use deterministic mock generation for tests")
    args = parser.parse_args()

    pre = run_eval(
        args.tasks,
        args.output_dir,
        model_name_or_path=args.base_model,
        max_new_tokens=args.max_new_tokens,
        use_mock=args.use_mock,
        label="pre",
    )

    post_model = args.adapter_path or args.base_model
    post = run_eval(
        args.tasks,
        args.output_dir,
        model_name_or_path=post_model,
        max_new_tokens=args.max_new_tokens,
        use_mock=args.use_mock,
        label="post",
    )

    delta = {
        "delta_final_answer_exact": post["metrics"]["final_answer_exact_avg"] - pre["metrics"]["final_answer_exact_avg"],
        "delta_step_validity_proxy": post["metrics"]["step_validity_proxy_avg"] - pre["metrics"]["step_validity_proxy_avg"],
        "delta_schema_validity_rate": post["metrics"]["schema_validity_rate"] - pre["metrics"]["schema_validity_rate"],
    }
    summary = {
        "pre": pre,
        "post": post,
        "delta": delta,
    }
    (args.output_dir / "pre_post_summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
