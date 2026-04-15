#!/usr/bin/env python3
"""Seed one GitHub Discussion thread per RFC and write a mapping index."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
RFCS_DIR = REPO_ROOT / "rfcs"
DEFAULT_OUTPUT = REPO_ROOT / "docs" / "rfc-discussion-index.json"

RFC_HEADING_RE = re.compile(r"^# RFC (\d{4}) — (.+?)\s*(?:\(|$)")


@dataclass(frozen=True)
class RfcEntry:
    rfc_id: str
    title: str
    path: Path

    @property
    def discussion_title(self) -> str:
        return f"RFC {self.rfc_id} — {self.title}"


def _gh_api_graphql(query: str, variables: dict[str, str] | None = None) -> dict[str, Any]:
    cmd = ["gh", "api", "graphql", "-f", f"query={query}"]
    for key, value in (variables or {}).items():
        cmd.extend(["-f", f"{key}={value}"])
    # cmd is constructed from fixed tokens plus explicit CLI args/GraphQL payload values.
    out = subprocess.check_output(cmd, cwd=REPO_ROOT, text=True)  # noqa: S603
    return json.loads(out)


def _load_rfcs() -> list[RfcEntry]:
    entries: list[RfcEntry] = []
    for path in sorted(RFCS_DIR.glob("*.md")):
        first = path.read_text(encoding="utf-8").splitlines()[0]
        m = RFC_HEADING_RE.match(first.strip())
        if not m:
            raise RuntimeError(f"RFC heading not recognized in {path}")
        entries.append(RfcEntry(rfc_id=m.group(1), title=m.group(2).strip(), path=path))
    return entries


def _fetch_repo_categories(owner: str, name: str) -> tuple[str, dict[str, str]]:
    query = """
query($owner:String!, $name:String!) {
  repository(owner:$owner, name:$name) {
    id
    discussionCategories(first:20) { nodes { id slug name } }
  }
}
"""
    data = _gh_api_graphql(query, {"owner": owner, "name": name})["data"]["repository"]
    categories = {node["slug"]: node["id"] for node in data["discussionCategories"]["nodes"]}
    return data["id"], categories


def _fetch_existing_discussions(owner: str, name: str) -> dict[str, str]:
    query = """
query($owner:String!, $name:String!) {
  repository(owner:$owner, name:$name) {
    discussions(first:100, orderBy:{field:CREATED_AT, direction:DESC}) {
      nodes { title url }
    }
  }
}
"""
    nodes = _gh_api_graphql(query, {"owner": owner, "name": name})["data"]["repository"]["discussions"]["nodes"]
    return {node["title"]: node["url"] for node in nodes}


def _create_discussion(repo_id: str, category_id: str, title: str, body: str) -> str:
    mutation = """
mutation($repoId:ID!, $categoryId:ID!, $title:String!, $body:String!) {
  createDiscussion(input:{
    repositoryId:$repoId,
    categoryId:$categoryId,
    title:$title,
    body:$body
  }) {
    discussion { url }
  }
}
"""
    data = _gh_api_graphql(
        mutation,
        {
            "repoId": repo_id,
            "categoryId": category_id,
            "title": title,
            "body": body,
        },
    )
    return data["data"]["createDiscussion"]["discussion"]["url"]


def _discussion_body(entry: RfcEntry, owner: str, repo: str) -> str:
    rel_path = entry.path.relative_to(REPO_ROOT)
    rfc_url = f"https://github.com/{owner}/{repo}/blob/main/{rel_path.as_posix()}"
    return f"""## RFC Discussion Thread

This thread is the canonical feedback channel for **RFC {entry.rfc_id}**.

- RFC: [{entry.path.name}]({rfc_url})
- Topic: {entry.title}

## Why this discussion is open

We want implementation feedback before locking long-term semantics. Use this thread to propose clarifications, identify interoperability risks, and surface migration concerns.

## Feedback prompts

1. Is the scope of this RFC clear and appropriately bounded?
2. Are there compatibility or migration risks not currently documented?
3. Are there better defaults for interoperability across tools or model stacks?
4. Which acceptance criteria or examples should be strengthened?

Please keep feedback concrete and, where possible, include examples or implementation evidence.
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--owner", default="supernovae")
    parser.add_argument("--repo", default="open-cot")
    parser.add_argument("--category-slug", default="ideas")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    rfcs = _load_rfcs()
    repo_id, categories = _fetch_repo_categories(args.owner, args.repo)
    if args.category_slug not in categories:
        raise SystemExit(
            f"Discussion category '{args.category_slug}' not found. Available: {', '.join(sorted(categories))}"
        )
    category_id = categories[args.category_slug]

    existing = _fetch_existing_discussions(args.owner, args.repo)
    mapping: dict[str, dict[str, str]] = {}

    for entry in rfcs:
        title = entry.discussion_title
        url = existing.get(title)
        if url is None:
            url = _create_discussion(
                repo_id=repo_id,
                category_id=category_id,
                title=title,
                body=_discussion_body(entry, args.owner, args.repo),
            )
            print(f"created: {title} -> {url}")
        else:
            print(f"exists:  {title} -> {url}")

        mapping[entry.rfc_id] = {
            "rfc_title": entry.title,
            "rfc_path": entry.path.relative_to(REPO_ROOT).as_posix(),
            "discussion_title": title,
            "discussion_url": url,
        }

    payload = {
        "repository": f"{args.owner}/{args.repo}",
        "category_slug": args.category_slug,
        "count": len(mapping),
        "rfcs": mapping,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote mapping: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
