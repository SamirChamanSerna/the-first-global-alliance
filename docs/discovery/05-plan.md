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

**S0 — data layer, no visual change (the critical path)**

1. Fix `site/build-mock.js`: it computes its output dir from `new URL(...).pathname`, which yields `/C:/…` on Windows and fails with `ENOENT: mkdir 'C:\C:\…'`. Use `fileURLToPath`. The build is currently broken on this machine.
2. `site/templates/urls.js` — one module owning every URL (already required by the agent instructions §4). Removes the hand-built `/team/…` links inside `blocks.js`.
3. `site/templates/data.js` — reads `data/processed/` instead of `mock/mock.js`, exposing the same shapes. `mock/mock.js` stays as the build fixture.
4. Rename `build-mock.js` → `build.js`. All 11 screens must render identically from the fixture before anything real is plugged in.

**S1 — real archived seasons (2024, 2025)**

5. `scripts/fetch-archive.js` + `scripts/normalize.js` per `03-raw-data-standard.md` and `06-join-keys.md`, with the validation pass.
6. Expand `seasons` to 2017–2026; `mode: awards-only` for 2020/2021 (their pages must render with the existing empty states — no matches, no rankings, no team timeline).
7. Replace `bd[4]` with the generic `breakdown[]` + `overlays/breakdown.{year}.json` (see `03-raw-data-standard.md` — this is the only contract change the real data forces).

**S2 — overlays (fill incrementally, pages degrade gracefully)**

8. `overlays/seasons.json` (city, venue, country, ISO, dates — manual).
9. `overlays/teams.json`: continent (required for `/teams/`), photo URL, social/contact.
10. `overlays/videos.json`: stream URL + timestamps.
11. Mirror flags into the repo; photos stay hotlinked to the public FIRST URLs.

**S3 — untrusted years (owner-supplied, parallel, no code after S1)**

12. CSV templates per `03-raw-data-standard.md`, filled for 2017–2023, validated at build.

**S4 — live season**

13. Docker worker (poll, validate, normalize, publish) — `04-pipeline.md`.
14. Cloudflare KV + Pages Function `/api/live.json`, `max-age=30`.
15. Live overlay script: re-render only `data-live` regions using the existing `blocks.js` functions; the pre-rendered HTML is the fallback.

**S5 — interface and launch**

16. Official logo (below).
17. Search (below).
18. Deploy to Cloudflare Pages; set `brand.lang` to `en` and fill the empty brand fields (`coverageDisclaimer`, `license`, `tagline`).
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
| Flags | Mirror into the repo (licence believed MIT) |
| Language | English primary, built so it can be translated (`01-hybrid-architecture.md`) |
| 2020 / 2021 | Awards only, permanently |
| Live latency | 60 s / 20 s polling + 30 s CDN cache ≈ ≤90 s worst case — accepted |
| DB | Cloudflare KV, one `live:snapshot` key behind a Pages Function |
| Breakdown | Per-season field map in `overlays/breakdown.{year}.json`, replacing the fixed `bd[4]` |

**Still open**

1. **Breakdown field lists** — the mechanism is settled, the actual per-season field maps are not written yet.
2. **`finals[].rankingScore`** — appears to carry something other than a ranking score; verify before displaying it.
3. **Locale layout** — `/{lang}/…` vs a runtime switch. Only matters when the second language lands.

**Owner-supplied inputs** (nothing blocks S0 on these)

- Team photo URLs — manual list, keyed by ISO alpha-3; gaps are fine.
- Season metadata, team continents, social/contact links.
- Match video URLs + timestamps.
- 2017–2023 matches / rankings, per `06-join-keys.md`.

## Risks

- **Breakdown is game-specific.** Without `overlays/breakdown.{year}.json` the match page has no rows to draw. Budget time for it per season.
- **Free-tier build limits.** Cloudflare Pages caps builds at 500/month; never rebuild per minute. The live JSON overlay exists precisely to avoid this.
- **Hand-entered data.** Team codes are the join key across four sources; a single typo breaks a page silently. Validation must fail the build.
- **API trust.** Only 2024/2025 matches and 2017–2025 awards are trusted today. Everything else stays absent until supplied, and the pages already know how to show that.

## Out of scope for now

GameDay, the venue map, the team photo carousel, real video thumbnails, search across match history — all still listed as pending in the agent instructions §8, and none of them block S0–S1.
