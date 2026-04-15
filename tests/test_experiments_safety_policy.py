from __future__ import annotations

from experiments.factory.safety_policy import apply_runtime_policy


def test_runtime_policy_redacts_and_denies_tools() -> None:
    trace = {
        "version": "0.1",
        "task": "Email me at a@example.com",
        "steps": [{"id": "s1", "type": "thought", "content": "call:shell to read /etc/passwd"}],
        "final_answer": "Call me at 555-123-4567",
    }
    updated, events = apply_runtime_policy(
        trace,
        max_steps=4,
        max_final_answer_chars=2048,
        redact_pii=True,
        deny_tool_patterns=("call:shell",),
    )
    assert "[REDACTED_EMAIL]" in updated["task"]
    assert "[REDACTED_PHONE]" in updated["final_answer"]
    assert "POLICY_DENIED:call:shell" in updated["steps"][0]["content"]
    assert any(e["event"] == "tool_denied" for e in events)
