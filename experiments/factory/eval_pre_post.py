#!/usr/bin/env python3
"""Evaluate pre/post model outputs and produce Open CoT-compatible metrics."""

from __future__ import annotations

import argparse
import json
import random
import statistics
import sys
from contextlib import suppress
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from benchmarks.scoring.scorer import score_trace  # noqa: E402
from experiments.factory.lineage import get_git_commit, sha256_file, utc_now_iso, write_json  # noqa: E402
from experiments.factory.safety_policy import apply_runtime_policy  # noqa: E402
from reference.python.validator import validate_trace  # noqa: E402


def _load_task_specs(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    tasks = data.get("tasks", [])
    if not isinstance(tasks, list):
        return []
    return [t for t in tasks if isinstance(t, dict)]


def _filter_tasks(tasks: list[dict[str, Any]], split: str) -> list[dict[str, Any]]:
    if split == "all":
        return tasks
    return [t for t in tasks if str(t.get("split", "")).lower() == split.lower()]


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


def _mock_generate_candidates(prompt: str, num_samples: int) -> list[str]:
    base = _mock_generate(prompt)
    if num_samples <= 1:
        return [base]
    # Deterministic variability for self-consistency metrics in smoke tests.
    variants = [base]
    p = prompt.lower()
    if "27 + 15" in p:
        variants += ["42", "41", "42", "42"]
    elif "9 * 8" in p:
        variants += ["72", "70", "72", "72"]
    elif "reverse the string 'open-cot'" in p:
        variants += ["toc-nepo", "tac-nepo", "toc-nepo"]
    else:
        variants += [base] * 4
    return variants[:num_samples]


def _load_hf_model_and_tokenizer(base_model: str, adapter_path: str | None) -> tuple[Any, Any]:
    from transformers import AutoModelForCausalLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(base_model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(base_model, device_map="auto", torch_dtype="auto")
    if adapter_path:
        from peft import PeftModel

        model = PeftModel.from_pretrained(model, adapter_path)
    return model, tokenizer


def _hf_generate(
    prompts: list[str],
    *,
    base_model: str,
    adapter_path: str | None,
    max_new_tokens: int,
    seed: int,
    do_sample: bool,
) -> list[str]:
    import torch

    random.seed(seed)
    with suppress(ImportError):
        import numpy as np  # type: ignore

        np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

    model, tokenizer = _load_hf_model_and_tokenizer(base_model, adapter_path)
    outs: list[str] = []
    for prompt in prompts:
        text = tokenizer.apply_chat_template(
            [{"role": "user", "content": prompt}],
            tokenize=False,
            add_generation_prompt=True,
        )
        model_inputs = tokenizer([text], return_tensors="pt").to(model.device)
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=max_new_tokens,
            do_sample=do_sample,
            temperature=0.7 if do_sample else 0.0,
            top_p=1.0,
        )
        trimmed = generated_ids[0][len(model_inputs.input_ids[0]) :]
        outs.append(tokenizer.decode(trimmed, skip_special_tokens=True).strip())
    return outs


def _to_trace(prompt: str, output: str, candidates: list[str]) -> dict[str, Any]:
    return {
        "version": "0.1",
        "task": prompt,
        "steps": [{"id": "s1", "type": "thought", "content": output or "No output"}],
        "final_answer": output.strip(),
        "candidate_final_answers": candidates,
    }


def _aggregate(scores: list[dict[str, float]], schema_validity_rate: float) -> dict[str, float]:
    if not scores:
        return {
            "final_answer_exact_avg": 0.0,
            "step_validity_proxy_avg": 0.0,
            "step_semantic_proxy_avg": 0.0,
            "self_consistency_avg": 0.0,
            "prediction_entropy_avg": 0.0,
            "verifier_agreement_proxy_avg": 0.0,
            "schema_validity_rate": schema_validity_rate,
            "num_tasks": 0,
            "final_answer_exact_stddev": 0.0,
        }
    exacts = [s["final_answer_exact"] for s in scores]
    steps = [s["step_validity_proxy"] for s in scores]
    step_semantics = [s["step_semantic_proxy"] for s in scores]
    consistency = [s["self_consistency"] for s in scores]
    entropy = [s["prediction_entropy"] for s in scores]
    verifier_agreement = [s["verifier_agreement_proxy"] for s in scores]
    return {
        "final_answer_exact_avg": sum(exacts) / len(exacts),
        "step_validity_proxy_avg": sum(steps) / len(steps),
        "step_semantic_proxy_avg": sum(step_semantics) / len(step_semantics),
        "self_consistency_avg": sum(consistency) / len(consistency),
        "prediction_entropy_avg": sum(entropy) / len(entropy),
        "verifier_agreement_proxy_avg": sum(verifier_agreement) / len(verifier_agreement),
        "schema_validity_rate": schema_validity_rate,
        "num_tasks": len(scores),
        "final_answer_exact_stddev": statistics.pstdev(exacts) if len(exacts) > 1 else 0.0,
    }


def run_eval(
    tasks_path: Path,
    out_dir: Path,
    *,
    base_model: str | None,
    adapter_path: str | None,
    max_new_tokens: int,
    seed: int,
    use_mock: bool,
    split: str,
    answer_mode: str,
    num_samples: int,
    max_steps: int,
    max_final_answer_chars: int,
    redact_pii: bool,
    deny_tool_patterns: tuple[str, ...],
    label: str,
) -> dict[str, Any]:
    try:
        from jsonschema import ValidationError as JsonSchemaValidationError
    except ImportError:  # pragma: no cover
        JsonSchemaValidationError = ValueError  # type: ignore[assignment]

    tasks = _filter_tasks(_load_task_specs(tasks_path), split)
    prompts = [str(t.get("prompt", "")) for t in tasks]
    expected = [str(t.get("expected_final_answer", "")) for t in tasks]
    if use_mock:
        candidate_outputs = [_mock_generate_candidates(p, num_samples) for p in prompts]
    else:
        if not base_model:
            raise RuntimeError("base_model is required when --use-mock is not set")
        if num_samples <= 1:
            candidate_outputs = [
                _hf_generate(
                    [prompt],
                    base_model=base_model,
                    adapter_path=adapter_path,
                    max_new_tokens=max_new_tokens,
                    seed=seed,
                    do_sample=False,
                )
                for prompt in prompts
            ]
        else:
            candidate_outputs = []
            for prompt in prompts:
                samples_for_prompt: list[str] = []
                for sample_idx in range(num_samples):
                    generated = _hf_generate(
                        [prompt],
                        base_model=base_model,
                        adapter_path=adapter_path,
                        max_new_tokens=max_new_tokens,
                        seed=seed + sample_idx,
                        do_sample=True,
                    )
                    samples_for_prompt.extend(generated)
                candidate_outputs.append(samples_for_prompt)

    traces: list[dict[str, Any]] = []
    scores: list[dict[str, float]] = []
    audit_events: list[dict[str, Any]] = []
    schema_valid_count = 0
    for row_idx, (prompt, candidates, gold) in enumerate(zip(prompts, candidate_outputs, expected, strict=True), start=1):
        pred = candidates[0] if candidates else ""
        trace = _to_trace(prompt, pred, candidates)
        trace, trace_events = apply_runtime_policy(
            trace,
            max_steps=max_steps,
            max_final_answer_chars=max_final_answer_chars,
            redact_pii=redact_pii,
            deny_tool_patterns=deny_tool_patterns,
        )
        traces.append(trace)
        for event in trace_events:
            audit_events.append({"label": label, "row": row_idx, "task": prompt, **event})
        with suppress(JsonSchemaValidationError):
            validate_trace(trace)
            schema_valid_count += 1
        scores.append(score_trace(trace, gold, answer_mode=answer_mode))

    out_dir.mkdir(parents=True, exist_ok=True)
    traces_path = out_dir / f"{label}_traces.jsonl"
    with traces_path.open("w", encoding="utf-8") as f:
        for trace in traces:
            f.write(json.dumps(trace, ensure_ascii=False) + "\n")
    metrics = _aggregate(scores, schema_valid_count / max(len(traces), 1))
    metrics_path = out_dir / f"{label}_metrics.json"
    metrics_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    audit_path = out_dir / f"{label}_audit_events.jsonl"
    with audit_path.open("w", encoding="utf-8") as f:
        for event in audit_events:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")
    return {
        "traces_path": str(traces_path),
        "metrics_path": str(metrics_path),
        "audit_events_path": str(audit_path),
        "audit_event_count": len(audit_events),
        "metrics": metrics,
        "split": split,
        "answer_mode": answer_mode,
        "seed": seed,
        "num_samples": num_samples,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tasks", type=Path, default=ROOT / "benchmarks" / "tasks" / "task_specs.json")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-1.5B-Instruct")
    parser.add_argument("--adapter-path", default="", help="Optional adapter path for post run")
    parser.add_argument("--max-new-tokens", type=int, default=128)
    parser.add_argument("--split", choices=("train", "validation", "test", "all"), default="test")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--answer-mode",
        choices=("strict", "final_answer_friendly"),
        default="final_answer_friendly",
        help="How to compare predicted answers in scoring",
    )
    parser.add_argument("--use-mock", action="store_true", help="Use deterministic mock generation for tests")
    parser.add_argument("--num-samples", type=int, default=1, help="Number of candidates per prompt")
    parser.add_argument("--max-steps", type=int, default=32, help="Max allowed reasoning steps per trace")
    parser.add_argument("--max-final-answer-chars", type=int, default=2048, help="Max allowed final answer length")
    parser.add_argument("--redact-pii", action="store_true", help="Apply simple PII redaction policy")
    parser.add_argument(
        "--deny-tool-pattern",
        action="append",
        default=[],
        help="Case-insensitive substring that triggers tool-denied policy event",
    )
    args = parser.parse_args()

    pre = run_eval(
        args.tasks,
        args.output_dir,
        base_model=args.base_model,
        adapter_path=None,
        max_new_tokens=args.max_new_tokens,
        seed=args.seed,
        use_mock=args.use_mock,
        split=args.split,
        answer_mode=args.answer_mode,
        num_samples=args.num_samples,
        max_steps=args.max_steps,
        max_final_answer_chars=args.max_final_answer_chars,
        redact_pii=args.redact_pii,
        deny_tool_patterns=tuple(args.deny_tool_pattern),
        label="pre",
    )

    post_adapter = args.adapter_path or None
    post = run_eval(
        args.tasks,
        args.output_dir,
        base_model=args.base_model,
        adapter_path=post_adapter,
        max_new_tokens=args.max_new_tokens,
        seed=args.seed,
        use_mock=args.use_mock,
        split=args.split,
        answer_mode=args.answer_mode,
        num_samples=args.num_samples,
        max_steps=args.max_steps,
        max_final_answer_chars=args.max_final_answer_chars,
        redact_pii=args.redact_pii,
        deny_tool_patterns=tuple(args.deny_tool_pattern),
        label="post",
    )

    delta = {
        "delta_final_answer_exact": post["metrics"]["final_answer_exact_avg"]
        - pre["metrics"]["final_answer_exact_avg"],
        "delta_step_validity_proxy": post["metrics"]["step_validity_proxy_avg"]
        - pre["metrics"]["step_validity_proxy_avg"],
        "delta_step_semantic_proxy": post["metrics"]["step_semantic_proxy_avg"]
        - pre["metrics"]["step_semantic_proxy_avg"],
        "delta_self_consistency": post["metrics"]["self_consistency_avg"] - pre["metrics"]["self_consistency_avg"],
        "delta_schema_validity_rate": post["metrics"]["schema_validity_rate"] - pre["metrics"]["schema_validity_rate"],
    }
    summary = {
        "pre": pre,
        "post": post,
        "delta": delta,
    }
    write_json(args.output_dir / "pre_post_summary.json", summary)
    write_json(
        args.output_dir / "lineage_eval.json",
        {
            "stage": "eval_pre_post",
            "tasks_file": str(args.tasks),
            "tasks_sha256": sha256_file(args.tasks),
            "base_model": args.base_model,
            "adapter_path": args.adapter_path or None,
            "split": args.split,
            "answer_mode": args.answer_mode,
            "seed": args.seed,
            "num_samples": args.num_samples,
            "use_mock": bool(args.use_mock),
            "artifacts": {
                "pre_metrics": pre["metrics_path"],
                "post_metrics": post["metrics_path"],
                "pre_traces": pre["traces_path"],
                "post_traces": post["traces_path"],
            "pre_audit_events": pre["audit_events_path"],
            "post_audit_events": post["audit_events_path"],
                "summary": str(args.output_dir / "pre_post_summary.json"),
            },
            "generated_at_utc": utc_now_iso(),
            "git_commit": get_git_commit(ROOT),
        },
    )
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
