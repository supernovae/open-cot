"""Deterministic mock tools for local reasoning-loop tests."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ToolResult:
    output: Any
    error: str | None = None


class MockToolbox:
    """A tiny deterministic tool registry."""

    def __init__(self) -> None:
        self._population_db = {
            "population of tokyo": {"population": 13960000},
            "population of paris": {"population": 2161000},
        }

    def call(self, tool_name: str, arguments: dict[str, Any]) -> ToolResult:
        if tool_name == "search":
            query = str(arguments.get("query", "")).lower().strip()
            if query in self._population_db:
                return ToolResult(output=self._population_db[query])
            return ToolResult(output={}, error=f"No mock data for query: {query}")
        if tool_name == "calculator":
            expr = str(arguments.get("expression", "")).strip()
            if expr == "sqrt(13960000)":
                return ToolResult(output={"value": 3736.308318996145})
            return ToolResult(output={}, error=f"Unsupported expression: {expr}")
        return ToolResult(output={}, error=f"Unknown tool: {tool_name}")
