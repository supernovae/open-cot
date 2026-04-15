from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def test_prepare_cot_sft_outputs_files(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    script = root / "experiments" / "factory" / "prepare_cot_sft.py"
    input_path = root / "datasets" / "synthetic" / "task_bank_v0.jsonl"
    out_dir = tmp_path / "prepared"

    subprocess.run(
        [
            sys.executable,
            str(script),
            "--input",
            str(input_path),
            "--output-dir",
            str(out_dir),
            "--val-ratio",
            "0.2",
            "--seed",
            "42",
        ],
        check=True,
        cwd=root,
    )

    train_path = out_dir / "train.jsonl"
    val_path = out_dir / "validation.jsonl"
    manifest_path = out_dir / "manifest.json"
    lineage_path = out_dir / "lineage_prepare.json"
    assert train_path.is_file()
    assert val_path.is_file()
    assert manifest_path.is_file()
    assert lineage_path.is_file()

    train_rows = [json.loads(line) for line in train_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert train_rows
    assert all("instruction" in r and "response" in r and "text" in r for r in train_rows)
