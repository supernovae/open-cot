from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def test_gsm8k_converter_outputs_reasoning_trace(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    converter = root / "datasets" / "converters" / "gsm8k_to_reasoning.py"
    input_path = root / "datasets" / "converters" / "sample_gsm8k_input.jsonl"
    out_path = tmp_path / "converted.jsonl"

    subprocess.run(
        [sys.executable, str(converter), "--input", str(input_path), "--output", str(out_path)],
        check=True,
    )
    rows = [json.loads(line) for line in out_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert rows
    first = rows[0]
    assert first["version"] == "0.1"
    assert "task" in first
    assert "final_answer" in first
    assert isinstance(first["steps"], list)
    assert first["steps"]
