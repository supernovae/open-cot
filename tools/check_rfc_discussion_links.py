#!/usr/bin/env python3
"""Validate RFC discussion links point to GitHub Discussions and match index mapping."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RFC_DIR = REPO_ROOT / "rfcs"
DEFAULT_INDEX = REPO_ROOT / "docs" / "rfc-discussion-index.json"

HEADER_RE = re.compile(r"^# RFC (\d{4})")
DISCUSSION_RE = re.compile(r"^\*\*Discussion:\*\*\s+(https://github\.com/[^/]+/[^/]+/discussions/\d+)\s*$")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--index", type=Path, default=DEFAULT_INDEX)
    args = parser.parse_args()

    if not args.index.is_file():
        raise SystemExit(f"missing discussion index: {args.index}")

    index = json.loads(args.index.read_text(encoding="utf-8"))
    mapping = index.get("rfcs", {})
    if not isinstance(mapping, dict):
        raise SystemExit("docs/rfc-discussion-index.json missing 'rfcs' mapping")

    errors: list[str] = []
    for path in sorted(RFC_DIR.glob("*.md")):
        lines = path.read_text(encoding="utf-8").splitlines()
        if not lines:
            errors.append(f"{path}: empty file")
            continue

        h = HEADER_RE.match(lines[0].strip())
        if not h:
            errors.append(f"{path}: first heading must start with '# RFC NNNN'")
            continue
        rfc_id = h.group(1)

        discussion_line = next((line.strip() for line in lines if line.strip().startswith("**Discussion:**")), None)
        if discussion_line is None:
            errors.append(f"{path}: missing '**Discussion:**' line")
            continue

        d = DISCUSSION_RE.match(discussion_line)
        if not d:
            errors.append(f"{path}: discussion link must be a GitHub Discussions URL")
            continue
        url = d.group(1)

        expected = mapping.get(rfc_id, {}).get("discussion_url")
        if not expected:
            errors.append(f"{path}: rfc id {rfc_id} missing from discussion index mapping")
            continue
        if url != expected:
            errors.append(f"{path}: discussion URL mismatch (expected {expected}, found {url})")

    if errors:
        for err in errors:
            print(err)
        return 1

    print(f"OK: validated RFC discussion links across {len(list(RFC_DIR.glob('*.md')))} RFC files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
