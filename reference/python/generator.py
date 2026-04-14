"""Helpers for generating CoT-shaped traces (templates, placeholders)."""

from __future__ import annotations

from typing import Any


def empty_trace(*, version: str = "0.1.0", task_id: str | None = None) -> dict[str, Any]:
    """Return a minimal valid trace shell; add steps before validation."""
    out: dict[str, Any] = {"version": version, "steps": []}
    if task_id is not None:
        out["task_id"] = task_id
    return out
