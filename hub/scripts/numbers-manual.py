#!/usr/bin/env python3
"""Import manually maintained number cards."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from hublib import load_json, write_number_cards


def main(argv: list[str] | None = None) -> int:
    repo_root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=repo_root / "scripts/numbers.manual.json")
    parser.add_argument("--out", type=Path, default=repo_root / "src/content/numbers")
    args = parser.parse_args(argv)
    entries = load_json(args.input.expanduser().resolve())
    if not isinstance(entries, list) or not all(isinstance(item, dict) for item in entries):
        parser.error("input must be a JSON list of objects")
    if any("delta" in item for item in entries):
        parser.error("input objects must not contain delta")
    write_number_cards(entries, args.out.expanduser().resolve())
    return 0


if __name__ == "__main__":
    sys.exit(main())
