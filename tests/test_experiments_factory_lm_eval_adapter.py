from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def test_lm_eval_adapter_from_sample_files(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    script = root / "experiments" / "factory" / "run_lm_eval_adapter.py"
    out_dir = tmp_path / "adapter_out"
    out_dir.mkdir(parents=True, exist_ok=True)

    harness_results = {
        "results": {
            "mock_task": {"acc,none": 1.0},
        }
    }
    (out_dir / "lm_eval_results.json").write_text(json.dumps(harness_results) + "\n", encoding="utf-8")

    sample = {
        "task_name": "mock_task",
        "doc": {"query": "Compute 9 * 8."},
        "target": "72",
        "resps": [["72"]],
    }
    (out_dir / "lm_eval_samples.jsonl").write_text(json.dumps(sample) + "\n", encoding="utf-8")

    subprocess.run(
        [
            sys.executable,
            str(script),
            "--output-dir",
            str(out_dir),
            "--harness-results-json",
            str(out_dir / "lm_eval_results.json"),
            "--samples-jsonl",
            str(out_dir / "lm_eval_samples.jsonl"),
            "--task-specs",
            str(root / "benchmarks" / "tasks" / "task_specs.json"),
        ],
        check=True,
        cwd=root,
    )

    summary_path = out_dir / "adapter_summary.json"
    traces_path = out_dir / "adapter_traces.jsonl"
    assert summary_path.is_file()
    assert traces_path.is_file()

    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    assert summary["adapter"] == "lm_eval_harness"
    assert summary["num_samples_in"] == 1
    assert summary["num_scored_samples"] == 1
    assert summary["scored_metrics"]["final_answer_exact_avg"] == 1.0
