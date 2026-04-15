# Conformance Fixtures

Open CoT includes executable fixtures aligned to profile levels from RFC 0046.

## Fixture Matrix

- Matrix file: `conformance/fixtures/fixture_matrix.json`
- Validation command:

```bash
python3 tools/check_conformance_fixtures.py
```

## Profiles

- **Profile A** (`conformance/fixtures/profile_a`): core reasoning trace validation
- **Profile B** (`conformance/fixtures/profile_b`): reasoning + tool invocation + verifier output
- **Profile C** (`conformance/fixtures/profile_c`): dataset packaging manifest

## Why this exists

These fixtures provide stable, versioned examples for:

- CI conformance checks
- quickstart validation
- downstream implementation testing

This keeps profile claims auditable and reduces ambiguity for adopters integrating Open CoT in training/evaluation pipelines.
