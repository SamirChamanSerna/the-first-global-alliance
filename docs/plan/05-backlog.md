# 05 — Backlog (issue-ready)

> One entry per GitHub issue. Copy the **Title** as the issue title and the **Body** as the description. Labels are given as `label` names to create in the repo.
>
> **Estimate:** `S` = hours · `M` = 1–2 days · `L` = 3+ days.
> **Order:** within a phase, issues are listed in dependency order.

**Labels to create**

| Label | Meaning |
|---|---|
| `phase:foundation` `phase:pipeline` `phase:frontend` `phase:secondary` `phase:polish` `phase:live` | Roadmap phase |
| `area:infra` `area:data` `area:ui` `area:content` `area:a11y` | Subject area |
| `priority:p0` `priority:p1` `priority:p2` | P0 = blocks the MVP · P1 = needed to ship well · P2 = nice to have |
| `deferred` | Explicitly post-MVP, kept as a hook |

---

# F0 — Foundation

---

### `[F0.1]` Repository layout and build scaffolding

**Labels:** `phase:foundation` `area:infra` `priority:p0` · **Estimate:** S · **Depends on:** —

**Body**
Create the directory structure from [01-architecture.md §2](01-architecture.md): `data/`, `pipeline/`, `site/templates/`, `site/assets/`, `live/`, `dist/`. Add `build.config.json` with `active_season`, `origins.archive`, `origins.live`, `live_years`. Add `build.mjs` that reads a route table and writes `dist/<route>/index.html` from a template function.

**Acceptance**
- [ ] Directory tree matches the architecture doc
- [ ] `node site/build.mjs` produces a `dist/` tree from a 2-route route table
- [ ] `build.config.json` is the only place an origin is declared
- [ ] `dist/` is gitignored; `data/` is not

---

### `[F0.2]` Cloudflare Pages project, headers and deploy

**Labels:** `phase:foundation` `area:infra` `priority:p0` · **Estimate:** S · **Depends on:** F0.1

**Body**
Connect the GitHub repo to Cloudflare Pages with `dist/` as the output directory. Add `public/_headers` implementing the cache policy in [01-architecture.md §5](01-architecture.md):

- `/assets/*` — immutable (content-hashed URLs)
- `/data/v*/*` — immutable (the version segment is what makes this truthful)
- `/data/manifest.json` — 300 s, unversioned on purpose, it is how clients discover `N`
- `/*.html` — 300 s

**Do not assume the globs behave as written.** Rule precedence and wildcard behaviour in Cloudflare Pages `_headers` is easy to get subtly wrong (`v*` also matches `videos`), and getting it wrong here means a correction that never reaches anyone. This issue is done when each rule has been *proved* with `curl -I`, not spot-checked.

**Acceptance**
- [ ] A push to `main` deploys and the URL is live
- [ ] `curl -I` on `/assets/app.css` returns `cache-control: public, max-age=31536000, immutable`
- [ ] `curl -I` on `/data/v1/teams.json` returns `max-age=31536000, immutable`
- [ ] `curl -I` on `/data/manifest.json` returns `max-age=300`
- [ ] `curl -I` on a generated `index.html` returns `max-age=300`
- [ ] There is **no** mutable file anywhere under `/data/` — verified by inspection of `dist/data/`
- [ ] Deploy previews work on pull requests

---

### `[F0.3]` Design tokens, page shell and layout primitives

**Labels:** `phase:foundation` `area:ui` `priority:p0` · **Estimate:** M · **Depends on:** F0.1

**Body**
Write `site/assets/app.css`: the full token set from [01-architecture.md §6.1](01-architecture.md) with light and dark variants, plus the primitives every page uses — page shell, header/nav, footer, data table (with `font-variant-numeric: tabular-nums`), card, notice/banner, and buttons. Implement the theme toggle with `data-theme` on `<html>` and `localStorage` in a `try/catch`.

**Acceptance**
- [ ] Every colour in the codebase is a token; no raw hex outside `:root`
- [ ] Light and dark are both correct, driven by `prefers-color-scheme` *and* the manual toggle
- [ ] Toggle selection survives a reload and degrades silently when storage is unavailable
- [ ] Works at 320 px width with no horizontal scroll
- [ ] `app.css` ≤ 25 KB

---

### `[F0.4]` Vendored flags and attribution

**Labels:** `phase:foundation` `area:ui` `priority:p0` · **Estimate:** S · **Depends on:** —

**Body**
Vendor the `lipis/flag-icons` SVG set (MIT) into `site/assets/flags/`, subset to the entities in the identity registry. Add a `NOTICE` file covering the flag set, FIRST Global as the data source, and The Blue Alliance as a design lineage reference.

**Acceptance**
- [ ] Flags load as static assets with no third-party request
- [ ] Entities without a country flag render a defined fallback (code chip), not a broken image
- [ ] `NOTICE` names every reuse and its licence

---

# F1 — Data pipeline

---

### `[F1.1]` API client for `api.first.global`

**Labels:** `phase:pipeline` `area:data` `priority:p0` · **Estimate:** S · **Depends on:** F0.1

**Body**
Implement the fetch layer described in [discovery 06 §3.1](../discovery/06-extraction-pipeline.md): descriptive `User-Agent`, 15 s timeout, 3 retries with exponential backoff, and verbatim storage of the raw response body. Endpoints are listed in [discovery 01 §1.1](../discovery/01-data-sources.md) — note there is no `ETag` and caching is disabled upstream, so every call is a full re-fetch.

**Acceptance**
- [ ] All confirmed endpoints callable and raw bodies persisted
- [ ] Retry and timeout behaviour verified against a forced failure
- [ ] No `GET /v1` call without `excludeMatchDetails=true` except the per-match detail fetch
- [ ] Request count for a full backfill is logged

---

### `[F1.2]` Team identity registry

**Labels:** `phase:pipeline` `area:data` `priority:p0` · **Estimate:** M · **Depends on:** —

**Body**
Create `pipeline/lookups/team-identity.json` per [02-data-contract.md §3.2](02-data-contract.md). It is **hand-curated and authoritative**, not derived at build time. Seed it from the flag set, ISO/IOC country lists and the 2017 continental entities, then union it with every `countryCode` observed upstream. Every entity that could ever appear must be representable, including ones with no data.

**Acceptance**
- [ ] `team_id` is our own slug, assigned once, never derived from upstream
- [ ] Includes the seven 2017 continental entities and reconciles `10_hope` with `10`
- [ ] Every `countryCode` observed in 2017–2025 resolves to exactly one `team_id`
- [ ] Entities with no seasons yet are present and valid
- [ ] A test asserts that `teamKey` is **not** used as an identity anywhere

---

### `[F1.3]` Normalization rules

**Labels:** `phase:pipeline` `area:data` `priority:p0` · **Estimate:** M · **Depends on:** F1.1, F1.2

**Body**
Implement the ten rules in [02-data-contract.md §4](02-data-contract.md): `countryCode` case folding and lookup, `eventKey` → year (never joined on), composite `match_id`, `field | fieldNumber` unification, `played` + `result` derivation, `{utc,offset,local}` times, **null discipline** (absent is `null`, never `0`), participant exclusion rules, provenance fields, and deterministic emit.

**Acceptance**
- [ ] The `/v1` and `/v1/matches` payload shapes produce identical normalized matches
- [ ] No aggregate includes `no_show = 1` or `disqualified = 1` participants
- [ ] Missing values are `null`; a grep for `|| 0` on nullable fields returns nothing
- [ ] Times round-trip with the original UTC offset preserved

---

### `[F1.4]` Season adapters

**Labels:** `phase:pipeline` `area:data` `priority:p0` · **Estimate:** M · **Depends on:** F1.3

**Body**
One module per season family, per [discovery 02 §4](../discovery/02-data-model.md): `fgc2023` (13 detail keys), `fgc2024` (37), `fgc2025` (20), `fgc2026` (17, pre-written), and `legacy` for 2017–2019/2022 (rankings and awards only, no match adapter). Each declares its `custom_stat_key`, maps raw `details` keys to the normalized component vocabulary, and declares the per-robot fields with their alliance-slot mapping.

**Acceptance**
- [ ] Each adapter emits `{score, penalties, coopertition, per_team, season_specific}` as in the discovery doc
- [ ] Per-robot values resolve to the correct team via station → slot
- [ ] `legacy` produces valid output for seasons with no `matches` array without erroring
- [ ] An unknown `details` key lands in `season_specific` rather than being dropped

---

### `[F1.5]` `seasons.json` for all seasons

**Labels:** `phase:pipeline` `area:content` `priority:p0` · **Estimate:** M · **Depends on:** —

**Body**
Hand-maintain the ten season rows per [02-data-contract.md §3.3](02-data-contract.md): host, dates, theme, game name, ranking stat, `data_coverage`, a 2–3 sentence synopsis, a human-readable score formula, and the per-day per-field stream URLs. Sourced from `first.global/archive/fgc-<year>/` and the official frontend's `yearData`.

**Acceptance**
- [ ] All ten seasons 2017–2026 present, including the empty 2020/2021 years
- [ ] `data_coverage` set correctly: `awards_only` for 2017–2019/2022, `full` for 2023–2025
- [ ] Synopses written for every season (this is user-facing copy)
- [ ] Stream URLs captured for every year that has field streams — **unlisted VODs must be captured early**

---

### `[F1.6]` Backfill and artifact emit

**Labels:** `phase:pipeline` `area:data` `priority:p0` · **Estimate:** L · **Depends on:** F1.4, F1.5

**Body**
Fetch 2023–2025 in full and summary + awards for every season 2017–2026, then emit every artifact in [02-data-contract.md §2](02-data-contract.md). The compact match row must arrive with `href`, `is_team_red` and `video.url` **precomputed** — templates never build URLs or resolve alliances.

**Acceptance**
- [ ] Every route in [03-pages.md](03-pages.md) has a data file to read
- [ ] `matches/**` file count and total size measured and reported (Pages limits)
- [ ] Award-only seasons emit a valid season page with `standings_top: []`
- [ ] ~1,115 upstream requests total, run once, not on a schedule

---

### `[F1.7]` Derived aggregates and `manifest.json`

**Labels:** `phase:pipeline` `area:data` `priority:p0` · **Estimate:** M · **Depends on:** F1.6

**Body**
Build `teams/<id>/index.json` (career snapshot + timeline + awards), `medals.json` (complete 2017→present), `teams.json` and `manifest.json` per [02-data-contract.md §3.5, §3.9](02-data-contract.md).

**Acceptance**
- [ ] Every career aggregate carries its coverage span and the UI can render it
- [ ] A season with no match data renders a timeline row with no record and no zeros
- [ ] The medal table covers every season from 2017
- [ ] `manifest.json` carries `data_version`, `active_season` and `match_seasons`

---

### `[F1.8]` Video overlay and link resolution

**Labels:** `phase:pipeline` `area:data` `priority:p1` · **Estimate:** S · **Depends on:** F1.6

**Body**
Implement [02-data-contract.md §6](02-data-contract.md): a hand-editable overlay at **`pipeline/overlays/videos/<year>.json`** — a build input that is *never published* — merged at build time into every compact match row by the documented algorithm: no timestamp → the day's field VOD; timestamp → `?t=<seconds>`. Each resolved link carries a `precision` of `exact` or `vod`.

**Acceptance**
- [ ] The overlay lives under `pipeline/`, not `data/`, and never appears in `dist/`
- [ ] The overlay is never written into a frozen season file
- [ ] Editing the overlay and rebuilding changes only the links
- [ ] A match on a field with no stream renders no icon rather than a dead link
- [ ] `precision` is rendered as a visible label, so an approximate link is honest about it

---

### `[F1.9]` Validation and quality report

**Labels:** `phase:pipeline` `area:data` `priority:p0` · **Estimate:** M · **Depends on:** F1.6

**Body**
Produce the human-readable report from [discovery 06 §5](../discovery/06-extraction-pipeline.md) and **gate publishing on it**. Include the structural checks, the known-defect list, and a diff against the previous run. Nothing is committed until a human reads it.

**Acceptance**
- [ ] Report shows counts, expected ranges, warnings and a diff versus the prior season
- [ ] Shape validation failure aborts and publishes nothing
- [ ] A cross-season identity assertion catches any accidental `teamKey` join
- [ ] An array-length regression of more than 20% aborts rather than publishing

---

### `[F1.10]` Deterministic rebuild test

**Labels:** `phase:pipeline` `area:data` `priority:p1` · **Estimate:** S · **Depends on:** F1.6

**Body**
Prove the idempotency claim: rebuilding from unchanged raw input must produce byte-identical output, so a correction is always a visible, reviewable diff and a no-op run never pollutes git history.

**Acceptance**
- [ ] Two consecutive builds produce identical hashes for every file in `data/`
- [ ] The only timestamp in the tree is `generated_at` in `manifest.json`
- [ ] Sorting, float precision and line endings are pinned and documented

---

# F2 — Frontend core

---

### `[F2.1]` Shared template blocks

**Labels:** `phase:frontend` `area:ui` `priority:p0` · **Estimate:** M · **Depends on:** F0.3

**Body**
Implement `site/templates/blocks.js` per [03-pages.md §2](03-pages.md): `flag`, `teamLink`, `medalPip`, `record`, `matchRow`, `matchList`, `rankDelta`, `total`, `coverageNotice`, `liveBadge`, `videoLink`. Pure string functions, no DOM, so they run in Node and the browser alike.

**Acceptance**
- [ ] `matchRow` renders played, unplayed, tied and no-show cases correctly
- [ ] The viewer's team is highlighted via the precomputed `is_team_red`
- [ ] Medal and result meaning is carried by text as well as colour
- [ ] Blocks are pure: no I/O, no globals, no date formatting from `Date.now()`

---

### `[F2.2]` Home and seasons index

**Labels:** `phase:frontend` `area:ui` `priority:p0` · **Estimate:** M · **Depends on:** F2.1

**Body**
Implement `/` and `/seasons/` per [03-pages.md §3.1](03-pages.md). The home page shows the seasons strip, leaders, and an active-season card when `build.config.json` sets one.

**Acceptance**
- [ ] Every season 2017–2026 is reachable from the home page
- [ ] Award-only seasons are visually distinct and labelled
- [ ] The active-season card is absent when no season is active — not rendered empty

---

### `[F2.3]` Season page

**Labels:** `phase:frontend` `area:ui` `priority:p0` · **Estimate:** M · **Depends on:** F2.1

**Body**
Implement `/seasons/<year>/` per [03-pages.md §3.2](03-pages.md). Sections are driven by `data_coverage` — a season with awards only renders no standings section at all.

**Acceptance**
- [ ] 2019 (awards only) and 2025 (full) render from the same template with no year-based branching
- [ ] Synopsis, score formula and calculator link are present
- [ ] Awards group by award with recipients and medal classes
- [ ] Top-10 standings render for full-coverage seasons

---

### `[F2.4]` Team history page

**Labels:** `phase:frontend` `area:ui` `priority:p0` · **Estimate:** L · **Depends on:** F2.1

**Body**
Implement `/teams/<id>/` per [03-pages.md §3.4](03-pages.md): header, career snapshot, medal cabinet, timeline (newest first) with image, year, host, awards, rank, highest score, W–L–T and win rate, plus the active-season hero when applicable. This is the default team route and the flagship view.

**Acceptance**
- [ ] Career figures state their coverage denominator inline
- [ ] Timeline rows for award-only seasons show no record column and no zeros
- [ ] A team that has never played renders a defined empty state, not a 404
- [ ] The route is deterministic — it does not change based on the visitor's clock

---

### `[F2.5]` Team / season page

**Labels:** `phase:frontend` `area:ui` `priority:p0` · **Estimate:** M · **Depends on:** F2.1

**Body**
Implement `/teams/<id>/<year>/` per [03-pages.md §3.5](03-pages.md): media, standing card, playoff alliance and role, awards, and the match list with the viewer's team highlighted.

**Acceptance**
- [ ] Standing card shows rank with delta, record, ranking score, highest score and the year's custom stat
- [ ] Unplayed matches show the estimated time and field, never `0–0`
- [ ] The video icon appears only where a link resolves
- [ ] Missing team image degrades to flag + name

---

### `[F2.6]` Match page

**Labels:** `phase:frontend` `area:ui` `priority:p0` · **Estimate:** M · **Depends on:** F2.1

**Body**
Implement `/matches/<year>/<stage>/<id>/` per [03-pages.md §3.6](03-pages.md). The scoring breakdown is rendered **generically from whatever keys the season provides** — one template for every season, no per-year code.

**Acceptance**
- [ ] A 2023, 2024 and 2025 match all render their own vocabulary correctly with no code change
- [ ] Raw `details` is shown separately from the normalized components
- [ ] Scheduled time is shown in both venue-local and viewer-local
- [ ] Penalties, card status and no-show flags are visible

---

### `[F2.7]` Season match list with filters

**Labels:** `phase:frontend` `area:ui` `priority:p1` · **Estimate:** M · **Depends on:** F2.1

**Body**
Implement `/seasons/<year>/matches/`: all matches grouped by stage, with client-side filtering by field, played state and team. This is the one page that legitimately loads the full season file.

**Acceptance**
- [ ] Filtering is instant and requires no additional request
- [ ] With JS disabled the full unfiltered list still renders
- [ ] Page weight measured and reported

---

### `[F2.8]` Medal table

**Labels:** `phase:frontend` `area:ui` `priority:p1` · **Estimate:** S · **Depends on:** F2.1

**Body**
Implement `/medals/` per [03-pages.md §3.7](03-pages.md) — the all-time table, sortable, with per-year expansion.

**Acceptance**
- [ ] Complete from 2017 and the header says so
- [ ] Sorting works without JS (server-side default order) and is enhanced with JS
- [ ] Every row links through to the team page

---

### `[F2.9]` Search, 404, SEO and OpenGraph

**Labels:** `phase:frontend` `area:ui` `priority:p2` · **Estimate:** M · **Depends on:** F2.2

**Body**
Build `search-index.json` (~30 KB: `team_id`, names, aliases, ISO codes, seasons active) and a client-side filter with accent- and alias-insensitive matching. Implement `/search/`, the `404` page, `sitemap.xml` and OpenGraph tags with a generated card per page type.

**Acceptance**
- [ ] `"cote d'ivoire"` and `"Côte d'Ivoire"` both find Ivory Coast; `"AFG"` finds Afghanistan
- [ ] `404` links onward rather than dead-ending
- [ ] OpenGraph cards render for home, season, team and match

---

# F3 — Secondary pages

---

### `[F3.1]` SVG chart helper

**Labels:** `phase:secondary` `area:ui` `priority:p2` · **Estimate:** M · **Depends on:** F0.3

**Body**
A small server-rendered inline-SVG helper for line, bar and distribution charts — no charting library. Direct labels, no legends, no chartjunk ([discovery 08 §Design](../discovery/08-feature-list-and-roadmap.md)).

**Acceptance**
- [ ] Renders without JS; the SVG is in the HTML
- [ ] Accessible: a `<title>` per chart and a table fallback
- [ ] Contrast is correct in both themes
- [ ] Total JS added by the helper: none

---

### `[F3.2]` Insights — all time

**Labels:** `phase:secondary` `area:ui` `priority:p2` · **Estimate:** M · **Depends on:** F3.1

**Body**
Implement `/insights/` per [03-pages.md §3.8](03-pages.md): awards by region, participation by region, seasons-participated distribution, most-awarded teams.

**Acceptance**
- [ ] `insights/index.json` shape is defined and documented in [02-data-contract.md](02-data-contract.md)
- [ ] Every chart states its denominator and coverage
- [ ] Regional groupings are defined in a lookup, not hardcoded in the template

---

### `[F3.3]` Insights — per season

**Labels:** `phase:secondary` `area:ui` `priority:p2` · **Estimate:** M · **Depends on:** F3.2

**Body**
Implement `/insights/<year>/`: score distribution, rank movement, award distribution, alliance-role breakdown.

**Acceptance**
- [ ] Available only for `full`-coverage seasons; the index labels the rest
- [ ] Cross-season comparison uses rank percentile, never raw points ([discovery 03 §6](../discovery/03-metrics-catalog.md))

---

### `[F3.4]` Points calculator shell + 2025

**Labels:** `phase:secondary` `area:ui` `priority:p2` · **Estimate:** M · **Depends on:** F2.1

**Body**
Build the generic calculator shell from [03-pages.md §3.9](03-pages.md) and the `site/calc/2025.js` module defining the Eco Equilibrium inputs and scoring. The shell renders inputs from the module, calls `score()`, and shows a line-by-line breakdown.

**Acceptance**
- [ ] Reproduces the official score for a set of published 2025 match inputs — verified against real matches, not a smoke test
- [ ] Every contribution is itemised so the total is auditable
- [ ] The formula and its source are cited on the page
- [ ] Adding a season requires one new file and no shell change

---

### `[F3.5]` Points calculator — 2026

**Labels:** `phase:secondary` `area:ui` `priority:p2` · **Estimate:** S · **Depends on:** F3.4

**Body**
Add `site/calc/2026.js` for Igniting Innovation, using the vocabulary already published in the official frontend's `fgc_2026` adapter.

**Acceptance**
- [ ] BraceState and Climb multiplier inputs modelled correctly
- [ ] Verified against real 2026 match results once available

---

# F4 — Media, identity, polish

---

### `[F4.1]` Scrape primary team image URLs

**Labels:** `phase:polish` `area:content` `priority:p1` · **Estimate:** M · **Depends on:** F1.2

**Body**
For each team and year, resolve the primary team photo URL from `first.global/<year>-nations/<slug>-<year>/`. **URL slugs are not uniform across years** — discover them per year rather than constructing them. Prefer the WordPress REST API (`/wp-json/wp/v2/pages?slug=…`) over parsing rendered HTML.

**Acceptance**
- [ ] A per-year slug map produced and committed
- [ ] Coverage reported: how many of ~190 teams per year have an image
- [ ] Missing images recorded as `null`, not as a placeholder URL

---

### `[F4.2]` Download, resize and commit team images

**Labels:** `phase:polish` `area:content` `priority:p1` · **Estimate:** S · **Depends on:** F4.1

**Body**
Download each resolved image, cap at 1600 px, convert to WebP, and commit to `data/media/<year>/<team_id>.webp`. **No hotlinking** (decision D9).

**Acceptance**
- [ ] Total `data/media/` size measured and reported
- [ ] No original-resolution file committed
- [ ] Idempotent: re-running with existing files does not re-download
- [ ] A failure on one image does not abort the batch

---

### `[F4.3]` Wire images into team pages

**Labels:** `phase:polish` `area:ui` `priority:p1` · **Estimate:** S · **Depends on:** F4.2

**Body**
Render the primary image on the team-season page and in the history timeline, per [03-pages.md §3.4–3.5](03-pages.md).

**Acceptance**
- [ ] `loading="lazy"` and `srcset` on every image
- [ ] Explicit width/height so nothing reflows on load
- [ ] Falls back to flag + name when the image is absent

---

### `[F4.4]` Finalise the FGC palette

**Labels:** `phase:polish` `area:ui` `priority:p1` · **Estimate:** S · **Depends on:** F0.3

**Body**
Replace the placeholder token values with the researched palette in [06-palette.md](06-palette.md). The values are already verified from live CSS — what remains is choosing the **role assignment** (which of blue/purple is primary; see that doc's §4) and applying it.

**Acceptance**
- [ ] Role assignment chosen and recorded in [06-palette.md §4](06-palette.md)
- [ ] No file outside `app.css` contains a brand hex
- [ ] Blue text uses `#0059B2`, not `#007FFF` — the latter is 3.83:1 on white and fails AA for body-sized text
- [ ] Yellow `#DEA500` is never used for text on light (2.21:1); fills only, with near-black text
- [ ] Medal and alliance colours stay distinguishable from the brand colour in both themes

---

### `[F4.5]` Accessibility, performance budget and attribution page

**Labels:** `phase:polish` `area:a11y` `priority:p1` · **Estimate:** M · **Depends on:** F2.x

**Body**
Final pass: focus visibility, table semantics (`<caption>`, `scope`), no colour-only meaning, keyboard navigation of the theme toggle and filters, and the attribution/licence/takedown page.

**Acceptance**
- [ ] Keyboard-only navigation works on every route
- [ ] Automated audit reports no critical issues
- [ ] `app.css` ≤ 25 KB and `app.js` ≤ 12 KB, enforced in the build
- [ ] No archive page makes a post-load network request

---

# F5 — Live layer *(post-MVP)*

---

### `[F5.1]` Docker poller with schedule-driven cadence

**Labels:** `phase:live` `area:infra` `priority:p1` · **Estimate:** L · **Depends on:** F1.x

**Body**
Build the poller per [discovery 04 §4.1](../discovery/04-live-event-architecture.md) and [06 §2.2](../discovery/06-extraction-pipeline.md): 300 s heartbeat, 60 s during match blocks, 20 s within ±3.5 min of a `scheduledTime`, never when no event is running. Two-tier fetch: season bundle without details every poll, per-match detail once, after the match is final. Change detection via content hash.

**Acceptance**
- [ ] Upstream sees exactly one poller regardless of audience size
- [ ] A completed match's details are fetched exactly once
- [ ] Unchanged content produces no write
- [ ] Runs as a single container with no database and no persistent volume beyond the output directory

---

### `[F5.2]` Live origin writer (R2)

**Labels:** `phase:live` `area:infra` `priority:p1` · **Estimate:** M · **Depends on:** F5.1

**Body**
Reuse the **same emit code** as the archive, writing to the live origin with `Cache-Control` object metadata per [01-architecture.md §4.3](01-architecture.md). Paths are identical to the archive; only the destination and cadence differ.

**Acceptance**
- [ ] Artifact paths under the live origin match the archive exactly
- [ ] `live/<year>.json` carries `max-age=30, stale-while-revalidate=60`
- [ ] No page-code change is needed to consume the live origin
- [ ] R2 CORS is configured and verified **before** an event

---

### `[F5.3]` Live hydration in the client

**Labels:** `phase:live` `area:ui` `priority:p1` · **Estimate:** M · **Depends on:** F5.2

**Body**
Implement the hydration step in `app.js`: poll the page's declared live source, compare `seed`, and re-render only the containers whose data changed.

**Acceptance**
- [ ] Only pages for `live_years` poll; archive pages make no request
- [ ] An unchanged `seed` triggers no re-render and no DOM churn
- [ ] Re-rendering uses the same template functions as the build
- [ ] The page remains correct and complete when the live source is unreachable

---

### `[F5.4]` Degradation states and alerting

**Labels:** `phase:live` `area:ui` `priority:p1` · **Estimate:** M · **Depends on:** F5.3

**Body**
Implement the full failure matrix from [discovery 04 §5](../discovery/04-live-event-architecture.md) on both sides: stale-serving on the server, and live/paused/stale states on the client. Add alerting to the owner on poll failure or shape change.

**Acceptance**
- [ ] Upstream 5xx serves last-good with `stale: true`
- [ ] A payload failing shape validation is never published
- [ ] The client shows an explicit "updates paused" state after a threshold
- [ ] A silent failure during an event is impossible — every failure alerts

---

### `[F5.5]` Freeze

**Labels:** `phase:live` `area:data` `priority:p1` · **Estimate:** M · **Depends on:** F5.2

**Body**
Run once after finals: final fetch, backfill missing details, full validation, recompute derived aggregates, emit the complete static archive, bump `data_version` in `manifest.json`, and open a pull request for human review.

**Acceptance**
- [ ] The live season becomes an archive season with no shape change
- [ ] The archive rebuild after freeze is byte-identical on a second run
- [ ] The pull request carries the validation report
- [ ] The live store can then be emptied and the poller stopped

---

# Deferred

Kept as issues so the hooks are not forgotten. Each is already accommodated by the data contract.

---

### `[D1]` Historical reconstruction of 2017–2022 match data

**Labels:** `deferred` `area:data` · **Depends on:** owner-supplied dataset, or [discovery 10](../discovery/10-historical-reconstruction.md)

Hooks already in place: `match_source` per season (`api` | `video` | `mixed`), per-record `source` and `confidence`, identical canonical match shape for all sources.

---

### `[D2]` Crowdsourced video timestamps

**Labels:** `deferred` `area:data`

Hooks: `pipeline/overlays/videos/<year>.json` already holds timestamps and is already the authority; adding a `by` field and a moderation status is enough.

---

### `[D3]` Video OCR pipeline

**Labels:** `deferred` `area:data`

Full design in [discovery 11](../discovery/11-video-extraction-pipeline.md). ~90 min of CPU per event, but the real cost is per-year tuning.

---

### `[D4]` EPA-style ratings and cross-year normalization

**Labels:** `deferred` `area:data`

Hooks: `derived/ratings/<year>.json` reserved; the normalized component vocabulary already exists per season. **Must publish uncertainty intervals** — ~12 matches per team per season ([discovery 03 §2.5](../discovery/03-metrics-catalog.md)). Normalization should use "first N matches played" per the owner's suggestion, not week 1.

---

### `[D5]` User submissions, auth and moderation

**Labels:** `deferred` `area:infra`

Full design in [discovery 07](../discovery/07-user-content-and-moderation.md). Corrections must be applied in batches and bump `data_version`, never applied live.

---

### `[D6]` Robot photo gallery and Telegram submission bot

**Labels:** `deferred` `area:content`

Store on **Cloudflare R2** (zero egress), not Imgur — no SLA, unstable URLs, anti-automation posture. The media layer already separates the primary team image from additional media.

---

### `[D7]` Internationalisation

**Labels:** `deferred` `area:ui`

Hook: namespaced string keys from day one. Spanish is the highest-value second locale. Note RTL for Arabic.
