"""Shared helpers for Open CoT schema paths, RFC mapping, and extraction from RFC markdown."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
RFCS_DIR = REPO_ROOT / "rfcs"
SCHEMAS_DIR = REPO_ROOT / "schemas"
REGISTRY_PATH = SCHEMAS_DIR / "registry.json"

# RFC id -> shortname (registry key). Filenames use shortname with underscores -> hyphens.
RFC_SHORTNAME: dict[str, str] = {
    "0001": "reasoning",
    "0002": "verifier_output",
    "0003": "tool_invocation",
    "0004": "branching",
    "0005": "reward",
    "0006": "ensemble",
    "0007": "agent_loop",
    "0008": "dataset_packaging",
    "0009": "reward_fusion",
    "0010": "agent_memory",
    "0011": "multi_agent_protocol",
    "0012": "dataset_streaming",
    "0013": "memory_compression",
    "0014": "memory_conflict_resolution",
    "0015": "multi_agent_reward_sharing",
    "0016": "tool_capability_negotiation",
    "0017": "agent_safety_sandboxing",
    "0018": "tool_error_taxonomy",
    "0019": "multi_agent_planning_graphs",
    "0020": "verifiable_scratchpad_compression",
    "0021": "agent_capability_declaration",
    "0022": "agent_evaluation_protocol",
    "0023": "human_in_the_loop",
    "0024": "multi_modal_reasoning",
    "0025": "tool_marketplace_registry",
    "0026": "agent_identity_auth",
    "0027": "distributed_agent_execution",
    "0028": "agent_environment",
    "0029": "agent_benchmark_dataset",
    "0030": "agent_lifecycle_versioning",
    "0031": "agent_observability_telemetry",
    "0032": "agent_deployment_manifest",
    "0033": "agent_security_threat_model",
    "0034": "agent_federation_protocol",
    "0035": "data_provenance_tracking",
    "0036": "agent_native_compression_delta",
    "0037": "token_economy_cost_modeling",
    "0038": "cost_aware_reasoning_budget",
    "0039": "tool_cost_modeling",
    "0040": "multi_agent_economic_incentives",
    "0041": "policy_enforcement",
    "0042": "permission_acl",
    "0043": "auditing_compliance_logs",
    "0044": "governance_organizational_controls",
    "0045": "ethics",
}


# Basename slugs (after rfc-NNNN-) aligned with schemas/registry.json conventions.
RFC_FILE_SLUG: dict[str, str] = {
    "0001": "reasoning",
    "0002": "verifier",
    "0003": "tool",
    "0004": "branching",
    "0005": "reward",
    "0006": "ensemble",
    "0007": "agent-loop",
    "0008": "dataset",
    "0009": "reward-fusion",
    "0010": "memory",
}


def schema_filename(rfc_id: str, shortname: str) -> str:
    slug = RFC_FILE_SLUG.get(rfc_id, shortname.replace("_", "-"))
    return f"rfc-{rfc_id}-{slug}.json"


def schema_relative_path(rfc_id: str, shortname: str) -> str:
    return f"schemas/{schema_filename(rfc_id, shortname)}"


def rfc_markdown_path(rfc_id: str) -> Path:
    """Return path rfcs/NNNN-*.md (first match)."""
    matches = sorted(RFCS_DIR.glob(f"{rfc_id}-*.md"))
    if not matches:
        raise FileNotFoundError(f"No RFC markdown for id {rfc_id}")
    return matches[0]


def extract_first_json_object_with_schema(text: str) -> dict[str, Any] | None:
    """Extract first JSON object that contains a top-level \"$schema\" key (brace-balanced)."""
    raw = _extract_first_json_object_raw(text)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def _extract_first_json_object_raw(text: str) -> str | None:
    i = text.find('"$schema"')
    if i == -1:
        return None
    start = text.rfind("{", 0, i)
    if start == -1:
        return None
    depth = 0
    in_str = False
    esc = False
    for j in range(start, len(text)):
        c = text[j]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start : j + 1]
    return None


def extract_first_brace_object_after(text: str, needle: str) -> dict[str, Any] | None:
    """After the first occurrence of needle, parse the first brace-balanced JSON object."""
    pos = text.find(needle)
    if pos == -1:
        return None
    sub = text[pos:]
    i = sub.find("{")
    if i == -1:
        return None
    raw = _brace_object_from(sub, i)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def _brace_object_from(text: str, start: int) -> str | None:
    depth = 0
    in_str = False
    esc = False
    for j in range(start, len(text)):
        c = text[j]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start : j + 1]
    return None


def extract_json_block_after_heading(text: str, heading_substring: str) -> dict[str, Any] | None:
    """Parse first ```json ... ``` block after a heading line containing heading_substring."""
    idx = text.find(heading_substring)
    if idx == -1:
        return None
    tail = text[idx:]
    m = re.search(r"```json\s*\n(.*?)```", tail, re.DOTALL)
    if not m:
        return None
    block = m.group(1).strip()
    try:
        return json.loads(block)
    except json.JSONDecodeError:
        return None


def annotate_schema(
    data: dict[str, Any],
    *,
    rfc_id: str,
    shortname: str,
    source_relpath: str,
) -> dict[str, Any]:
    """Attach $id and x-opencot metadata without clobbering existing $id."""
    out = dict(data)
    fname = schema_filename(rfc_id, shortname)
    base = f"https://opencot.dev/schemas/{fname}"
    out.setdefault("$id", base)
    meta = {
        "rfc": rfc_id,
        "shortname": shortname,
        "source_rfc": source_relpath,
    }
    existing = out.get("x-opencot")
    if isinstance(existing, dict):
        merged = {**existing, **meta}
        out["x-opencot"] = merged
    else:
        out["x-opencot"] = meta
    return out


def load_registry() -> dict[str, Any]:
    with REGISTRY_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def registry_schema_paths(registry: dict[str, Any]) -> dict[str, str]:
    return dict(registry.get("schemas") or {})
