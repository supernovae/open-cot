#!/usr/bin/env python3
"""Compare two JSON Schema trees and report likely breaking changes.

Detects:
  - removed top-level or nested properties
  - removed entries from \"required\" arrays
  - changed JSON Schema \"type\" (single string or sorted tuple of strings)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


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


def _compare(
    before: Any,
    after: Any,
    path: str,
    *,
    breaking: list[str],
) -> None:
    if not isinstance(before, dict) or not isinstance(after, dict):
        if type(before) is not type(after):
            breaking.append(f"{path}: root structure type changed")
        return

    bt = _norm_type(before.get("type"))
    at = _norm_type(after.get("type"))
    if bt and at and bt != at:
        breaking.append(f"{path}: type {bt!r} -> {at!r}")

    b_req = set(_required_list(before))
    a_req = set(_required_list(after))
    for name in sorted(b_req - a_req):
        breaking.append(f"{path}: removed from required: {name!r}")

    b_props = _props(before)
    a_props = _props(after)
    for key in sorted(set(b_props) - set(a_props)):
        breaking.append(f"{path}: removed property {key!r}")

    for key in sorted(set(b_props) & set(a_props)):
        bp = b_props[key]
        ap = a_props[key]
        sub = f"{path}.properties.{key}"
        if isinstance(bp, dict) and isinstance(ap, dict):
            _compare_props_object(bp, ap, sub, breaking=breaking)
        elif isinstance(bp, dict) != isinstance(ap, dict):
            breaking.append(f"{sub}: property shape changed (object vs non-object)")


def _compare_props_object(before: dict[str, Any], after: dict[str, Any], path: str, *, breaking: list[str]) -> None:
    bt = _norm_type(before.get("type"))
    at = _norm_type(after.get("type"))
    if bt and at and bt != at:
        breaking.append(f"{path}: type {bt!r} -> {at!r}")

    b_req = set(_required_list(before))
    a_req = set(_required_list(after))
    for name in sorted(b_req - a_req):
        breaking.append(f"{path}: removed from required: {name!r}")

    b_props = _props(before)
    a_props = _props(after)
    for key in sorted(set(b_props) - set(a_props)):
        breaking.append(f"{path}: removed property {key!r}")

    for key in sorted(set(b_props) & set(a_props)):
        bp = b_props[key]
        ap = a_props[key]
        sub = f"{path}.properties.{key}"
        if isinstance(bp, dict) and isinstance(ap, dict):
            _compare_props_object(bp, ap, sub, breaking=breaking)


def load_schema(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def compare_files(before: Path, after: Path) -> list[str]:
    breaking: list[str] = []
    _compare(load_schema(before), load_schema(after), before.name, breaking=breaking)
    return breaking


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path, help="Directory or JSON file (old)")
    parser.add_argument("after", type=Path, help="Directory or JSON file (new)")
    parser.add_argument("--strict", action="store_true", help="Exit 1 if any breaking change")
    args = parser.parse_args()

    all_breaking: list[str] = []
    if args.before.is_file() and args.after.is_file():
        all_breaking.extend(compare_files(args.before, args.after))
    elif args.before.is_dir() and args.after.is_dir():
        b_names = {p.name for p in args.before.glob("*.json")}
        a_names = {p.name for p in args.after.glob("*.json")}
        for removed in sorted((b_names - a_names) - {"registry.json"}):
            all_breaking.append(f"{removed}: schema file removed")
        for name in sorted((b_names & a_names) - {"registry.json"}):
            all_breaking.extend(compare_files(args.before / name, args.after / name))
    else:
        print("before and after must both be files or both be directories", file=sys.stderr)
        return 2

    if not all_breaking:
        print("No breaking changes detected (heuristic).", file=sys.stderr)
        return 0
    for line in all_breaking:
        print(line)
    return 1 if args.strict else 0


if __name__ == "__main__":
    raise SystemExit(main())
