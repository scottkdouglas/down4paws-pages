#!/usr/bin/env python3
"""Build Fight Fitness number cards from dashboard snapshots."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from hublib import format_difference, load_json, write_json


DEFAULT_SNAPSHOTS = Path("/Users/scottdouglas/Documents/ClaudeCode/ActiveProjects/FightFit/close-rate-dashboard/snapshots")
METRICS = [
    ("show-rate", "Show rate", "show_rate_pct", True),
    ("close-rate", "Close rate", "close_rate_pct", True),
    ("appointments", "Appointments", "appointments", False),
    ("closed", "Closed", "closed", False),
]


def render_value(value: object, percent: bool) -> str:
    if percent:
        return f"{float(value):.1f}%"
    return str(value)


def build_cards(snapshot_dir: Path, out_dir: Path) -> None:
    paths = sorted(snapshot_dir.glob("*.json"))
    if not paths:
        raise ValueError(f"No snapshots found in {snapshot_dir}")
    newest = load_json(paths[-1])
    older = load_json(paths[-2]) if len(paths) > 1 else None
    window = newest["window"]
    for order, (card_id, label, key, percent) in enumerate(METRICS, 1):
        current_value = render_value(newest["totals"][key], percent)
        card = {
            "id": card_id,
            "label": label,
            "value": current_value,
            "note": f"Window {window['start']} to {window['end']}",
            "source": "GHL",
            "asOf": window["end"],
            "order": order,
            "group": "Orientation funnel",
        }
        if older is not None:
            previous_value = render_value(older["totals"][key], percent)
            change = format_difference(current_value, previous_value)
            if change:
                card["delta"] = {"value": change[0], "direction": change[1], "period": "vs prior week"}
        write_json(out_dir / f"{card_id}.json", card)


def main(argv: list[str] | None = None) -> int:
    repo_root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshots", type=Path, default=DEFAULT_SNAPSHOTS)
    parser.add_argument("--out", type=Path, default=repo_root / "src/content/numbers")
    args = parser.parse_args(argv)
    build_cards(args.snapshots.expanduser().resolve(), args.out.expanduser().resolve())
    return 0


if __name__ == "__main__":
    sys.exit(main())
