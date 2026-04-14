# Local OSS Model Runbook (0.1)

## Goal

Run a small local OSS model through Open CoT prompts and evaluate schema/benchmark outputs.

## Suggested stack

- Runtime: `vllm` or `llama.cpp` (quantized model acceptable for 0.1 demos)
- Model size target: 1B-3B instruct-tuned model
- Prompting: deterministic decoding for reproducibility

## Steps

1. Create environment and install project tooling.
2. Prepare prompt set from `experiments/reference_run/prompts.jsonl`.
3. Generate outputs with fixed seed and decoding params.
4. Convert outputs into RFC 0001 traces.
5. Validate traces with `python3 tools/validate.py`.
6. Score traces with `benchmarks/scoring/scorer.py`.
7. Save config + outputs + metrics + hashes.

## Minimum reproducibility fields

- model identifier
- checkpoint hash/version
- seed
- temperature/top_p/max_tokens
- prompt file hash
- output file hash
