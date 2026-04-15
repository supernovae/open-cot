#!/usr/bin/env python3
"""Runtime policy and audit helpers for Open CoT experiment scripts."""

from __future__ import annotations

import re
from typing import Any

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b")
SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")


def _redact_text(text: str) -> tuple[str, bool]:
    changed = False
    out = text
    for pattern, token in (
        (EMAIL_RE, "[REDACTED_EMAIL]"),
        (PHONE_RE, "[REDACTED_PHONE]"),
        (SSN_RE, "[REDACTED_SSN]"),
    ):
        if pattern.search(out):
            out = pattern.sub(token, out)
            changed = True
    return out, changed


def apply_runtime_policy(
    trace: dict[str, Any],
    *,
    max_steps: int,
    max_final_answer_chars: int,
    redact_pii: bool,
    deny_tool_patterns: tuple[str, ...],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    events: list[dict[str, Any]] = []
    steps = trace.get("steps", [])
    if isinstance(steps, list) and len(steps) > max_steps:
        trace["steps"] = steps[:max_steps]
        events.append(
            {
                "event": "budget_exhausted",
                "field": "steps",
                "max_steps": max_steps,
                "original_steps": len(steps),
            }
        )

    final_answer = str(trace.get("final_answer", ""))
    if len(final_answer) > max_final_answer_chars:
        trace["final_answer"] = final_answer[:max_final_answer_chars]
        events.append(
            {
                "event": "budget_exhausted",
                "field": "final_answer",
                "max_final_answer_chars": max_final_answer_chars,
                "original_length": len(final_answer),
            }
        )

    if redact_pii:
        for field_name in ("task", "final_answer"):
            value = str(trace.get(field_name, ""))
            redacted, changed = _redact_text(value)
            if changed:
                trace[field_name] = redacted
                events.append({"event": "redaction_applied", "field": field_name})
        steps = trace.get("steps", [])
        if isinstance(steps, list):
            for idx, step in enumerate(steps):
                if not isinstance(step, dict):
                    continue
                content = str(step.get("content", ""))
                redacted, changed = _redact_text(content)
                if changed:
                    step["content"] = redacted
                    events.append({"event": "redaction_applied", "field": f"steps[{idx}].content"})

    if deny_tool_patterns:
        steps = trace.get("steps", [])
        if isinstance(steps, list):
            for idx, step in enumerate(steps):
                if not isinstance(step, dict):
                    continue
                content = str(step.get("content", ""))
                for pat in deny_tool_patterns:
                    if pat and pat.lower() in content.lower():
                        step["content"] = f"POLICY_DENIED:{pat}"
                        events.append(
                            {
                                "event": "tool_denied",
                                "field": f"steps[{idx}].content",
                                "pattern": pat,
                            }
                        )
                        break

    return trace, events
