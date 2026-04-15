#!/usr/bin/env python3
"""Validate profile fixture matrix for RFC 0046-style conformance claims."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "tools") not in sys.path:
    sys.path.insert(0, str(ROOT / "tools"))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from schema_lib import load_registry, registry_schema_paths  # noqa: E402
from schema_resolver import SchemaResolver  # noqa: E402


def _validate_instance(schema: dict[str, Any], instance: dict[str, Any]) -> str | None:
    try:
        from jsonschema import Draft7Validator
    except ImportError:  # pragma: no cover
        required = schema.get("required", [])
        if isinstance(required, list):
            for key in required:
                if key not in instance:
                    return f"missing required field {key!r}"
        return None

    try:
        Draft7Validator(schema).validate(instance)
    except Exception as e:
        return str(e)
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--matrix",
        type=Path,
        default=ROOT / "conformance" / "fixtures" / "fixture_matrix.json",
    )
    args = parser.parse_args()

    resolver = SchemaResolver(ROOT)
    registry = load_registry()
    shortnames = registry_schema_paths(registry)
    matrix = json.loads(args.matrix.read_text(encoding="utf-8"))

    errors: list[str] = []
    profiles = matrix.get("profiles", {})
    if not isinstance(profiles, dict):
        errors.append("matrix.profiles must be an object")
    else:
        for profile_name, fixtures in profiles.items():
            if not isinstance(fixtures, list) or not fixtures:
                errors.append(f"profile {profile_name} must contain at least one fixture")
                continue
            for fixture in fixtures:
                if not isinstance(fixture, dict):
                    errors.append(f"profile {profile_name} has non-object fixture entry")
                    continue
                shortname = str(fixture.get("shortname", "")).strip()
                rel_path = str(fixture.get("path", "")).strip()
                if shortname not in shortnames:
                    errors.append(f"profile {profile_name}: unknown shortname {shortname!r}")
                    continue
                path = ROOT / rel_path
                if not path.is_file():
                    errors.append(f"profile {profile_name}: missing fixture file {rel_path}")
                    continue
                schema_path = resolver.path_for_shortname(shortname)
                schema = json.loads(schema_path.read_text(encoding="utf-8"))
                instance = json.loads(path.read_text(encoding="utf-8"))
                err = _validate_instance(schema, instance)
                if err is not None:
                    errors.append(f"profile {profile_name}: {rel_path} invalid for {shortname}: {err}")

    if errors:
        for err in errors:
            print(err, file=sys.stderr)
        return 1
    print("OK: conformance fixture matrix validated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
