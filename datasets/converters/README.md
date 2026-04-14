# Converters

Converters transform external dataset records into Open CoT trace format.

## Included

- `gsm8k_to_reasoning.py`: converts JSONL records with `question`, `answer`, and optional `rationale` fields into RFC 0001 reasoning traces.

## Usage

```bash
python3 datasets/converters/gsm8k_to_reasoning.py \
  --input /path/to/input.jsonl \
  --output /path/to/output.jsonl
```

## Contract

- Output records target `schemas/rfc-0001-reasoning.json`.
- Converter output should pass `python tools/validate.py` when included under a known example/dataset validation path.
