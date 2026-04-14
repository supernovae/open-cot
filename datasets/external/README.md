# External Dataset Intake

This directory tracks external reasoning datasets considered for Open CoT bootstrapping.

## License policy

Allowed licenses for ingestion:

- MIT
- Apache-2.0
- CC-BY-4.0

Blocked by default:

- Unknown/custom licenses
- Non-redistributable terms
- Ambiguous or conflicting ownership

## Registry

Use `registry.json` to track review status:

- `candidate`
- `license-reviewed`
- `ingested`
- `blocked`

Each entry should include:

- owner/org
- source URL
- license
- intended usage
- risk notes

## Ingestion pipeline

Use:

```bash
python datasets/external/ingest_external_dataset.py \
  --input-jsonl /path/to/source.jsonl \
  --output-dir datasets/external/ingested/example_dataset \
  --dataset-name example_dataset \
  --license Apache-2.0 \
  --source-url https://example.org/dataset \
  --owner example-owner
```

Pipeline stages:

1. Normalize source rows into RFC 0001 traces.
2. Apply deterministic content/risk filters.
3. Validate against Open CoT schema.
4. Emit dataset manifest with provenance and filter stats.
