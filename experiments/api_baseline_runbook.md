# API Baseline Runbook (0.1)

## Goal

Establish a reproducible API-backed baseline for comparison against local OSS runs.

## Steps

1. Use the same prompt set as local runs (`experiments/reference_run/prompts.jsonl`).
2. Fix provider/model id and decoding parameters.
3. Capture raw responses and convert to RFC 0001 traces.
4. Validate and score using the same toolchain as local runs.
5. Store artifacts under `experiments/reference_run/`.

## Required fields for baseline report

- provider + model id
- timestamp window
- seed/settings (if supported)
- prompt hash
- output hash
- schema validity rate
- benchmark scores

## Notes

API models may change behavior over time; record exact run date and provider revision info where available.
