"""Validate CoT traces against the project JSON Schema."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

try:
    import jsonschema
except ImportError:  # pragma: no cover - optional dependency at runtime
    jsonschema = None  # type: ignore[assignment]

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_SCHEMA = _REPO_ROOT / "schemas" / "rfc-0001-reasoning.json"


def load_schema(schema_path: Path | None = None) -> dict[str, Any]:
    """Load the canonical reasoning schema (RFC 0001) unless an explicit path is given."""
    path = schema_path or _DEFAULT_SCHEMA
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def validate_trace(
    trace: dict[str, Any],
    *,
    schema: dict[str, Any] | None = None,
    schema_path: Path | None = None,
) -> None:
    """Raise jsonschema.ValidationError if trace is invalid."""
    if jsonschema is None:
        raise RuntimeError("Install jsonschema to use validate_trace: pip install jsonschema")
    resolved = schema if schema is not None else load_schema(schema_path)
    jsonschema.validate(instance=trace, schema=resolved)
