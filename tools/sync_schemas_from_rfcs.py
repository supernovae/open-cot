#!/usr/bin/env python3
"""Extract or generate JSON Schemas from rfcs/*.md and write schemas/ + registry.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

_TOOLS_DIR = Path(__file__).resolve().parent
if str(_TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOLS_DIR))

from schema_lib import (
    RFC_SHORTNAME,
    REPO_ROOT,
    SCHEMAS_DIR,
    REGISTRY_PATH,
    annotate_schema,
    extract_first_brace_object_after,
    extract_first_json_object_with_schema,
    rfc_markdown_path,
    schema_filename,
    schema_relative_path,
)


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def build_branching_schema(rfc_id: str) -> dict[str, Any]:
    text = rfc_markdown_path(rfc_id).read_text(encoding="utf-8")
    frag = extract_first_brace_object_after(text, "```json")
    if not isinstance(frag, dict):
        raise RuntimeError("RFC 0004: could not parse branching fragment")
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Open CoT RFC 0004 — Branching / ToT / GoT step extensions",
        "description": (
            "Optional fields extending RFC 0001 reasoning steps. "
            "Valid step objects SHOULD satisfy RFC 0001 and MAY include any of these properties."
        ),
        "type": "object",
        "properties": frag,
        "additionalProperties": True,
    }


def build_agent_loop_schema() -> dict[str, Any]:
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Open CoT RFC 0007 — Agent loop protocol trace",
        "description": (
            "Reasoning trace emitted by an agent loop (RFC 0007). "
            "Extends RFC 0001 with optional tool_invocation on action steps (RFC 0003)."
        ),
        "allOf": [
            {"$ref": "rfc-0001-reasoning.json"},
            {
                "type": "object",
                "properties": {
                    "steps": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "tool_invocation": {
                                    "type": "object",
                                    "description": "Structured tool call when type is action (RFC 0003).",
                                }
                            },
                        },
                    }
                },
            },
        ],
    }


def build_dataset_packaging_schema() -> dict[str, Any]:
    """Manifest + $defs for optional metadata files (RFC 0008)."""
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Open CoT RFC 0008 — Dataset package manifest",
        "description": "manifest.json for a packaged reasoning dataset (RFC 0008).",
        "type": "object",
        "required": ["version", "name", "description", "schemas", "counts", "splits", "created_at", "license"],
        "properties": {
            "version": {"type": "string"},
            "name": {"type": "string"},
            "description": {"type": "string"},
            "schemas": {
                "type": "object",
                "additionalProperties": {"type": "string"},
                "description": "Declared Open CoT sub-schema versions for packaged artifacts.",
            },
            "counts": {
                "type": "object",
                "additionalProperties": {"type": "integer", "minimum": 0},
            },
            "splits": {
                "type": "array",
                "items": {"type": "string"},
            },
            "created_at": {"type": "string", "format": "date-time"},
            "license": {"type": "string"},
        },
        "$defs": {
            "dataset_metadata": {
                "type": "object",
                "properties": {
                    "domain": {"type": "string"},
                    "source": {"type": "string"},
                    "language": {"type": "string"},
                    "num_tokens": {"type": "integer", "minimum": 0},
                },
                "additionalProperties": True,
            },
            "splits_map": {
                "type": "object",
                "additionalProperties": {
                    "type": "array",
                    "items": {"type": "string"},
                },
            },
        },
    }


def stub_schema(rfc_id: str, shortname: str, title: str) -> dict[str, Any]:
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": title,
        "description": (
            f"Placeholder JSON Schema for RFC {rfc_id}. "
            "The RFC does not yet contain an extractable JSON Schema block; evolve this file as the RFC stabilizes."
        ),
        "type": "object",
        "additionalProperties": True,
        "x-opencot": {"rfc": rfc_id, "shortname": shortname, "status": "stub"},
    }


def main() -> int:
    SCHEMAS_DIR.mkdir(parents=True, exist_ok=True)
    for stale in SCHEMAS_DIR.glob("rfc-*.json"):
        stale.unlink()
    registry_schemas: dict[str, str] = {}

    for rfc_id, shortname in sorted(RFC_SHORTNAME.items()):
        md_path = rfc_markdown_path(rfc_id)
        rel = str(md_path.relative_to(REPO_ROOT))
        title = f"RFC {rfc_id} — {shortname.replace('_', ' ').title()} (stub)"

        data: dict[str, Any] | None = None

        if rfc_id == "0004":
            data = build_branching_schema(rfc_id)
        elif rfc_id == "0007":
            data = build_agent_loop_schema()
        elif rfc_id == "0008":
            data = build_dataset_packaging_schema()
        else:
            text = md_path.read_text(encoding="utf-8")
            data = extract_first_json_object_with_schema(text)

        if data is None:
            data = stub_schema(rfc_id, shortname, title)

        data = annotate_schema(data, rfc_id=rfc_id, shortname=shortname, source_relpath=rel)
        out_path = SCHEMAS_DIR / schema_filename(rfc_id, shortname)
        _write_json(out_path, data)
        registry_schemas[shortname] = schema_relative_path(rfc_id, shortname)

    reg = {
        "version": "1.0",
        "description": "Registry of Open CoT JSON Schemas extracted from or aligned with RFCs.",
        "schemas": dict(sorted(registry_schemas.items(), key=lambda kv: kv[1])),
    }
    _write_json(REGISTRY_PATH, reg)
    print(f"Wrote {len(registry_schemas)} schemas and registry to {SCHEMAS_DIR}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
