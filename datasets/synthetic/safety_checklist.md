# Synthetic Dataset Safety Checklist

Use this checklist before publishing dataset updates.

## Required checks

- [ ] **PII scan** completed (no direct identifiers, contact info, credentials, or private records).
- [ ] **Unsafe content review** completed (no harmful instructions in reasoning traces for public seed sets).
- [ ] **License compatibility** verified for all upstream sources.
- [ ] **Provenance entries** updated in `dataset_manifest.json`.
- [ ] **Schema conformance** validated against `schemas/rfc-0001-reasoning.json`.

## Suggested process

1. Generate or update traces.
2. Run `python tools/validate.py`.
3. Review diff and provenance.
4. Check all boxes above before merge.
