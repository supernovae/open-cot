# Synthetic Seed Dataset (v0)

This directory contains a deterministic starter corpus for Open CoT 0.1.

## Files

- `task_bank_v0.jsonl`: small seed traces (math, coding, planning) in RFC 0001 shape.
- `task_bank_v1_large.jsonl`: 10x-style phase-1 scaled synthetic bank (50 traces) across math/code/planning tiers.
- `generate_seed.py`: deterministic generator for `task_bank_v0.jsonl`.
- `generate_scaled.py`: deterministic generator for `task_bank_v1_large.jsonl`.
- `dataset_manifest.json`: provenance, schema target, and release metadata.
- `safety_checklist.md`: required pre-release checks.

## Schema target

- Primary trace schema: `schemas/rfc-0001-reasoning.json`
- Registry shortname: `reasoning`

## Re-generate

```bash
python3 datasets/synthetic/generate_seed.py
```

## Release gates (minimum)

- PII scan: pass
- License attribution: documented
- Provenance source list: documented
- Safety checklist: completed
