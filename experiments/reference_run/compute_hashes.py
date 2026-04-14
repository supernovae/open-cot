#!/usr/bin/env python3
"""Compute SHA256 hashes for reference run artifacts."""

from __future__ import annotations

import hashlib
from pathlib import Path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    root = Path(__file__).resolve().parent
    targets = ["config.json", "prompts.jsonl", "outputs.jsonl", "metrics.json"]
    lines: list[str] = []
    for name in targets:
        path = root / name
        lines.append(f"{sha256(path)}  {name}")
    out = root / "hashes.txt"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
