"""Rule-based verifier for deterministic harness tests."""

from __future__ import annotations

from typing import Any


class MockVerifier:
    def verify(self, trace: dict[str, Any]) -> dict[str, Any]:
        results: list[dict[str, Any]] = []
        for step in trace.get("steps", []):
            step_id = step.get("id", "unknown")
            content = str(step.get("content", ""))
            correct = "unknown"
            if content:
                correct = "true"
            results.append({"step_id": step_id, "correct": correct, "confidence": 0.95})
        return {
            "version": "0.1",
            "trace_id": trace.get("task", "trace"),
            "verifier": "mock_rule_verifier",
            "results": results,
        }
