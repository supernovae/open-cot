"""Deterministic mock LLM for agent loop integration tests."""

from __future__ import annotations

from typing import Any


class MockLLM:
    """Generates predictable traces for fixed demo tasks."""

    def generate_plan(self, task: str) -> dict[str, Any]:
        t = task.lower().strip()
        if "tokyo" in t and "square root" in t:
            return {
                "version": "0.1",
                "task": task,
                "steps": [
                    {"id": "s1", "type": "thought", "content": "Need Tokyo population first."},
                    {
                        "id": "s2",
                        "type": "action",
                        "content": "call:search",
                        "tool_invocation": {
                            "tool_name": "search",
                            "arguments": {"query": "population of tokyo"},
                            "triggered_by_step": "s1",
                        },
                    },
                ],
                "final_answer": "",
            }
        return {
            "version": "0.1",
            "task": task,
            "steps": [{"id": "s1", "type": "thought", "content": "No specialized mock path; answer directly."}],
            "final_answer": "mock-answer",
        }
