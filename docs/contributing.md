# Contributing

Open CoT accepts changes that strengthen the compact Cognitive Operations Theory core.

## Required Pattern

- Update the RFC markdown first.
- Embed normative JSON Schema inside `<!-- opencot:schema:start -->` and `<!-- opencot:schema:end -->` markers.
- Run `python3 tools/sync_schemas_from_rfcs.py` and commit generated schemas.
- Add or update a valid example under `examples/<registry-shortname>/`.
- Run `python3 tools/validate.py`.

## Scope

Runtime-boundary interfaces belong here. Training datasets, reward modeling, benchmark execution, and model adaptation should become separate projects or future extensions after the core stabilizes.
