from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_conformance_fixture_matrix_validates() -> None:
    root = Path(__file__).resolve().parents[1]
    script = root / "tools" / "check_conformance_fixtures.py"
    subprocess.run(
        [
            sys.executable,
            str(script),
        ],
        check=True,
        cwd=root,
    )
