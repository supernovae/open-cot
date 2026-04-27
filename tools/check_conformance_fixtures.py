#!/usr/bin/env python3
"""Validate profile fixture matrix for current Open CoT conformance claims."""

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


def _build_registry(root: Path) -> tuple[Any | None, dict[str, dict[str, Any]]]:
    schemas_dir = root / "schemas"
    loaded: dict[str, dict[str, Any]] = {}
    for path in sorted(schemas_dir.glob("rfc-*.json")):
        loaded[path.name] = json.loads(path.read_text(encoding="utf-8"))

    try:
        import referencing
        from referencing.jsonschema import DRAFT7
    except ImportError:  # pragma: no cover
        return None, loaded

    reg = referencing.Registry()
    for name, data in loaded.items():
        uri = data.get("$id")
        if not isinstance(uri, str):
            uri = f"file:{name}"
            data = dict(data)
            data["$id"] = uri
        resource = referencing.Resource.from_contents(data, default_specification=DRAFT7)
        reg = reg.with_resource(uri, resource)
        loaded[name] = data
    return reg, loaded


def _validate_instance(schema: dict[str, Any], instance: dict[str, Any], registry: Any | None) -> str | None:
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
        if registry is None:
            Draft7Validator(schema).validate(instance)
        else:
            Draft7Validator(schema, registry=registry).validate(instance)
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
    ref_registry, _ = _build_registry(ROOT)
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
                err = _validate_instance(schema, instance, ref_registry)
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
