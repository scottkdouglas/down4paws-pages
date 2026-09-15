"""Shared helpers for Client Hub maintenance scripts."""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterable

import yaml


DATE_FORMAT = "%Y-%m-%d"


def parse_date(value: Any) -> date:
    """Return a date from a YAML value or ISO date string."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return datetime.strptime(str(value), DATE_FORMAT).date()


def iso_date(value: Any) -> str:
    return parse_date(value).isoformat()


def monday_for(value: date | None = None) -> date:
    value = value or date.today()
    return value - timedelta(days=value.weekday())


def read_frontmatter(path: Path) -> tuple[dict[str, Any], str]:
    """Read YAML frontmatter and body from a Markdown file."""
    text = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\s*\n(.*?)\n---\s*(?:\n|\Z)(.*)\Z", text, re.DOTALL)
    if not match:
        raise ValueError(f"Missing YAML frontmatter in {path}")
    data = yaml.safe_load(match.group(1)) or {}
    if not isinstance(data, dict):
        raise ValueError(f"Frontmatter must be a mapping in {path}")
    return data, match.group(2).strip()


def write_frontmatter(path: Path, data: dict[str, Any], body: str = "") -> None:
    """Write a Markdown file with YAML frontmatter and an optional body."""
    path.parent.mkdir(parents=True, exist_ok=True)
    yaml_text = yaml.safe_dump(data, sort_keys=False, allow_unicode=True).rstrip()
    content = f"---\n{yaml_text}\n---\n"
    if body:
        content += f"{body.rstrip()}\n"
    path.write_text(content, encoding="utf-8")


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def parse_client_name(config_path: Path) -> str:
    """Extract client.name from the client object in hub.config.ts."""
    text = config_path.read_text(encoding="utf-8")
    client = re.search(r"client\s*:\s*\{(?P<body>.*?)\}", text, re.DOTALL)
    if not client:
        raise ValueError(f"Could not find client block in {config_path}")
    name = re.search(r"\bname\s*:\s*'((?:\\'|[^'])*)'", client.group("body"))
    if not name:
        raise ValueError(f"Could not find client name in {config_path}")
    return name.group(1).replace("\\'", "'").replace("\\\\", "\\")


def numeric_value(value: Any) -> tuple[float, bool] | None:
    """Parse a plain number or percentage, allowing commas and surrounding text."""
    text = str(value).strip()
    match = re.search(r"[-+]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)", text)
    if not match:
        return None
    try:
        number = float(match.group(0).replace(",", ""))
    except ValueError:
        return None
    return number, text.endswith("%")


def format_difference(current: Any, previous: Any) -> tuple[str, str] | None:
    current_number = numeric_value(current)
    previous_number = numeric_value(previous)
    if current_number is None or previous_number is None:
        return None
    if current_number[1] != previous_number[1]:
        return None
    difference = current_number[0] - previous_number[0]
    if abs(difference) < 1e-12:
        difference = 0.0
    rendered = f"{difference:+g}"
    if current_number[1]:
        rendered += "%"
    direction = "up" if difference > 0 else "down" if difference < 0 else "flat"
    return rendered, direction


def write_number_cards(entries: Iterable[dict[str, Any]], out_dir: Path) -> None:
    """Write number cards and calculate changes from existing cards."""
    out_dir.mkdir(parents=True, exist_ok=True)
    for raw_entry in entries:
        entry = dict(raw_entry)
        card_id = str(entry.get("id", ""))
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", card_id):
            raise ValueError(f"Invalid number card id: {card_id!r}")
        destination = out_dir / f"{card_id}.json"
        if destination.exists():
            previous = load_json(destination)
            change = format_difference(entry.get("value"), previous.get("value"))
            if change:
                entry["delta"] = {
                    "value": change[0],
                    "direction": change[1],
                    "period": f"since {previous['asOf']}",
                }
        write_json(destination, entry)
