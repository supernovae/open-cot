#!/usr/bin/env python3
"""Validate JSON Schema syntax, $ref resolution, and examples/ instances."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterator

_TOOLS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _TOOLS_DIR.parent
if str(_TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOLS_DIR))

from schema_lib import load_registry, registry_schema_paths
from schema_resolver import SchemaResolver


def _walk_refs(obj: Any) -> Iterator[str]:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "$ref" and isinstance(v, str):
                yield v
            yield from _walk_refs(v)
    elif isinstance(obj, list):
        for item in obj:
            yield from _walk_refs(item)


def _build_registry() -> tuple[Any, dict[str, dict[str, Any]]]:
    try:
        import referencing
        from referencing.jsonschema import DRAFT7
    except ImportError as e:  # pragma: no cover
        raise SystemExit(
            "Missing dependencies. Create a venv and run:\n"
            "  python3 -m venv .venv && source .venv/bin/activate\n"
            "  pip install -r requirements-tools.txt\n"
        ) from e

    schemas_dir = _REPO_ROOT / "schemas"
    reg = referencing.Registry()
    loaded: dict[str, dict[str, Any]] = {}
    for path in sorted(schemas_dir.glob("rfc-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        uri = data.get("$id")
        if not isinstance(uri, str):
            uri = f"file:{path.name}"
            data = dict(data)
            data["$id"] = uri
        resource = referencing.Resource.from_contents(data, default_specification=DRAFT7)
        reg = reg.with_resource(uri, resource)
        loaded[path.name] = data
    return reg, loaded


def _check_meta_schemas(loaded: dict[str, dict[str, Any]]) -> list[str]:
    from jsonschema import Draft7Validator

    errors: list[str] = []
    for name, schema in loaded.items():
        try:
            Draft7Validator.check_schema(schema)
        except Exception as e:
            errors.append(f"{name}: meta-schema check failed: {e}")
    return errors


def _check_refs(resolver: SchemaResolver, loaded: dict[str, dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    for fname, schema in loaded.items():
        base = schema.get("$id")
        if not isinstance(base, str):
            base = None
        for ref in _walk_refs(schema):
            if ref.startswith("#"):
                continue
            p = resolver.path_for_ref(ref, base_uri=base)
            if p is None or not p.is_file():
                errors.append(f"{fname}: unresolved $ref {ref!r} (base={base!r})")
    return errors


def _validate_examples(resolver: SchemaResolver, reg: Any) -> list[str]:
    from jsonschema import Draft7Validator

    errors: list[str] = []
    registry = load_registry()
    shortnames = registry_schema_paths(registry)
    examples_root = _REPO_ROOT / "examples"
    if not examples_root.is_dir():
        return errors
    for path in sorted(examples_root.rglob("*.json")):
        if path.name.startswith("_"):
            continue
        rel_parent = path.relative_to(examples_root).parts[0] if path.relative_to(examples_root).parts else ""
        shortname = rel_parent
        if shortname not in shortnames:
            errors.append(f"{path.relative_to(_REPO_ROOT)}: unknown example folder {shortname!r}")
            continue
        schema_path = resolver.path_for_shortname(shortname)
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        instance = json.loads(path.read_text(encoding="utf-8"))
        try:
            Draft7Validator(schema, registry=reg).validate(instance)
        except Exception as e:
            errors.append(f"{path.relative_to(_REPO_ROOT)}: instance invalid: {e}")
    return errors


def _cross_consistency(loaded: dict[str, dict[str, Any]]) -> list[str]:
    """Lightweight checks across known pairs."""
    warnings: list[str] = []
    if "rfc-0007-agent-loop.json" in loaded:
        s = json.dumps(loaded["rfc-0007-agent-loop.json"])
        if "rfc-0001-reasoning.json" not in s:
            warnings.append("rfc-0007-agent-loop.json should reference rfc-0001-reasoning.json")
    return warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-examples", action="store_true", help="Skip examples/ validation")
    args = parser.parse_args()

    resolver = SchemaResolver(_REPO_ROOT)
    if not resolver.registry_path.is_file():
        print("Missing schemas/registry.json — run: python3 tools/sync_schemas_from_rfcs.py", file=sys.stderr)
        return 1

    reg, loaded = _build_registry()
    errs = _check_meta_schemas(loaded)
    errs += _check_refs(resolver, loaded)
    if not args.no_examples:
        errs += _validate_examples(resolver, reg)
    for w in _cross_consistency(loaded):
        print("WARN:", w, file=sys.stderr)

    if errs:
        for e in errs:
            print(e, file=sys.stderr)
        return 1
    print(f"OK: {len(loaded)} schemas, registry loaded, validation passed.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
