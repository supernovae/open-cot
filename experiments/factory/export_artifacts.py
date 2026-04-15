#!/usr/bin/env python3
"""Bundle experiment artifacts and compute hashes."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from experiments.factory.lineage import get_git_commit, utc_now_iso  # noqa: E402


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
    parser.add_argument(
        "--require-lineage",
        action="store_true",
        help="Fail if expected lineage files are missing in the run directory",
    )
    args = parser.parse_args()

    run_dir = args.run_dir
    if args.require_lineage:
        required_lineage = ["lineage_eval.json"]
        missing = [name for name in required_lineage if not (run_dir / name).is_file()]
        if missing:
            raise SystemExit(f"missing required lineage files: {', '.join(missing)}")

    files = sorted([p for p in run_dir.rglob("*") if p.is_file()])
    hashes: dict[str, str] = {str(p.relative_to(run_dir)): sha256(p) for p in files}
    summary: dict[str, Any] = {
        "run_dir": str(run_dir),
        "file_count": len(files),
        "hashes": hashes,
        "generated_at_utc": utc_now_iso(),
        "git_commit": get_git_commit(Path(__file__).resolve().parents[2]),
    }

    output_path = args.output or (run_dir / "artifact_summary.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
