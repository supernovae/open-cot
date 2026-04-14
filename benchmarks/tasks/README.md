# Benchmark Tasks (0.1 slice)

This directory holds starter benchmark task definitions for Open CoT.

## Files

- `task_specs.json`: canonical task set with split metadata and expected answers.

## Policy (0.1)

- Fixed split assignment is encoded in task metadata.
- `test` split is intended as holdout for reporting.
- Keep prompts stable; append new tasks instead of mutating old IDs.
