#!/usr/bin/env bash
# Run a command with the repo venv's Python when present, else python3.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
PY="python3"
if [[ -x "${ROOT}/.venv/bin/python" ]]; then
  PY="${ROOT}/.venv/bin/python"
fi
exec "$PY" "$@"
