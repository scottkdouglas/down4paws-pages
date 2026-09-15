# Client Hub

A private, static, per-client "client hub": a quiet dashboard, a sprint board,
and a weekly update log, built for one client at a time and deployed as its
own site.

## What this is

Astro 7 static site, Tailwind 4, TypeScript strict. No database, no server,
just markdown/JSON content files that compile to a static build. Auth is a
Vercel Edge Middleware password gate in front of the whole site (see
`middleware.js`, owned separately from this UI pass).

## Folder map

```
hub.config.ts              per-client config (name, brand, sprint, modules, links)
src/content.config.ts      collection schemas (content-layer API)
src/content/               the actual content, one folder per collection
src/lib/                   types, dates, sprint math, module registry
src/layouts/HubLayout.astro
src/components/nav/        Sidebar, SprintHeader, LastUpdated
src/components/ui/         Card, Badge, OverdueBadge, Tag, OwnerChip, Empty
src/components/board/      KanbanColumn, TaskCard, MiniBoard
src/components/widgets/    dashboard widgets (ThisWeek, Scoreboard, etc.)
src/components/modules/    full module pages (BoardPage, NumbersPage, etc.)
src/pages/                 index.astro (dashboard), [module].astro, 404.astro
```

## Content editing guide

Each collection lives in `src/content/<name>/`. Files use frontmatter plus,
where noted, a markdown body. One example per collection:

**cards** (the sprint board)
```md
---
title: Homepage redesign
status: doing # backlog | todo | doing | review | done
category: site # must match a hub.config.ts serviceTags id
owner: SD
due: 2026-09-22
sprint: 1
nextSprint: false
order: 1
---
Optional detail shown when the card is expanded.
```

**decisions**
```md
---
date: 2026-09-08
decision: Use the Google Business Profile as the primary review funnel.
who: Dana Reyes
---
Why we decided this (shown in the Why column).
```

**deliverables**
```md
---
title: Local SEO audit report
delivered: 2026-09-05
what: What this deliverable is.
howToUse: How the client should use it (rendered as a link if it starts with http).
whereItLives: https://docs.example.com/audit
clientOwner: Dana Reyes
category: seo
---
```

**recordings**
```md
---
date: 2026-09-08
call: Weekly sync
href: https://recordings.example.com/2026-09-08
bullets:
  - First takeaway
  - Second takeaway
  - Third takeaway
durationMin: 32
---
```

**scoreboard**
```md
---
title: Send updated logo files
direction: you-owe # we-owe | you-owe
source: Website
due: 2026-09-10
done: false
category: site
---
```

**updates** (the weekly Friday note)
```md
---
weekOf: 2026-09-15
shipped: [Logo refresh, Call tracking live]
decided: [Delay homepage kickoff one week]
nextWeek: [Finish GA4 events, Start review widget]
needFromYou: [Updated logo files, Ads account access]
---
Longer Friday note, rendered below the four lists.
```

**numbers** (JSON, not markdown)
```json
{
  "id": "leads-total",
  "label": "New Leads",
  "value": "38",
  "delta": { "value": "+12%", "direction": "up", "period": "vs last 30 days" },
  "source": "GHL",
  "asOf": "2026-09-14",
  "order": 1,
  "group": "Leads"
}
```

A scaffold script strips any file named `sample-*` when instantiating this
repo for a real client, so keep real content filenames plain.

## Weekly loop

1. Edit `src/content/updates/` with this week's Friday note.
2. Update `src/content/cards/` and `src/content/scoreboard/` (statuses, due
   dates, done flags).
3. Run the numbers script to refresh `src/content/numbers/*.json`.
4. Run the Friday-note script if you have one wired up, otherwise write the
   update file directly.
5. `vercel --prod` to ship.

## Login protection

The gate is one shared password per hub. Nothing in the middleware throttles guesses, because edge functions have no shared memory. Two rules keep it safe:

- Use a long random password (four or more random words, or `openssl rand -base64 18`). Rotate it when the engagement ends or someone leaves the client's team.
- Add a Vercel Firewall rate-limit rule for the project: path `/login`, method `POST`, keyed by IP, something like 10 requests per minute. Vercel dashboard, project, Firewall, Custom Rules. Do this once per hub after the first deploy.

Every response carries `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store`. Recording links (Loom and similar) live outside the gate, so keep those unlisted.

## Environment variables

- `HUB_PASSWORD` the shared password for this client's hub.
- `HUB_COOKIE_SECRET` signs the auth cookie, generate with
  `openssl rand -hex 32`.
- `HUB_SLUG` must match `hub.config.ts` `client.slug`.

## Modules

`hub.config.ts` -> `modules` is the on/off switch. Only modules listed there
get a sidebar link, a `/[module]` route, and (where relevant) a dashboard
widget. Order on the dashboard and in the sidebar comes from `src/lib/modules.ts`,
not from the order they're listed in `hub.config.ts`.

## Smoke test

```
scripts/smoke.sh <deployed-url> <password>
```

Logs in, then curls `/`, `/board`, `/numbers`, `/scoreboard`, `/decisions`,
`/deliverables`, `/recordings`, and `/updates`, and fails loudly on a non-200
or an empty body.

## Deploying this hub

This hub lives inside the `down4paws-pages` repo, and the Vercel project `down4paws-hub` is git-connected with Root Directory `hub`. A push to `main` that touches anything under `hub/` deploys it; pushes that do not touch `hub/` are skipped by the ignore command. Do not run `vercel --prod` here: the repo root is linked to a different Vercel project.
