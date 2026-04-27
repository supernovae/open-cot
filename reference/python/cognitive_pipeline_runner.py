"""Deterministic mock cognitive pipeline runner."""

from __future__ import annotations

import json
from typing import Any

from .mock_llm import MockLLM
from .mock_tool import MockToolbox
from .mock_verifier import MockVerifier


def run_mock_cognitive_pipeline(task: str) -> tuple[dict[str, Any], dict[str, Any]]:
    llm = MockLLM()
    tools = MockToolbox()
    verifier = MockVerifier()

    trace = llm.generate_plan(task)
    steps = trace.setdefault("steps", [])

    # Execute mock tool calls declared by action steps.
    for step in list(steps):
        if step.get("type") != "action":
            continue
        inv = step.get("tool_invocation", {})
        tool_name = str(inv.get("tool_name", ""))
        args = inv.get("arguments", {}) if isinstance(inv.get("arguments", {}), dict) else {}
        result = tools.call(tool_name, args)
        obs_id = f"{step.get('id', 's')}_obs"
        obs_content = json.dumps(result.output, ensure_ascii=False)
        obs = {
            "id": obs_id,
            "type": "observation",
            "content": obs_content,
            "parent": step.get("id"),
        }
        steps.append(obs)
        if result.error:
            steps.append(
                {
                    "id": f"{obs_id}_err",
                    "type": "critique",
                    "content": result.error,
                    "parent": obs_id,
                }
            )

    # Add deterministic final response for known task.
    if "tokyo" in task.lower() and "square root" in task.lower():
        trace["final_answer"] = "The square root of Tokyo's population (~13.96M) is approximately 3736."
    elif not trace.get("final_answer"):
        trace["final_answer"] = "mock-answer"

    verifier_output = verifier.verify(trace)
    return trace, verifier_output
