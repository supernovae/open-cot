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
from schema_lib import duplicate_rfc_ids
from schema_resolver import SchemaResolver

TIER_A_SHORTNAMES: tuple[str, ...] = (
    "reasoning",
    "verifier_output",
    "tool_invocation",
    "branching",
    "reward",
    "ensemble",
    "agent_loop",
    "dataset_packaging",
)


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


def _check_tier_a_example_coverage() -> list[str]:
    errors: list[str] = []
    examples_root = _REPO_ROOT / "examples"
    for shortname in TIER_A_SHORTNAMES:
        p = examples_root / shortname
        if not p.is_dir():
            errors.append(f"missing required Tier A examples folder: examples/{shortname}/")
            continue
        has_json = any(x.is_file() and x.suffix == ".json" and not x.name.startswith("_") for x in p.glob("*.json"))
        if not has_json:
            errors.append(f"Tier A examples folder has no JSON fixtures: examples/{shortname}/")
    return errors


def _check_conformance_profiles() -> list[str]:
    errors: list[str] = []
    examples_root = _REPO_ROOT / "examples"

    # Profile A: core reasoning
    if not any((examples_root / "reasoning").glob("*.json")):
        errors.append("ProfileA failed: examples/reasoning/ must contain at least one fixture")

    # Profile B: tool + verifier sidecars
    if not any((examples_root / "tool_invocation").glob("*.json")):
        errors.append("ProfileB failed: examples/tool_invocation/ must contain at least one fixture")
    if not any((examples_root / "verifier_output").glob("*.json")):
        errors.append("ProfileB failed: examples/verifier_output/ must contain at least one fixture")

    # Profile C: dataset packaging
    if not (examples_root / "dataset_packaging" / "manifest.json").is_file():
        errors.append("ProfileC failed: examples/dataset_packaging/manifest.json is required")

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
    parser.add_argument("--skip-conformance", action="store_true", help="Skip conformance profile checks")
    args = parser.parse_args()

    resolver = SchemaResolver(_REPO_ROOT)
    if not resolver.registry_path.is_file():
        print("Missing schemas/registry.json — run: python3 tools/sync_schemas_from_rfcs.py", file=sys.stderr)
        return 1

    dups = duplicate_rfc_ids()
    if dups:
        rendered = ", ".join(f"{rfc_id}({len(paths)})" for rfc_id, paths in sorted(dups.items()))
        print(f"Duplicate RFC ids detected: {rendered}", file=sys.stderr)
        return 1

    reg, loaded = _build_registry()
    errs = _check_meta_schemas(loaded)
    errs += _check_refs(resolver, loaded)
    if not args.no_examples:
        errs += _validate_examples(resolver, reg)
        errs += _check_tier_a_example_coverage()
    if not args.skip_conformance:
        errs += _check_conformance_profiles()
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
