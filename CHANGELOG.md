# Changelog

All notable changes to Open CoT are documented here.

The project follows semantic versioning for schema and registry compatibility:

- **major**: backward-incompatible schema semantics
- **minor**: backward-compatible schema/feature additions
- **patch**: docs/examples/tooling-only or non-semantic updates

## [0.1.0] - Unreleased

### Added

- Deterministic RFC schema extraction markers for Tier A.
- Conformance profile checks in validation pipeline.
- Semantic schema diff checker severity reporting.
- Starter synthetic dataset and converter baseline.
- Mock harness, test suite, benchmark slice, governance templates, and demo runbooks.
- RFC 0051 Temporal Semantics & Validity Extension plus generated schema (`rfc-0051-temporal-semantics.json`).
- Temporal migration guide for downstream integrators (`docs/temporal-migration-rfc0051.md`).

### Changed

- Breaking temporal normalization across governance RFCs: canonical fields (`observed_at`, `decided_at`, `effective_at`, `expires_at`, `started_at`, `completed_at`, `superseded_at`) replace legacy aliases.
- Governance spine schemas updated (policy, permissions, delegation, audit, receipts, lifecycle, telemetry, memory, multi-party protocol) and registry regenerated.
- Reference harness runtime/types aligned to canonical temporal fields, logical ordering metadata, and updated governance artifacts.
- Example fixtures now use registry shortname folders for delegation, permissions, and execution/audit receipts.
