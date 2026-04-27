#!/usr/bin/env python3
"""Compare two JSON Schema trees and report likely breaking changes.

Detections include:
  - removed properties / schema files
  - removed required fields
  - changed types
  - enum shrink
  - tighter numeric/string/array bounds
  - additionalProperties permissive -> strict
  - new/changed pattern or format constraints

Each finding is tagged with a schema-diff severity:
  - major (likely breaking)
  - minor (new optional capability)
  - patch (non-semantic or informational)

These severities inform, but do not automatically reconcile, registry semver bumps.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

SEVERITY_ORDER = {"patch": 0, "minor": 1, "major": 2}
PROPERTY_RENAMES = {
    "agent_id": "requester_id",
    "agents": "pipelines",
    "parent_agent_id": "parent_requester_id",
}


def _norm_type(t: Any) -> str | None:
    if t is None:
        return None
    if isinstance(t, str):
        return t
    if isinstance(t, list):
        return "|".join(sorted(str(x) for x in t))
    return str(t)


def _props(schema: Any) -> dict[str, Any]:
    if not isinstance(schema, dict):
        return {}
    p = schema.get("properties")
    return p if isinstance(p, dict) else {}


def _required_list(schema: Any) -> list[str]:
    if not isinstance(schema, dict):
        return []
    r = schema.get("required")
    if isinstance(r, list):
        return [str(x) for x in r]
    return []


def _record(findings: list[tuple[str, str]], severity: str, msg: str) -> None:
    findings.append((severity, msg))


def _renamed_properties(before_keys: set[str], after_keys: set[str]) -> dict[str, str]:
    return {
        before: after for before, after in PROPERTY_RENAMES.items() if before in before_keys and after in after_keys
    }


def _tightened_min(before: dict[str, Any], after: dict[str, Any], key: str) -> bool:
    b = before.get(key)
    a = after.get(key)
    return isinstance(b, (int, float)) and isinstance(a, (int, float)) and a > b


def _tightened_max(before: dict[str, Any], after: dict[str, Any], key: str) -> bool:
    b = before.get(key)
    a = after.get(key)
    return isinstance(b, (int, float)) and isinstance(a, (int, float)) and a < b


def _enum_shrink(before: dict[str, Any], after: dict[str, Any]) -> bool:
    b = before.get("enum")
    a = after.get("enum")
    if not isinstance(b, list) or not isinstance(a, list):
        return False
    bs = {json.dumps(x, sort_keys=True) for x in b}
    aset = {json.dumps(x, sort_keys=True) for x in a}
    return aset < bs


def _constraint_diffs(
    before: dict[str, Any], after: dict[str, Any], path: str, findings: list[tuple[str, str]]
) -> None:
    if _enum_shrink(before, after):
        _record(findings, "major", f"{path}: enum became more restrictive")

    for key in ("minimum", "exclusiveMinimum", "minLength", "minItems", "minProperties"):
        if _tightened_min(before, after, key):
            _record(findings, "major", f"{path}: tighter {key} ({before.get(key)} -> {after.get(key)})")

    for key in ("maximum", "exclusiveMaximum", "maxLength", "maxItems", "maxProperties"):
        if _tightened_max(before, after, key):
            _record(findings, "major", f"{path}: tighter {key} ({before.get(key)} -> {after.get(key)})")

    b_add = before.get("additionalProperties")
    a_add = after.get("additionalProperties")
    if b_add is True and a_add is False:
        _record(findings, "major", f"{path}: additionalProperties changed from true to false")

    b_pat = before.get("pattern")
    a_pat = after.get("pattern")
    if isinstance(a_pat, str):
        if not isinstance(b_pat, str):
            _record(findings, "major", f"{path}: pattern constraint added")
        elif a_pat != b_pat:
            _record(findings, "major", f"{path}: pattern constraint changed")

    b_fmt = before.get("format")
    a_fmt = after.get("format")
    if isinstance(a_fmt, str):
        if not isinstance(b_fmt, str):
            _record(findings, "major", f"{path}: format constraint added ({a_fmt})")
        elif a_fmt != b_fmt:
            _record(findings, "major", f"{path}: format changed ({b_fmt} -> {a_fmt})")


def _compare(before: Any, after: Any, path: str, *, findings: list[tuple[str, str]]) -> None:
    if not isinstance(before, dict) or not isinstance(after, dict):
        if type(before) is not type(after):
            _record(findings, "major", f"{path}: root structure type changed")
        return

    bt = _norm_type(before.get("type"))
    at = _norm_type(after.get("type"))
    if bt and at and bt != at:
        _record(findings, "major", f"{path}: type {bt!r} -> {at!r}")

    b_req = set(_required_list(before))
    a_req = set(_required_list(after))
    required_renames = _renamed_properties(b_req, a_req)
    renamed_before_required = set(required_renames)
    renamed_after_required = set(required_renames.values())
    for name in sorted((b_req - a_req) - renamed_before_required):
        _record(findings, "major", f"{path}: removed from required: {name!r}")
    for name in sorted((a_req - b_req) - renamed_after_required):
        _record(findings, "minor", f"{path}: added to required: {name!r}")

    b_props = _props(before)
    a_props = _props(after)
    property_renames = _renamed_properties(set(b_props), set(a_props))
    renamed_before_props = set(property_renames)
    renamed_after_props = set(property_renames.values())
    for key in sorted((set(b_props) - set(a_props)) - renamed_before_props):
        _record(findings, "major", f"{path}: removed property {key!r}")
    for key in sorted((set(a_props) - set(b_props)) - renamed_after_props):
        _record(findings, "minor", f"{path}: added property {key!r}")

    _constraint_diffs(before, after, path, findings)

    for key in sorted(set(b_props) & set(a_props)):
        bp = b_props[key]
        ap = a_props[key]
        sub = f"{path}.properties.{key}"
        if isinstance(bp, dict) and isinstance(ap, dict):
            _compare(bp, ap, sub, findings=findings)
        elif isinstance(bp, dict) != isinstance(ap, dict):
            _record(findings, "major", f"{sub}: property shape changed (object vs non-object)")

    for before_key, after_key in sorted(property_renames.items()):
        bp = b_props[before_key]
        ap = a_props[after_key]
        sub = f"{path}.properties.{before_key}->{after_key}"
        if isinstance(bp, dict) and isinstance(ap, dict):
            _compare(bp, ap, sub, findings=findings)
        elif isinstance(bp, dict) != isinstance(ap, dict):
            _record(findings, "major", f"{sub}: property shape changed (object vs non-object)")

    # Recurse into item and additionalProperties schemas when both are schema objects.
    b_items = before.get("items")
    a_items = after.get("items")
    if isinstance(b_items, dict) and isinstance(a_items, dict):
        _compare(b_items, a_items, f"{path}.items", findings=findings)

    b_add = before.get("additionalProperties")
    a_add = after.get("additionalProperties")
    if isinstance(b_add, dict) and isinstance(a_add, dict):
        _compare(b_add, a_add, f"{path}.additionalProperties", findings=findings)


def load_schema(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def schema_identity(path: Path) -> str:
    data = load_schema(path)
    meta = data.get("x-opencot") if isinstance(data, dict) else None
    rfc = meta.get("rfc") if isinstance(meta, dict) else None
    return f"rfc:{rfc}" if isinstance(rfc, str) and rfc else f"name:{path.name}"


def index_schema_dir(path: Path) -> dict[str, Path]:
    indexed: dict[str, Path] = {}
    for schema_path in path.glob("*.json"):
        if schema_path.name == "registry.json":
            continue
        identity = schema_identity(schema_path)
        if identity in indexed:
            raise RuntimeError(f"Duplicate schema identity {identity!r}: {indexed[identity].name}, {schema_path.name}")
        indexed[identity] = schema_path
    return indexed


def compare_files(before: Path, after: Path) -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    _compare(load_schema(before), load_schema(after), before.name, findings=findings)
    return findings


def _should_fail(findings: list[tuple[str, str]], min_severity: str) -> bool:
    threshold = SEVERITY_ORDER[min_severity]
    return any(SEVERITY_ORDER[s] >= threshold for s, _ in findings)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path, help="Directory or JSON file (old)")
    parser.add_argument("after", type=Path, help="Directory or JSON file (new)")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero if findings meet threshold")
    parser.add_argument(
        "--min-severity",
        choices=("patch", "minor", "major"),
        default="major",
        help="Threshold for --strict failures (default: major)",
    )
    args = parser.parse_args()

    findings: list[tuple[str, str]] = []
    if args.before.is_file() and args.after.is_file():
        findings.extend(compare_files(args.before, args.after))
    elif args.before.is_dir() and args.after.is_dir():
        before_index = index_schema_dir(args.before)
        after_index = index_schema_dir(args.after)
        for removed in sorted(set(before_index) - set(after_index)):
            findings.append(("major", f"{before_index[removed].name}: schema file removed"))
        for added in sorted(set(after_index) - set(before_index)):
            findings.append(("minor", f"{after_index[added].name}: schema file added"))
        for identity in sorted(set(before_index) & set(after_index)):
            findings.extend(compare_files(before_index[identity], after_index[identity]))
    else:
        print("before and after must both be files or both be directories", file=sys.stderr)
        return 2

    if not findings:
        print("No schema compatibility findings.", file=sys.stderr)
        return 0

    # Sort high severity first for easy review.
    findings.sort(key=lambda x: SEVERITY_ORDER[x[0]], reverse=True)
    for severity, msg in findings:
        print(f"{severity}: {msg}")

    if args.strict and _should_fail(findings, args.min_severity):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
