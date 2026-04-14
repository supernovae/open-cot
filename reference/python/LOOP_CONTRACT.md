# Minimal Loop Transcript Contract (RFC 0007 aligned)

This contract defines the minimum shape for a deterministic agent-loop transcript used in 0.1 tests.

## Required top-level fields

- `version`
- `task`
- `steps` (array, at least one item)
- `final_answer`

## Step requirements

Each step must include:

- `id`
- `type`
- `content`

## Action and observation pairing

If a step has `type: "action"` and includes `tool_invocation`, the transcript should include a subsequent `type: "observation"` step with `parent` set to the action `id`.

## Verifier output sidecar

Verifier sidecar (RFC 0002) should include:

- `version`
- `results[]` entries keyed by `step_id`

This contract is intentionally small and deterministic for reproducible harness and CI tests.
