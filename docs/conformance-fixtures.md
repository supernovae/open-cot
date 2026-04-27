# Conformance Fixtures

Open CoT includes executable fixtures aligned to the compact core conformance profile.

## Fixture Matrix

- Matrix file: `conformance/fixtures/fixture_matrix.json`
- Validation command:

```bash
python3 tools/check_conformance_fixtures.py
```

## Profiles

- **Core profile** (`conformance/fixtures/profile_core`): cognitive artifact,
  capability snapshot, and reconciliation result validation.

## Why this exists

These fixtures provide stable, versioned examples for:

- CI conformance checks
- quickstart validation
- downstream implementation testing

This keeps profile claims auditable and reduces ambiguity for adopters integrating Open CoT at runtime boundaries.
