#!/usr/bin/env python3
"""Resolve Open CoT schema $id and file paths via schemas/registry.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urldefrag, urlparse

_TOOLS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _TOOLS_DIR.parent
if str(_TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOLS_DIR))

from schema_lib import load_registry, registry_schema_paths


class SchemaResolver:
    """Map shortnames and $id URLs to absolute schema paths and loaded objects."""

    def __init__(self, repo_root: Path | None = None) -> None:
        self.repo_root = repo_root or _REPO_ROOT
        self.registry_path = self.repo_root / "schemas" / "registry.json"
        self.schemas_dir = self.repo_root / "schemas"
        self._registry = load_registry() if self.registry_path.is_file() else {"schemas": {}}
        self.shortname_to_relpath: dict[str, str] = registry_schema_paths(self._registry)
        self._by_id: dict[str, Path] = {}
        self._preload_ids()

    def _preload_ids(self) -> None:
        for path in sorted(self.schemas_dir.glob("rfc-*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            sid = data.get("$id")
            if isinstance(sid, str):
                self._by_id[sid] = path
                base, _frag = urldefrag(sid)
                self._by_id.setdefault(base, path)

    def path_for_shortname(self, shortname: str) -> Path:
        rel = self.shortname_to_relpath.get(shortname)
        if not rel:
            raise KeyError(f"Unknown schema shortname: {shortname!r}")
        return self.repo_root / rel

    def path_for_ref(self, ref: str, base_uri: str | None = None) -> Path | None:
        """Resolve a JSON Schema $ref (relative or absolute) to a local Path, if known."""
        ref_url, _frag = urldefrag(ref)
        if ref_url.startswith("http://") or ref_url.startswith("https://"):
            p = self._by_id.get(ref_url)
            if p:
                return p
            parsed = urlparse(ref_url)
            tail = parsed.path.rsplit("/", 1)[-1]
            cand = self.schemas_dir / tail
            if cand.is_file():
                return cand
            return None
        if ref_url.startswith("file://"):
            return Path(ref_url[7:])
        rel = Path(ref_url)
        if not rel.is_absolute() and base_uri:
            base_parsed = urlparse(base_uri)
            base_dir = base_parsed.path.rsplit("/", 1)[0]
            if base_dir.startswith("/"):
                parent = Path(base_dir)
            else:
                parent = self.schemas_dir
            cand = (parent / rel).resolve() if rel.parts and rel.parts[0] != ".." else self.schemas_dir / rel
            if cand.is_file():
                return cand
        cand = self.schemas_dir / rel
        if cand.is_file():
            return cand
        return None

    def load(self, shortname: str) -> dict[str, Any]:
        p = self.path_for_shortname(shortname)
        return json.loads(p.read_text(encoding="utf-8"))


def main() -> int:
    r = SchemaResolver()
    if len(sys.argv) < 2:
        print("Usage: schema_resolver.py <shortname>", file=sys.stderr)
        return 2
    data = r.load(sys.argv[1])
    print(json.dumps({"path": str(r.path_for_shortname(sys.argv[1])), "$id": data.get("$id")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
