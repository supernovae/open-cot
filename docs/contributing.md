# Contributing

Thank you for helping improve open-cot.

## Principles

- Prefer changes that align with `schemas/rfc-0001-reasoning.json` (RFC 0001) or propose a schema bump with clear migration notes.
- Keep benchmark tasks and scoring reproducible; document expected inputs and outputs.
- Match existing tone and structure in docs under `docs/` and `standards/`.

## Suggested workflow

1. Open an issue or discussion for large additions (new benchmark families, schema changes).
2. Use small, focused pull requests with a short description of intent and impact.
3. Add or update **validated** JSON examples under `examples/<registry-shortname>/` (see `schemas/registry.json`) when you change a schema; keep narrative examples under `standards/` when appropriate.

## Schemas, RFCs, and hooks

- After editing `rfcs/*.md`, run `python3 tools/sync_schemas_from_rfcs.py` and commit everything under `schemas/`.
- Run `python3 tools/validate.py` before pushing (or rely on CI).
- Optional: install [pre-commit](https://pre-commit.com) and run `pre-commit install`. Hooks run `tools/validate.py` and ensure `schemas/` stays in sync with the RFC extractors.
- Pull requests that touch `schemas/` also run a **breaking-change heuristic** (`tools/diff_checker.py` vs the PR base branch); tighten schemas carefully and document migrations in the RFC or changelog.
