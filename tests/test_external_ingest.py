from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def test_external_ingest_pipeline(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    script = root / "datasets" / "external" / "ingest_external_dataset.py"
    src = tmp_path / "input.jsonl"
    out_dir = tmp_path / "ingested"

    src.write_text(
        "\n".join(
            [
                json.dumps({"question": "What is 2 + 2?", "answer": "4", "rationale": "Add two and two."}),
                json.dumps({"question": "Contact me at test@example.com", "answer": "done"}),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    subprocess.run(
        [
            sys.executable,
            str(script),
            "--input-jsonl",
            str(src),
            "--output-dir",
            str(out_dir),
            "--dataset-name",
            "test_external",
            "--license",
            "MIT",
            "--source-url",
            "https://example.org/test",
            "--owner",
            "tester",
        ],
        check=True,
        cwd=root,
    )

    traces = out_dir / "traces.jsonl"
    manifest = out_dir / "dataset_manifest.json"
    assert traces.is_file()
    assert manifest.is_file()
    rows = [json.loads(line) for line in traces.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(rows) == 1
