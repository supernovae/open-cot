# Reasoning patterns

This document catalogs common chain-of-thought and structured reasoning patterns used across open-cot datasets and benchmarks.

## Goals

- Give contributors a shared vocabulary for labeling and generating traces.
- Align synthetic data and human annotation rubrics.

## Pattern categories

| Category | Description |
|----------|-------------|
| Decomposition | Breaking a problem into subgoals or subquestions. |
| Self-check | Explicit verification, constraint checks, or answer review. |
| Backtracking | Revising an earlier step when a contradiction or error is found. |
| Tool use | Reasoning interleaved with calls to calculators, code, or retrieval. |
| Analogical | Mapping to a known template or prior example. |

## Contributing

Add new patterns as short definitions with one minimal example reference under `standards/examples/` when possible.
