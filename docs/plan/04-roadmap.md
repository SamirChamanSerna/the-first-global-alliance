# 04 — Roadmap

> Five phases to a shipped MVP, then the live layer. Estimates are **working days for one developer**, and assume the data contract in [02](02-data-contract.md) is followed rather than redesigned mid-build.

---

## 0. The 2026 window

The 2026 event runs **7–10 October 2026 in Incheon, South Korea** — four days out. It does **not** gate the MVP, but it does create one cheap obligation.

> **Insurance item:** run the fetch step once per event day (7–10 Oct) and commit the raw responses. Roughly ten minutes of work each day, done by hand with the client built in F1. The API has demonstrated gaps (2022 lost its match array entirely; 2017–2019 never had one) — capturing 2026 while it is live costs almost nothing and removes the risk of a gap we cannot explain later.

Everything else about 2026 is **post-MVP** (phase F5). Trying to ship the live layer in four days would put an unproven pipeline and an unproven UI on public display during the one week a year the site has an audience.

---

## F0 — Foundation · ~1 day

The scaffolding that makes everything else mechanical.

| # | Deliverable |
|---|---|
| F0.1 | Repository layout per [01 §2](01-architecture.md) — `data/`, `pipeline/`, `site/`, `live/`, `dist/` |
| F0.2 | `build.config.json` with `origins`, `active_season`, `live_years` |
| F0.3 | Cloudflare Pages project connected to the GitHub repo; `dist/` as the output directory |
| F0.4 | `_headers` with the cache policy from [01 §5](01-architecture.md) |
| F0.5 | `build.mjs` skeleton: route table → template → `dist/<route>/index.html` |
| F0.6 | `app.css` with the token system, light **and** dark, and the layout primitives (page shell, table, card, notice) |
| F0.7 | Vendored flag SVGs (MIT `flag-icons`, subset to the entities we use) |
| F0.8 | Attribution `NOTICE` (FIRST Global data, `flag-icons`, TBA design lineage) |

**Exit:** an empty but themed page deploys to a real URL with correct caching headers.

---

## F1 — Data pipeline · ~3–5 days

The foundation everything else reads. **Do not start the frontend before this is solid** — templates written against unmade decisions are rewritten.

| # | Deliverable | Depends |
|---|---|---|
| F1.1 | API client: descriptive UA, 15 s timeout, 3 retries with backoff, raw response stored verbatim | — |
| F1.2 | `team-identity.json` — hand-curated registry, seeded from the flag set + ISO/IOC lists, unioned with every `countryCode` observed. **Every entity that could ever appear must be representable.** | — |
| F1.3 | Normalizer per [02 §4](02-data-contract.md) — `teamKey`→`team_id`, `eventKey`→year, `match_id`, `field`, result enum, `{utc,offset,local}` times, null discipline | F1.1, F1.2 |
| F1.4 | Season adapters: `fgc2023`, `fgc2024`, `fgc2025`, `fgc2026`, `legacy` (rankings + awards only) | F1.3 |
| F1.5 | `seasons.json` — hand-maintained for **all** seasons 2017–2026: host, dates, theme, game, ranking stat, `data_coverage`, synopsis, score formula | — |
| F1.6 | Backfill: 2023–2025 full; **summary + awards for every season 2017–2026** | F1.4, F1.5 |
| F1.7 | Emit all artifacts in [02 §2](02-data-contract.md) — including per-match files and the compact match rows with precomputed `href`, `is_team_red` | F1.6 |
| F1.8 | Derived aggregates: `teams/<id>/index.json`, `medals.json`, `teams.json`, `manifest.json` | F1.7 |
| F1.9 | Video overlay + resolution algorithm ([02 §6](02-data-contract.md)) merged into match rows | F1.7 |
| F1.10 | Deterministic emit + provenance fields (`source`, `rule_version`, `schema_version`) | F1.7 |
| F1.11 | Validation + human-readable quality report; **publish is gated on it** | F1.6 |

**Exit:** `data/` is complete and stable, a rebuild with no upstream change produces an empty diff, and the quality report reads clean.

**Highest risk:** F1.2 and F1.4. The `teamKey` trap ([discovery 02 §1](../discovery/02-data-model.md)) fails silently, so F1.11 must include a cross-season identity assertion.

---

## F2 — Frontend core · ~5–7 days

The pages that carry the product.

| # | Deliverable | Depends |
|---|---|---|
| F2.1 | `blocks.js` — the shared blocks in [03 §2](03-pages.md), including `matchRow` | F0.6 |
| F2.2 | `home` + `season-index` | F1.8 |
| F2.3 | `season` — coverage-driven, all seasons | F1.8 |
| F2.4 | `team-history` — timeline, career snapshot, medal cabinet, coverage labels | F1.8 |
| F2.5 | `team-season` — standing, alliance, awards, match list with highlight | F1.8, F2.1 |
| F2.6 | `match` — score, generic breakdown renderer, alliances, video deep link | F1.8 |
| F2.7 | `season-matches` with client-side filters | F1.7 |
| F2.8 | `medals` — sortable all-time table | F1.8 |
| F2.9 | `search` + `search-index.json` + accent/alias-insensitive matching | F1.2 |
| F2.10 | `404`, sitemap, OpenGraph tags, `<link rel=canonical>` | F2.2 |

**Exit:** every archive route renders correctly with JavaScript disabled, in both themes, at phone width.

---

## F3 — Secondary pages · ~3–4 days

| # | Deliverable | Depends |
|---|---|---|
| F3.1 | SVG chart helper (line, bar, distribution) — no library | F0.6 |
| F3.2 | `insights-all` — participation and awards by region, seasons distribution | F2.1 |
| F3.3 | `insights-year` — score distribution, rank movement, award breakdown | F2.1 |
| F3.4 | `calculator` shell + `site/calc/2025.js` | F2.1 |
| F3.5 | `site/calc/2026.js` | F3.4 |

**Exit:** the calculator reproduces official 2025 match scores from their published inputs — a real correctness test, not a smoke test.

---

## F4 — Media, identity, polish · ~2–3 days

| # | Deliverable | Depends |
|---|---|---|
| F4.1 | Scrape the primary image URL per team per year from `first.global/<year>-nations/…` | F1.2 |
| F4.2 | Download, cap at 1600 px, convert to WebP, commit to `data/media/<year>/` | F4.1 |
| F4.3 | Wire images into team pages with `loading="lazy"`, `srcset`, and a flag-only fallback | F4.2 |
| F4.4 | FGC brand palette → final tokens, light and dark, contrast-checked | F0.6 |
| F4.5 | Accessibility pass: focus visibility, table semantics, no colour-only meaning | F2.x |
| F4.6 | Performance budget check: `app.css` ≤ 25 KB, `app.js` ≤ 12 KB, no page over 1 request + assets | F2.x |
| F4.7 | Attribution, licence and takedown page | — |

**Exit:** the site is publishable.

---

## F5 — Live layer · post-MVP

Built **after** the site works, against the contract in [01 §4](01-architecture.md). None of it changes page code.

| # | Deliverable |
|---|---|
| F5.1 | Docker poller: cadence 300 s / 60 s / 20 s driven by `scheduledTime`, change detection, fail-closed validation |
| F5.2 | Re-run the same emit code writing to the live origin (R2), with `Cache-Control` object metadata |
| F5.3 | `live/<year>.json` with the `seed` counter |
| F5.4 | R2 CORS policy for the Pages origin — **configure before the event, not during** |
| F5.5 | Client hydration: poll, patch by ID, re-render only changed containers |
| F5.6 | Stale/paused banner and the full degradation matrix ([discovery 04 §5](../discovery/04-live-event-architecture.md)) |
| F5.7 | Alerting on poll failure or shape change |
| F5.8 | `freeze` — fold the live season into the archive and bump `data_version` |

**Exit:** the site covers an event end to end with the static archive untouched.

---

## Sequencing

```
F0 ──► F1 ──► F2 ──► F3 ──► F4 ──► SHIP ──► F5
1 d    3–5 d  5–7 d  3–4 d  2–3 d            post-MVP
```

**Total to MVP: ~14–20 working days.**

### Two checkpoints that matter

1. **After F1** — the data exists and is correct. Even with no site, the archive is the durable asset, and it is the thing that cannot be recreated later.
2. **After F2** — the site is genuinely useful: seasons, teams, matches, medals. F3 and F4 are additive; shipping without them is a valid choice.

### If time runs short, cut in this order

1. Insights pages (F3.2, F3.3)
2. Calculator (F3.4, F3.5)
3. Team photos (F4.1–F4.3)
4. Search (F2.9)

**Never cut:** F1.11 (validation), the coverage notices in [03 §4](03-pages.md), the identity registry (F1.2), or `seasons.json` for the award-only years. Those are what make the published numbers trustworthy, and trust is the only thing this site actually sells.

---

## Deliberately excluded, and why

| Excluded | Reason |
|---|---|
| Any client-side framework | 13 templates and ~12 KB of JS do not need one |
| A database for the archive | ~6 MB of JSON on a CDN is strictly simpler ([discovery 05](../discovery/05-storage-and-distribution.md)) |
| EPA / OPR / ratings in the MVP | ~12 matches per team per season; a point estimate without an interval is misleading ([discovery 03 §2.5](../discovery/03-metrics-catalog.md)) |
| Publishing `live.json` via a deploy | 2,400 deploys per event against a 500/month limit |
| Hotlinking images | Fragile, and rude to the source |
| Reconstructing 2017–2022 match data | Deferred; the shape already accommodates it ([discovery 10](../discovery/10-historical-reconstruction.md)) |
