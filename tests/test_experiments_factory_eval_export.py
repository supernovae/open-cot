from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def test_eval_pre_post_and_export_artifacts(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    eval_script = root / "experiments" / "factory" / "eval_pre_post.py"
    export_script = root / "experiments" / "factory" / "export_artifacts.py"
    tasks = root / "benchmarks" / "tasks" / "task_specs.json"
    run_dir = tmp_path / "run"

    subprocess.run(
        [
            sys.executable,
            str(eval_script),
            "--tasks",
            str(tasks),
            "--output-dir",
            str(run_dir),
            "--split",
            "test",
            "--seed",
            "42",
            "--use-mock",
        ],
        check=True,
        cwd=root,
    )

    summary = run_dir / "pre_post_summary.json"
    assert summary.is_file()
    data = json.loads(summary.read_text(encoding="utf-8"))
    assert "pre" in data and "post" in data and "delta" in data
    assert data["pre"]["metrics"]["num_tasks"] == 1

    subprocess.run(
        [
            sys.executable,
            str(export_script),
            "--run-dir",
            str(run_dir),
        ],
        check=True,
        cwd=root,
    )
    artifact_summary = run_dir / "artifact_summary.json"
    assert artifact_summary.is_file()
    artifact_data = json.loads(artifact_summary.read_text(encoding="utf-8"))
    assert artifact_data["file_count"] >= 1
