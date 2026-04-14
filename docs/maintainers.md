# Maintainer Guide

This guide summarizes the minimum maintainer flow for release-quality changes.

## Before merge

- Confirm `tools/sync_schemas_from_rfcs.py` is clean.
- Confirm `tools/validate.py` passes.
- Confirm tests pass (`pytest -q`).
- Review `tools/diff_checker.py` findings for schema-impacting changes.

## Release preparation

Use `RELEASE_CHECKLIST.md` and ensure:

- `CHANGELOG.md` includes release-relevant changes.
- migration notes exist for major schema-impact changes.
- experiment/reference artifacts are reproducible and hashed.

## RFC lifecycle operations

- Apply lifecycle labels consistently (`draft`, `implementation_required`, `stable`, `superseded`, `archived`).
- Require RFC + schema + fixture bundle for Tier A-impacting changes.
- Require replacement links when superseding RFCs.
