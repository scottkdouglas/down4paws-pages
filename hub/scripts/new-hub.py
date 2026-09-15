#!/usr/bin/env python3
"""Create a client-specific hub from this Astro template."""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlparse


MODULES = ["board", "numbers", "scoreboard", "updates", "decisions", "deliverables", "recordings"]
LINK_GROUPS = {"live", "tools", "docs"}

EXAMPLES = {
    "cards": """---
title: Example card
status: todo
category: Strategy
owner: Client
due: 2026-09-30
doneAt: 2026-09-29
sprint: 1
nextSprint: false
links:
  - label: Reference
    href: https://example.com
order: 1
---
Card detail goes here.
""",
    "scoreboard": """---
title: Example commitment
direction: you-owe
source: Weekly call
due: 2026-09-30
done: false
doneAt: 2026-09-29
href: https://example.com
---
""",
    "updates": """---
weekOf: 2026-09-14
shipped:
  - First shipped item
decided:
  - First decision
nextWeek:
  - First next step
needFromYou:
  - First client request
---
Friday note text goes here.
""",
    "numbers": """{
  "id": "example-metric",
  "label": "Example metric",
  "value": "42%",
  "delta": {
    "value": "+3%",
    "direction": "up",
    "period": "since 2026-09-07"
  },
  "note": "Optional context",
  "source": "Manual",
  "asOf": "2026-09-14",
  "order": 1,
  "group": "Example group"
}
""",
}


def ts_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def valid_date(value: str) -> str:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as error:
        raise argparse.ArgumentTypeError("expected YYYY-MM-DD") from error
    return value


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return parsed


def parse_modules(value: str) -> list[str]:
    modules = [item.strip() for item in value.split(",") if item.strip()]
    invalid = sorted(set(modules) - set(MODULES))
    if invalid:
        raise argparse.ArgumentTypeError(f"invalid module ids: {', '.join(invalid)}")
    if not modules:
        raise argparse.ArgumentTypeError("at least one module is required")
    return modules


def parse_tags(value: str) -> list[tuple[str, str]]:
    if not value.strip():
        return []
    tags = []
    for item in value.split(","):
        try:
            tag_id, label = item.split(":", 1)
        except ValueError as error:
            raise argparse.ArgumentTypeError("tags must use id:Label") from error
        tag_id, label = tag_id.strip(), label.strip()
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", tag_id) or not label:
            raise argparse.ArgumentTypeError(f"invalid tag: {item}")
        tags.append((tag_id, label))
    return tags


def parse_link(value: str) -> tuple[str, str, str]:
    parts = [part.strip() for part in value.split("|")]
    if len(parts) != 3 or not all(parts):
        raise argparse.ArgumentTypeError("links must use Label|https://url|group")
    label, href, group = parts
    parsed = urlparse(href)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise argparse.ArgumentTypeError(f"invalid link URL: {href}")
    if group not in LINK_GROUPS:
        raise argparse.ArgumentTypeError(f"invalid link group: {group}")
    return label, href, group


def render_config(args: argparse.Namespace, logo_href: str) -> str:
    logo_bg = f", logoBackground: '{ts_string(args.logo_background)}'" if getattr(args, 'logo_background', None) else ''
    fav = getattr(args, 'favicon_href', None)
    logo_bg += f", favicon: '{fav}'" if fav else ''
    modules = ", ".join(f"'{ts_string(item)}'" for item in args.modules)
    tags = "\n".join(
        f"    {{ id: '{ts_string(tag_id)}', label: '{ts_string(label)}' }}," for tag_id, label in args.tags
    )
    links = "\n".join(
        f"    {{ label: '{ts_string(label)}', href: '{ts_string(href)}', group: '{group}' }},"
        for label, href, group in args.links
    )
    return f"""import type {{ HubConfig }} from '@/lib/types';

const hub = {{
  client: {{ name: '{ts_string(args.name)}', shortName: '{ts_string(args.short_name)}', slug: '{ts_string(args.slug)}', ownerName: '{ts_string(args.owner)}', ownerInitials: '{ts_string(args.initials)}', timezone: '{ts_string(args.timezone)}' }},
  agency: {{ name: 'SKD Media', initials: 'SD' }},
  brand: {{ logo: '{logo_href}', primary: '{ts_string(args.primary)}', secondary: '{ts_string(args.secondary)}'{logo_bg} }},
  sprint: {{ number: {args.sprint_number}, total: {args.sprint_total}, start: '{args.sprint_start}', lengthDays: {args.sprint_length} }},
  nextUpdateDay: '{ts_string(args.next_update)}',
  modules: [{modules}],
  serviceTags: [
{tags}
  ],
  links: [
{links}
  ],
}} satisfies HubConfig;

export default hub;
"""


def copy_ignore(template: Path):
    def ignore(directory: str, names: list[str]) -> set[str]:
        current = Path(directory)
        try:
            relative = current.relative_to(template)
        except ValueError:
            relative = Path()
        ignored = {name for name in names if name.startswith("sample-")}
        ignored.update(set(names) & {"node_modules", "dist", ".vercel", ".astro", ".git", "__pycache__", ".pytest_cache", ".DS_Store"})
        if relative == Path("scripts"):
            ignored.update(set(names) & {".venv", "tests", "__pycache__"})
        return ignored
    return ignore


def parser() -> argparse.ArgumentParser:
    repo_root = Path(__file__).resolve().parent.parent
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--template", type=Path, default=repo_root)
    result.add_argument("--dest", type=Path, required=True)
    result.add_argument("--name", required=True)
    result.add_argument("--short-name", required=True)
    result.add_argument("--slug", required=True)
    result.add_argument("--owner", required=True)
    result.add_argument("--initials", required=True)
    result.add_argument("--primary", required=True)
    result.add_argument("--secondary", required=True)
    result.add_argument("--logo-background", default=None, help="hex backdrop behind the logo, for logos drawn for dark sites")
    result.add_argument("--favicon", type=Path, default=None, help="square PNG or SVG for the browser tab; copied to public/favicon.<ext>")
    result.add_argument("--logo", type=Path, required=True)
    result.add_argument("--modules", type=parse_modules, default=MODULES)
    result.add_argument("--tags", type=parse_tags, default=[])
    result.add_argument("--links", type=parse_link, action="append", default=[])
    result.add_argument("--sprint-start", type=valid_date, default=date.today().isoformat())
    result.add_argument("--sprint-length", type=positive_int, default=90)
    result.add_argument("--sprint-number", type=positive_int, default=1)
    result.add_argument("--sprint-total", type=positive_int, default=3)
    result.add_argument("--timezone", default="America/Toronto")
    result.add_argument("--next-update", default="Monday")
    result.add_argument("--force", action="store_true")
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    args.template = args.template.expanduser().resolve()
    args.dest = args.dest.expanduser()
    if not args.dest.is_absolute():
        parser().error("--dest must be an absolute path")
    args.dest = args.dest.resolve()
    args.logo = args.logo.expanduser().resolve()
    if not args.template.is_dir():
        parser().error("--template must be a directory")
    if args.dest.exists() and not args.force:
        parser().error("--dest already exists, use --force to replace it")
    if not args.logo.is_file() or args.logo.suffix.lower() not in {".png", ".svg"}:
        parser().error("--logo must be an existing PNG or SVG file")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", args.slug):
        parser().error("--slug must contain lowercase letters, numbers, and hyphens")
    if args.dest.exists():
        template = args.template.resolve()
        protected = {Path("/"), Path.home(), template, *template.parents}
        if args.dest in protected or template in args.dest.parents:
            parser().error("--force refuses to delete that path (root, home, the template, or one of its ancestors or descendants)")
        if not (args.dest / "hub.config.ts").is_file():
            parser().error("--force only replaces a directory that already holds a hub.config.ts")
        shutil.rmtree(args.dest)
    shutil.copytree(args.template, args.dest, symlinks=True, ignore=copy_ignore(args.template))
    extension = args.logo.suffix.lower()
    logo_destination = args.dest / "public" / f"logo{extension}"
    logo_destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.logo, logo_destination)
    if getattr(args, 'favicon', None):
        fav_src = args.favicon.expanduser().resolve()
        if not fav_src.is_file() or fav_src.suffix.lower() not in {'.png', '.svg'}:
            parser().error('--favicon must be an existing PNG or SVG file')
        shutil.copy2(fav_src, args.dest / 'public' / f'favicon{fav_src.suffix.lower()}')
        args.favicon_href = f'/favicon{fav_src.suffix.lower()}'
    (args.dest / "hub.config.ts").write_text(render_config(args, f"/logo{extension}"), encoding="utf-8")
    for collection, example in EXAMPLES.items():
        directory = args.dest / "src" / "content" / collection
        directory.mkdir(parents=True, exist_ok=True)
        (directory / ".gitkeep").touch()
        suffix = "json" if collection == "numbers" else "md"
        (directory / f"_example.{suffix}.txt").write_text(example, encoding="utf-8")
    env_example = args.dest / ".env.example"
    if not env_example.exists():
        env_example.write_text("HUB_PASSWORD=\nHUB_COOKIE_SECRET=\nHUB_SLUG=\n", encoding="utf-8")
    print(f"""cd {args.dest}
npm install
npm run build
vercel link            # new project "{args.slug}-hub"; if the repo is git-connected set Root Directory to the hub folder
vercel env add HUB_PASSWORD production
vercel env add HUB_COOKIE_SECRET production   # openssl rand -hex 32
vercel env add HUB_SLUG production            # {args.slug}
vercel --prod
bash scripts/smoke.sh https://{args.slug}-hub.vercel.app '<password>'""")
    return 0


if __name__ == "__main__":
    sys.exit(main())
