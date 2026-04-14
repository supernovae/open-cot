from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_sync_and_validate_tools() -> None:
    root = Path(__file__).resolve().parents[1]
    sync = root / "tools" / "sync_schemas_from_rfcs.py"
    validate = root / "tools" / "validate.py"
    subprocess.run([sys.executable, str(sync)], check=True, cwd=root)
    subprocess.run([sys.executable, str(validate)], check=True, cwd=root)
