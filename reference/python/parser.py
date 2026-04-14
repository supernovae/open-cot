"""Parse CoT traces from JSON or JSONL into structured objects."""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any


def parse_trace(data: str | bytes) -> dict[str, Any]:
    """Parse a single JSON object string into a trace dict."""
    return json.loads(data)


def iter_traces_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    """Yield one trace dict per non-empty line in a JSONL file."""
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)
