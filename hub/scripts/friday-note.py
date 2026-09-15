#!/usr/bin/env python3
"""Print a compact Friday update from hub content."""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from hublib import monday_for, parse_client_name, parse_date, read_frontmatter


def text_items(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("Friday note list fields must be lists")
    return [str(item).strip().rstrip(".") for item in value if str(item).strip()]


def latest_update(hub: Path) -> tuple[dict[str, Any], date]:
    candidates = []
    for path in (hub / "src/content/updates").glob("*.md"):
        data, _ = read_frontmatter(path)
        candidates.append((parse_date(data["weekOf"]), data))
    if not candidates:
        raise ValueError("No update Markdown files found")
    week, data = max(candidates, key=lambda item: item[0])
    return data, week


def from_cards(hub: Path, days: int) -> tuple[dict[str, list[str]], date]:
    today = date.today()
    cutoff = today - timedelta(days=days)
    cards = []
    for path in (hub / "src/content/cards").glob("*.md"):
        data, _ = read_frontmatter(path)
        cards.append(data)
    shipped = [
        str(card["title"]).strip().rstrip(".")
        for card in cards
        if card.get("doneAt") and cutoff <= parse_date(card["doneAt"]) <= today
    ]
    active = [card for card in cards if card.get("status") in {"doing", "todo"}]
    active.sort(key=lambda card: (0 if card.get("status") == "doing" else 1, int(card.get("order", 0))))
    next_week = [str(card["title"]).strip().rstrip(".") for card in active[:3]]
    needs = []
    for path in (hub / "src/content/scoreboard").glob("*.md"):
        item, _ = read_frontmatter(path)
        if item.get("direction") == "you-owe" and item.get("done") is False:
            needs.append(str(item["title"]).strip().rstrip("."))
    return {"shipped": shipped, "decided": [], "nextWeek": next_week, "needFromYou": needs}, monday_for(today)


def render(name: str, week: date, data: dict[str, Any], url: str) -> str:
    shipped = "; ".join(text_items(data.get("shipped"))) or "nothing"
    decided = "; ".join(text_items(data.get("decided"))) or "nothing"
    next_week = "; ".join(text_items(data.get("nextWeek"))) or "nothing"
    needs = "; ".join(text_items(data.get("needFromYou"))) or "nothing"
    return "\n".join([
        f"{name}, week of {week.strftime('%b %d')}.",
        f"Shipped: {shipped}.",
        f"Decided: {decided}.",
        f"Next week: {next_week}.",
        f"Need from you: {needs}.",
        f"Hub: {url}",
    ])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hub", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--from-cards", action="store_true")
    parser.add_argument("--url", required=True)
    parser.add_argument("--days", type=int, default=7)
    args = parser.parse_args(argv)
    if args.days < 0:
        parser.error("--days must not be negative")
    hub = args.hub.expanduser().resolve()
    name = parse_client_name(hub / "hub.config.ts")
    try:
        if args.from_cards:
            data, week = from_cards(hub, args.days)
        else:
            data, week = latest_update(hub)
    except (ValueError, FileNotFoundError) as exc:
        print(f"friday-note: {exc}. Add a file under src/content/updates/ or use --from-cards.", file=sys.stderr)
        return 1
    note = render(name, week, data, args.url)
    print(note)
    words = len(re.findall(r"\b[\w']+\b", note))
    if words > 100:
        print(f"WARNING: {words} words, target is under 100", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
