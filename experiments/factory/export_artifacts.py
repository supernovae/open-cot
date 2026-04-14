#!/usr/bin/env python3
"""Bundle experiment artifacts and compute hashes."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=None, help="Output summary path")
    args = parser.parse_args()

    run_dir = args.run_dir
    files = sorted([p for p in run_dir.rglob("*") if p.is_file()])
    hashes: dict[str, str] = {
        str(p.relative_to(run_dir)): sha256(p) for p in files
    }
    summary: dict[str, Any] = {
        "run_dir": str(run_dir),
        "file_count": len(files),
        "hashes": hashes,
    }

    output_path = args.output or (run_dir / "artifact_summary.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
