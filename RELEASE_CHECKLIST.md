# Release Checklist

Use this checklist before tagging a release.

## Core gates

- [ ] `python3 tools/sync_schemas_from_rfcs.py` produces no uncommitted schema drift.
- [ ] `python3 tools/validate.py` passes.
- [ ] `python3 tools/diff_checker.py <before> <after> --strict --min-severity major` reviewed.
- [ ] Tier A examples are present and valid.

## Data and benchmark gates

- [ ] Synthetic dataset manifest and safety checklist reviewed.
- [ ] Benchmark task spec and scoring scripts are reproducible.
- [ ] Leaderboard run card template is up to date.

## Governance and docs

- [ ] RFC lifecycle status updates applied (`draft`, `implementation_required`, `stable`, etc.).
- [ ] Migration notes written for major schema changes.
- [ ] `CHANGELOG.md` updated.
- [ ] README and roadmap links verified.

## Demo gates (0.1 target)

- [ ] Local OSS runbook executed (or dry-run validated).
- [ ] API baseline runbook executed (or dry-run validated).
- [ ] Reference run artifacts and hashes published.
