# 05 — Plan

Rule for everything below: **the UI and the markup are already correct.** We add a data layer underneath and the two specific fixes the owner named. No redesign.

## Scope

| Seasons | Content | Source |
|---|---|---|
| 2024, 2025 | full (matches, rankings, alliances, awards) | api.first.global |
| 2017–2023 | awards only for now; matches/rankings pending | API awards today, manual later |
| **2020, 2021** | **awards only, permanently** — no physical event | API |
| 2026 | live during the event, archived after | worker → DB |

## Stages

**S0 — data layer, no visual change — DONE**

1. ✅ Windows path bug fixed: `fileURLToPath` instead of `URL.pathname`, which yielded `/C:/…` and failed with `ENOENT: mkdir 'C:\C:\…'`.
2. ✅ `site/templates/urls.js` owns every site URL. `brand.nav[].href` stays in `brand.js` — the spec allows precomputed hrefs as config.
3. ✅ `site/templates/data.js` reads `data/processed/` and falls back to the `mock.js` fixture. Verified end to end against synthetic processed data (`datos: processed`, real content rendered, links resolved).
4. ✅ `build-mock.js` → `build.js`. `site/dist/` is **byte-identical** after the refactor: 165 pages, 16 placeholder flags.

**Found while doing S0** — both pre-existing, neither caused by the refactor, both S1 work:

- **`mode` is never read.** An `awards-only` season still generates `/rankings/{y}/`, `/matches/{y}/` and `/team/{code}/{y}/` with no data behind them.
- **`best()` throws on an empty array** (`Reduce of empty array with no initial value`), so any season without a playoff match — or without matches at all — crashes the build. The spec anticipates the partial-data case; it needs the explicit empty states, not a guard that hides it.

**S1 — real archived seasons — DONE (2024, 2025; awards 2017–2023)**

5. ✅ `scripts/fetch-archive.js` + `scripts/normalize.js` + `scripts/lib/codes.js`. `site/build.js` now emits **1359 pages from `data/processed/`**; the fixture output is unchanged (183 files, zero content differences).

What S1 turned up, all now handled and documented in `06-join-keys.md` / `02-data-sources.md`:

- The API uses **two country-code spaces** that disagree between sources *and between years* (`ATG`/`ANT`, `HPE`/`10`). The roster is canonical; alpha-2 is the bridge.
- **2020 and 2021 have nothing in the API**, awards included — they must be hand-entered.
- `field` and `played` only appear with `excludeMatchDetails=true`.
- Alliance awards put their captain in the slot matching their own tier.
- Mentor awards go to people, not countries; they are dropped with a warning.

6. ✅ The generator consumes `mode`: an `awards-only` season emits no rankings, matches or team-season pages, and a season with no playoff matches renders an explicit empty state instead of crashing (`best()` returns null, `hi()` shows "No match data").
7. ✅ `seasons` covers 2017–2026, with 2020/2021 as `awards-only`.
8. ✅ `bd[4]` replaced by the generic `breakdown[]` fed by `data/raw/manual/breakdown.{year}.json`. With no map written yet, the match page shows only the totals row — nothing is invented.

**S1 still open**

- **Team names, cities and dates are blank** for every season until `seasons.csv` is filled. The pages degrade cleanly (year instead of name, "No data" instead of a blank cell) but look thin.
- **`/teams/` renders five empty continents** because `continent` is empty for all 207 teams.
- The 2020/2021 insights pages show an empty awards block: the API has nothing for those years.
- `data/processed/2026/` does not exist yet, so 2026 renders empty rankings/matches pages until S4.

**S2 — hand-entered data (fill incrementally, pages degrade gracefully)**

9. `data/raw/manual/seasons.csv` — city, venue, country, ISO, dates. **Highest value: unblocks every page header.**
10. `data/raw/manual/teams.csv` — continent (required for the `/teams/` grouping), social/contact.
11. `data/raw/manual/photos.csv` — the team photo of each season, `year` + `team_code` + hotlinked URL (one per team and season; gaps are fine).
12. `data/raw/manual/videos.csv` — stream URL + timestamps. Still empty and still unwired: the 2026 links come from the extractor output (`manual/2026/2026.json`) plus the per-field streams (`manual/2026/streams.csv`), which already carry their own start second.
13. ✅ Flags mirrored: `node scripts/fetch-flags.js` — the whole flag-icons set (MIT, 270 files) plus the codes it lacks copied from results.first.global (`10_hope` and the four regional assets). 275 files, **2.9 MB**. results.first.global alone was 47 MB / 45 MB per page, so it is the fallback, not the source. Photos stay hotlinked (item 11).

**S3 — untrusted years (owner-supplied, parallel, no code after S1)**

13. `data/raw/manual/{year}/` filled for 2017–2019 and 2022–2023, validated at build. Templates already exist (`node scripts/make-manual-templates.js`).

**S4 — live season**

14. Docker worker (poll, validate, normalize, publish) — `04-pipeline.md`.
15. Cloudflare KV + Pages Function `/api/live.json`, `max-age=30`.
16. Live overlay script: re-render only `data-live` regions using the existing `blocks.js` functions; the pre-rendered HTML is the fallback.

**S5 — interface and launch**

17. Official logo (below).
18. Search (below).
19. Deploy to Cloudflare Pages; confirm `brand.lang` and fill the empty brand fields (`coverageDisclaimer`, `license`, `tagline`).
19. Post-2026: flip to `archived`, stop the container.

## The two UI changes

**Official logo.** Replace `brand.logoSvg` with `docs/web-style-guide/tfga-icon.svg`. It is not a drop-in:
- It is a **filled** mark (`fill="#000000"`, one path), but the current `.logo` rule is `fill:none; stroke:currentColor; stroke-width:2` — it will render invisible. It needs its own class (e.g. `.logo-mark{fill:currentColor;stroke:none}`) applied in `nav` and `hero`, without touching the existing `.logo` geometry used elsewhere.
- It is **not square** (600 × 523) and the path relies on the `translate(0,523) scale(-0.05,-0.05)` group transform for its orientation — strip the Inkscape/sodipodi metadata and the `pt` units, **keep the transform**, set `viewBox="0 0 600 523"`, and let CSS set the height (the current `width:22px;height:22px` would squash it).
- Per the brand rules: no hardcoded colors, so `currentColor`; `brand.themeColor` stays in sync with `--brand`.

**Search bar.** The form posts to `/search/`, which does not exist, and the `<datalist>` only offers suggestions. Build a static `/search/index.html`: a small client-side filter over an inlined index (teams, seasons, matches — a few KB), with the plain full index rendered in the HTML so it still works with JS off. No server, no third party.

## Decisions

**Settled**

| Decision | Outcome |
|---|---|
| Live layer | Static shell + one `live.json` overlay (option B) |
| Match URL slug | `{year}_{stage}{id}` → `2025_q12` (the mock's scheme was already right) |
| Team identity | ISO alpha-3 — **never `teamKey`**, reassigned every season (`06-join-keys.md`) |
| Photos | Hotlink the public FIRST URLs, from an owner-maintained manual list; no URL ⇒ the UI placeholder |
| Flags | Mirrored into the repo: flag-icons (MIT) as the source, results.first.global only for what it lacks. Alpha-2 file names, mapped from the site's alpha-3 codes. |
| Language | English primary, built so it can be translated (`01-hybrid-architecture.md`) |
| 2020 / 2021 | Awards only, permanently |
| Live latency | 60 s / 20 s polling + 30 s CDN cache ≈ ≤90 s worst case — accepted |
| DB | Cloudflare KV, one `live:snapshot` key behind a Pages Function |
| Breakdown | Per-season field map in `data/raw/manual/breakdown.{year}.json`, replacing the fixed `bd[4]` |

**Still open**

1. **Breakdown field lists** — the mechanism is settled, the actual per-season field maps are not written yet.
2. **`finals[].rankingScore`** — appears to carry something other than a ranking score; verify before displaying it.
3. **Locale layout** — `/{lang}/…` vs a runtime switch. Only matters when the second language lands.

**Owner-supplied inputs** (nothing blocks S0 on these)

- Team photo URLs — manual list, keyed by `(year, team_code)`; gaps are fine.
- Season metadata, team continents, social/contact links.
- Match video URLs + timestamps.
- 2017–2023 matches / rankings, per `06-join-keys.md`.

## Risks

- **Breakdown is game-specific.** Without `data/raw/manual/breakdown.{year}.json` the match page has no rows to draw. Budget time for it per season.
- **Free-tier build limits.** Cloudflare Pages caps builds at 500/month; never rebuild per minute. The live JSON overlay exists precisely to avoid this.
- **Hand-entered data.** Team codes are the join key across four sources; a single typo breaks a page silently. Validation must fail the build.
- **API trust.** Only 2024/2025 matches and 2017–2025 awards are trusted today. Everything else stays absent until supplied, and the pages already know how to show that.

## Out of scope for now

GameDay, the multi-photo carousel (one photo per team and season already ships; several per season is deferred), search across match history — all still listed as pending in the agent instructions §8, and none of them block S0–S1. Real video thumbnails are **no longer pending**: the match page and the play button of every match use the extracted link (or, failing that, that match's own field stream), and the thumbnail is YouTube's own `mqdefault.jpg`.

The **venue map on the Home page is dropped**, not deferred: purely decorative and out of current scope. The map placeholder element remains in the markup only for GameDay, which is itself a placeholder page.
