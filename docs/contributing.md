# Contributing

Thank you for helping improve open-cot.

## Principles

- Prefer changes that align with `schemas/rfc-0001-reasoning.json` (RFC 0001) or propose a schema bump with clear migration notes.
- Keep benchmark tasks and scoring reproducible; document expected inputs and outputs.
- Match existing tone and structure in docs under `docs/` and `standards/`.

## Naming and versioning contract

Open CoT uses three naming layers; keep them distinct and intentional:

1. **RFC prose id**: `rfcs/NNNN-*.md` (exactly one file per id).
2. **Registry shortname**: canonical integration identifier in `schemas/registry.json` (snake_case).
3. **Schema artifact file**: `schemas/rfc-NNNN-<slug>.json` (slug may differ from shortname for legacy ids).

Rules:

- `examples/<folder>/` MUST use the exact registry shortname from `schemas/registry.json`.
- Additions or renames should update `tools/schema_lib.py` (`RFC_SHORTNAME` and, if needed, `RFC_FILE_SLUG`).
- Tier A compatibility scope is RFC 0001-0008. A stricter extraction subset currently applies to RFC 0001-0006, which require explicit schema markers in RFC prose:
  - `<!-- opencot:schema:start -->`
  - `<!-- opencot:schema:end -->`

Registry semver policy:

- **major**: backward-incompatible schema semantics.
- **minor**: new optional schema/features.
- **patch**: docs/examples/tooling-only or non-semantic changes.

Version taxonomy:

- **Registry version** (`schemas/registry.json`): version of the published schema set.
- **Schema instance version** (for example, trace `version: "0.1"`): version of individual documents validated by a schema.
- **Dataset/benchmark manifest versions**: package/spec versions for data and task bundles.

## Suggested workflow

1. Open an issue or discussion for large additions (new benchmark families, schema changes).
2. Use small, focused pull requests with a short description of intent and impact.
3. Add or update **validated** JSON examples under `examples/<registry-shortname>/` (see `schemas/registry.json`) when you change a schema; keep narrative examples under `standards/` when appropriate.

## Project lanes (required artifacts)

| Lane | Purpose | Minimum artifact set |
|------|---------|----------------------|
| **Spec lane** | RFCs, schemas, examples, validation | RFC update + `sync_schemas` output + `examples/<shortname>/` fixture + passing `validate.py` |
| **Data lane** | Synthetic/human/converter datasets | Dataset README/manifest + provenance/license notes + schema target declaration |
| **Harness lane** | Mock execution and loop behavior | Deterministic harness code + tests + schema-valid outputs |
| **Benchmark lane** | Reproducible scoring and reporting | Task spec + scorer + run card (model, seed, decoding config) |
| **Model lane** | Demo model prove-outs | Reproducible experiment config + outputs + validation report |

## Schemas, RFCs, validation, and hooks

- After editing `rfcs/*.md`, run `python3 tools/sync_schemas_from_rfcs.py` and commit everything under `schemas/`.
- Run `python3 tools/validate.py` before pushing (or rely on CI). This now enforces:
  - schema syntax and `$ref` resolution,
  - registry/shortname example folder matching,
  - minimum Tier A fixture coverage,
  - Profile A/B/C conformance checks.
- For schema evolution review, run:
  - `python3 tools/diff_checker.py <before_schemas_dir> <after_schemas_dir> --strict --min-severity major`
- `tools/diff_checker.py` severities (`major`/`minor`/`patch`) indicate schema-diff impact, and should inform (but are not identical to) registry semver decisions.
- Optional: install [pre-commit](https://pre-commit.com) and run `pre-commit install`. Hooks run `tools/validate.py` and ensure `schemas/` stays in sync with the RFC extractors.
- Pull requests that touch `schemas/` run semantic diff checks (`tools/diff_checker.py` vs PR base branch). Tightening constraints should include migration notes in the RFC or changelog.
- Major-impact schema changes MUST include migration notes and expected upgrade path.
- RFC lifecycle guidance is documented in `docs/governance-rfc-lifecycle.md`.
