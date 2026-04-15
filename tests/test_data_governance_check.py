from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def test_data_governance_detects_duplicates_and_contamination(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    script = root / "tools" / "data_governance_check.py"
    train = tmp_path / "train.jsonl"
    manifest = tmp_path / "manifest.json"
    report = tmp_path / "report.json"

    rows = [
        {
            "version": "0.1",
            "task": "Compute 9 * 8.",
            "steps": [{"id": "s1", "type": "thought", "content": "72"}],
            "final_answer": "72",
        },
        {
            "version": "0.1",
            "task": "Compute 9 * 8.",
            "steps": [{"id": "s1", "type": "thought", "content": "72"}],
            "final_answer": "72",
        },
    ]
    train.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
    manifest.write_text(json.dumps({"name": "x"}) + "\n", encoding="utf-8")

    completed = subprocess.run(
        [
            sys.executable,
            str(script),
            "--train-jsonl",
            str(train),
            "--benchmark-task-specs",
            str(root / "benchmarks" / "tasks" / "task_specs.json"),
            "--manifest",
            str(manifest),
            "--output",
            str(report),
        ],
        check=True,
        cwd=root,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0
    assert report.is_file()
    data = json.loads(report.read_text(encoding="utf-8"))
    assert data["duplicate_prompt_rows"] == 1
    assert data["contamination_hits"] >= 1
    assert "license" in data["missing_manifest_fields"]
