# 01 — Hybrid architecture (static archive + live season)

Status: proposal. Nothing here is implemented yet.

## Goal

One site, two modes, near-zero maintenance cost:

| Mode | Seasons | Rendering | Runtime deps |
|---|---|---|---|
| **Archived** | 2017–2025 | 100% static HTML, generated at build | none |
| **Live** | current (2026) | same static HTML + one small JSON overlay | DB read, only during the event |

The existing generator (`site/build.js` → `site/templates/*`) stays. Only the data source changes.

## Data flow

```
api.first.global ──poll 60s──► docker worker ──validate+normalize──► processed JSON
                                                                      │
                                            ┌─────────────────────────┴──────────────────┐
                                            ▼                                            ▼
                                   DB snapshot (live.json)                    data/processed/*.json
                                   CDN cache 30–60s                             (committed to repo)
                                            │                                            │
                                    live season pages                      static build of every page
```

Two write paths, deliberately:

1. **Archived seasons** — processed JSON is committed to the repo. `node site/build-<x>.js` reads it and emits `dist/`. No network at build time, no runtime at all.
2. **Live season** — the docker worker writes a snapshot to a DB/object store. Pages for the current season fetch that one file and re-render the affected regions.

## The live layer — decided: static shell + one JSON overlay

**Rejected: rebuild on cron.** Worker poll → deploy hook → full static rebuild. Zero new runtime code and zero JS, but latency is the build time (1–5 min) and it burns the build quota — Cloudflare Pages free tier allows **500 builds/month**, so ~1 build/min is out of budget. Only viable at ~10–20 rebuilds/day, which is not the freshness we want.

**Decided:**
- Everything is still pre-rendered at build time from the last processed snapshot, so the site is complete with JS off.
- Live-season pages add ~1 KB of inline JS that fetches `live.json` once and re-renders **only** the volatile regions (match rows, rankings table, scoreboard).
- `live.json` is served from the CDN with `max-age=30` (or 15) so 60 s polling is enough for the worker; thousands of clients hit cache, not the DB.
- On fetch failure the pre-rendered snapshot stays on screen. No error state needed.

Live regions are marked in the markup with `data-live="ranking|matches|scoreboard|…"`; the overlay script rewrites their inner HTML using the **same `blocks.js` functions**, so there is one markup source. To make `blocks.js` usable in the browser, the live bundle is pre-built from the same module (no second template implementation).

## Season lifecycle

`data/seasons.json` drives it:

```json
{ "y": 2025, "mode": "archived" }
{ "y": 2026, "mode": "live", "startsOn": "2026-10-…", "endsOn": "2026-11-…" }
```

- **During the event:** docker worker runs 24/7, polls, writes to DB. Static rebuilds only a few times a day (session ends, awards announced).
- **After the event:** dump the final processed JSON into the repo, flip `mode` to `archived`, rebuild, **stop the container**. Nothing runs until 2027.
- **2020 and 2021**: `mode: "awards-only"` — no matches, no rankings, no teams timeline. Only the awards exist (no physical competition). Pages must render with the "no data" states the spec already requires.

## Hosting

**Cloudflare Pages**, for one reason beyond cost: Pages Functions let the DB be reached through `/api/live.json` on the same origin — no CORS, no client-side credentials, cache headers under our control. Free tier: unlimited requests and bandwidth, 500 builds/month.

**GitHub Pages** works for the archive half (static only, 1 GB site / 100 GB soft bandwidth) but has no serverless layer, so option B would require the client to talk to the DB directly. Keep it as a mirror, not the primary.

Either way the site stays dependency-free: no framework, no remote fonts, one CSS file, JS optional.

## Language and translatability

English is the primary language, but nothing may be written in a way that cannot be translated later. The mechanism already exists — `t("key")` over `brand.labels` — so the requirements are constraints on how strings are written, not new machinery:

- **No literal user-facing text in templates**, already an inviolable rule. It is also what makes translation possible at all.
- **No string built by concatenation.** Labels carry whole phrases with placeholders: `"{n} matches"`, not `t('matches')` glued to a number. Word order differs per language and concatenation cannot be translated.
- **One locale file per language** (`site/brand/locales/en.js`, `es.js`, …), same key set. `brand.lang` selects; `t()` does not change.
- **Data is stored language-neutral**: ISO codes as ids, ISO 8601 dates, numbers unformatted. Formatting happens at render time via `Intl` with the page locale. Country names come from the API in English only — treat them as data that may need a per-locale override in the overlay.
- **Output layout**: one page tree per locale (`/{lang}/…`), default language at the root. The generator emits them from the same templates; this is a build concern, decided when the second locale is added, not now.
- **A build check** that every locale file has exactly the same keys and that no label is missing — the current `t()` already throws on a missing key, which is most of the work.

## Constraints to respect

- The site must open straight from disk (`layout()` already rewrites absolute links to relative ones). The live overlay is an *addition*, not a requirement — the offline/static build must never break.
- No request to a third party from the client. `live.json` is same-origin; flags and photos are mirrored into the repo.
- Total page weight stays inside the budget already set in `docs/web-style-guide/02-guia-de-estilos.md` §8 (CSS < 15 KB, page HTML < 50 KB).
