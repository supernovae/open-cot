#!/usr/bin/env bash
# Regenerate schemas from RFCs; fail if working tree differs (schemas must be committed).
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
PY="python3"
if [[ -x "${ROOT}/.venv/bin/python" ]]; then
  PY="${ROOT}/.venv/bin/python"
fi
"$PY" tools/sync_schemas_from_rfcs.py
if [[ -n "$(git status --porcelain -- schemas/)" ]]; then
  echo "schemas/ differs from git after sync (stage and commit, or fix RFCs)." >&2
  git --no-pager diff -- schemas/ 2>/dev/null || true
  git status --porcelain -- schemas/
  exit 1
fi
