# Plan — The First Global Alliance (MVP)

> **Status:** Planning. Decisions taken, no code yet.
> **Supersedes:** the phase ordering in [`../discovery/08-feature-list-and-roadmap.md`](../discovery/08-feature-list-and-roadmap.md). The discovery documents remain the reference for *why* things are the way they are; this directory is the reference for *what we build*.
> **Date:** 2026-10-03

---

## 1. Purpose

The discovery phase (docs `01`–`12`) established that the data is small, that no scraping is required, and that a pure-static architecture is sufficient. It also produced a large amount of forward-looking design (video reconstruction, OCR, normalization across nine seasons, UGC moderation).

This directory re-cuts that work down to **what can be built fast and shipped**, while keeping every deferred capability *addable without rework*. The governing constraints, in priority order:

1. **KISS** — the simplest thing that works. No framework, no database for the archive, no build tooling beyond a small Node script.
2. **Modular** — one page archetype = one template = one data file. Nothing is special-cased.
3. **Maintainable** — the site must survive a year of no maintenance and be resumable by one person.
4. **Fast development** — a working site sooner beats a complete site later.

---

## 2. Decisions log

These were open in the discovery phase and are now **resolved**. Do not reopen without a new entry here.

| # | Decision | Resolution | Rationale |
|---|---|---|---|
| D1 | **Data scope** | Season **summary + awards** for *all* seasons 2017–2026. **Competition data** (standings, matches, W‑L, ranks) for **2023–2025 only**, with 2026 added live. | Matches the two things that are complete upstream (awards, season metadata) while avoiding the four seasons with no match data. Everything is structured so the other seasons slot in when the owner obtains a dataset for them. |
| D2 | **Live architecture** | The live system is **a second data origin serving the same artifact paths**, not a second site. The static pages never know the difference. | Develop one site + one data workflow. The server regenerates a subset of the archive into the live origin; the page reads a URL it was given at build time. |
| D3 | **Live store** | Object storage (**Cloudflare R2**, public bucket + custom domain), **not** a deploy and **not** a relational DB. | A 60 s cadence produces ~2,400 updates per event; Pages allows 500 deploys/month and GitHub Pages ~10/hour. Also the page wants a *file*, not a query. A DB becomes the right answer only when submissions (UGC) arrive — deferred. |
| D4 | **Hosting** | **Cloudflare Pages** (GitHub as source of truth). | Unlimited bandwidth, real `_headers` support (immutable caching), 20,000-file limit is ample. |
| D5 | **Render model** | **Pre-rendered HTML at build time + client hydration for the active season.** Templates are pure functions returning HTML strings, executed in *both* Node (build) and the browser (hydrate). | One template implementation, real SEO, one request per page, no client-side router. |
| D6 | **User interaction** | **None in the MVP.** No submissions, no auth, no moderation. | Explicit scope cut. Video links and image URLs are maintained by the owner directly in JSON. |
| D7 | **Team identity** | `team-identity.json` is a **hand-curated registry** in the repo, the union of the API registry and every code observed in season data — not derived at build time. | The upstream registry is incomplete (`10_hope` vs `10`, seven 2017-only continental entities). Must also be able to represent entities with no data yet. |
| D8 | **Video links** | Stored in a **separate mutable overlay** (`pipeline/overlays/videos/<year>.json`, keyed by `match_id`), which is a **build input** and is never published. | Adding a link must never invalidate immutable cache or break pipeline idempotency — the simplest way to guarantee that is for the overlay to have no runtime presence at all. |
| D9 | **Images** | Main team image is **downloaded, resized to WebP and committed**. No hotlinking, no third-party image host in the MVP. | Hotlinking WordPress media is fragile. Imgur has no SLA, unstable URLs, and an anti-automation posture — it is not a CDN. |
| D10 | **TBA code reuse** | Take the **design system and information architecture**; write our own templates. Copy individual CSS primitives only if useful, with an attribution `NOTICE`. | TBA is MIT (legal to reuse), but its templates are ERB over a Postgres schema — porting costs more than writing. |
| D11 | **Design tokens** | Defined on day one with light and dark variants. FGC brand purple + light blue. | Retrofitting theming is expensive; defining it up front is free. |
| D12 | **Statistics** | Not in the MVP beyond what the raw data states (rank, record, medals, scores). EPA-style ratings are a later phase. | Upstream gives ~12 matches per team per season; any rating needs uncertainty intervals to be honest. |
| D13 | **Season navigation** | Resolution of "current season vs history" happens **at build time** via `active_season` in the build config, never from the visitor's clock. | A static site whose default page changes with the viewer's clock breaks shared links, SEO and reproducibility. |

---

## 3. Documents in this directory

| Doc | Contents |
|---|---|
| [01-architecture.md](01-architecture.md) | The data-origin contract, the render model, the build, hosting and caching, and the design-token system. |
| [02-data-contract.md](02-data-contract.md) | Exact file layout, artifact shapes, the "one page = one fetch" rule, and how the live origin mirrors it. |
| [03-pages.md](03-pages.md) | The page inventory: route, template, data source, and the blocks each page renders. |
| [04-roadmap.md](04-roadmap.md) | Phases with dependencies and estimates, and the deployment sequence. |
| [05-backlog.md](05-backlog.md) | **Issue-ready backlog.** One entry per issue title + body. Created on GitHub by `scripts/create-issues.mjs --dry-run`. |
| [06-palette.md](06-palette.md) | Verified FGC colours from live CSS, contrast results, and the one open role-assignment decision. |

---

## 4. What the MVP is, in one paragraph

A static site on Cloudflare Pages, generated by a small Node script, that archives the FIRST Global Challenge. It shows, for every season 2017–2026, the season summary and the awards; and for 2023–2025, the full competition record — standings, matches, per-team history, medal table and insights. Team pages are a history timeline by default, and switch to the season view when that season is active. Every page is a pre-rendered HTML file carrying its own data inline, so it renders in one request with no JavaScript required. Match pages link to the correct field VOD and, when a timestamp has been recorded, deep-link to the exact minute. During an event, the same pages hydrate from a live origin that the pipeline keeps fresh — the page code does not change.

---

## 5. Explicitly out of scope for the MVP

Everything below is **deferred, not rejected**. Each has a hook in the data model so it can be added later without migration.

| Deferred | Hook that keeps it cheap |
|---|---|
| User submissions, auth, moderation | Artifacts are keyed by stable IDs; an overlay file is enough to introduce user data. |
| Crowdsourced video timestamps | `pipeline/overlays/videos/<year>.json` already exists and is already the authority for timestamps. |
| Video OCR / historical reconstruction | Every record carries `source` and `confidence`; the canonical shape is the same for API and video data. |
| EPA / ratings / cross-year normalization | `derived/ratings/<year>.json` is reserved; the normalized component vocabulary already exists per season. |
| i18n | String keys are namespaced from day one. |
| Robot photo gallery + Telegram bot | Media layer already separates "team primary image" from "additional media". |
