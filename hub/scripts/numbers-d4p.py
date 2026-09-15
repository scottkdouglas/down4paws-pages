#!/usr/bin/env python3
"""Import D4P number cards from a manual JSON file."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


# TODO v2:
# - Read lead and conversion metrics through a Google Sheets service account.
# - Read newsletter open-rate metrics from the Kit API.
# - Normalize both sources before writing the existing number card schema.


def main() -> int:
    scripts = Path(__file__).resolve().parent
    command = [
        sys.executable,
        str(scripts / "numbers-manual.py"),
        "--input",
        str(scripts / "numbers.d4p.json"),
        *sys.argv[1:],
    ]
    return subprocess.call(command)


if __name__ == "__main__":
    sys.exit(main())
