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

from schema_lib import (  # noqa: E402
    REGISTRY_PATH,
    REPO_ROOT,
    RFC_SHORTNAME,
    SCHEMAS_DIR,
    annotate_schema,
    duplicate_rfc_ids,
    extract_marked_schema_with_schema_key,
    rfc_markdown_path,
    schema_filename,
    schema_relative_path,
)


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def main() -> int:
    dups = duplicate_rfc_ids()
    if dups:
        rendered = ", ".join(f"{rfc_id}({len(paths)})" for rfc_id, paths in sorted(dups.items()))
        raise RuntimeError(f"Duplicate RFC ids detected: {rendered}")

    SCHEMAS_DIR.mkdir(parents=True, exist_ok=True)
    for stale in SCHEMAS_DIR.glob("rfc-*.json"):
        stale.unlink()
    registry_schemas: dict[str, str] = {}

    for rfc_id, shortname in sorted(RFC_SHORTNAME.items()):
        md_path = rfc_markdown_path(rfc_id)
        rel = str(md_path.relative_to(REPO_ROOT))
        text = md_path.read_text(encoding="utf-8")
        data = extract_marked_schema_with_schema_key(text)
        if data is None:
            raise RuntimeError(
                f"RFC {rfc_id} requires an explicit schema block with $schema between opencot:schema markers."
            )

        data = annotate_schema(data, rfc_id=rfc_id, shortname=shortname, source_relpath=rel)
        out_path = SCHEMAS_DIR / schema_filename(rfc_id, shortname)
        _write_json(out_path, data)
        registry_schemas[shortname] = schema_relative_path(rfc_id, shortname)

    reg = {
        "version": "2.0",
        "description": "Registry of Open CoT cognitive interface schemas extracted from normative RFC blocks.",
        "schemas": dict(sorted(registry_schemas.items(), key=lambda kv: kv[1])),
    }
    _write_json(REGISTRY_PATH, reg)
    print(f"Wrote {len(registry_schemas)} schemas and registry to {SCHEMAS_DIR}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
