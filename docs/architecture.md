# Architecture

A static archive with one optional live layer. Everything is plain JavaScript and
string concatenation; there is no framework, bundler or runtime dependency.

## Data flow

```
data/raw/api/{year}.json        (trusted API snapshots, 2023–2026)
data/raw/manual/*.json          (metadata, rankings, breakdowns, awards, streams)
data/raw/manual/snapshots/*.json (API-shaped snapshots for 2017–2022)
                    │
                    ▼
          scripts/normalize.js
                    │
                    ▼
            data/processed/
                    │
                    ▼
site/templates/data.js → pages.js → blocks.js
                    │
                    ▼
               site/dist/            (static HTML + one CSS file)
```

`data/processed/` and `site/dist/` are generated and gitignored. `data/raw/` is the
source of truth. Nothing reads CSV.

## Season sources

| Seasons | Source | Notes |
|---|---|---|
| 2023–2026 | `data/raw/api/` | Full API snapshot, including `details`. 2026 is archived. |
| 2017–2019, 2022 | `data/raw/manual/snapshots/` | API is unreliable; the snapshot is built from hand-maintained rankings and awards. |
| 2020–2021 | `data/raw/manual/snapshots/` | No physical competition; awards only. |

`data/raw/manual/seasons.json` is the switchboard: `source` decides which snapshot to
read and `mode` (`archived`, `live`, `awards-only`) decides how the season is rendered.

## Modules

| Path | Responsibility |
|---|---|
| `scripts/normalize.js` | Reads the raw JSON, validates it, resolves country codes and writes the processed contract. |
| `scripts/lib/codes.js` | Bridges the API's two country-code spaces through alpha-2. |
| `scripts/fetch-archive.js` | Downloads verbatim API snapshots. |
| `scripts/fetch-flags.js` | Mirrors flag-icons into `site/flags/`. |
| `scripts/fetch-continents.js` | Fills `continent` in `data/raw/manual/teams.json`. |
| `scripts/fetch-playlist-thumbs.js` | Fills YouTube playlist thumbnails. |
| `scripts/dev.js` | Local server on `:3000` with live reload. |
| `scripts/poll-live.js` | Local twin of the Worker: writes `live.json` while a season is live. |
| `site/templates/data.js` | The only module that reads `data/processed/`; falls back to the fixture. |
| `site/templates/pages.js` | One function per screen and the route list. |
| `site/templates/blocks.js` | Shared markup and `layout()` (nav, footer, SEO, relative links). |
| `site/templates/urls.js` | The only module that builds site URLs. |
| `site/brand/brand.js` | Identity, labels (`t()`), meta descriptions and medals. |
| `site/brand/tokens.css` | Colors, typography and radii. |
| `site/css/components.css` | Components; only `var(--…)`, never literal colors. |
| `site/build.js` | Writes `site/dist/`, the sitemap, robots and 404. |
| `worker/worker.js` | Cloudflare Worker: cron poll, KV write, `/live.json`. |
| `site/brand/live.js` | Browser overlay, published only while a season is live. |

## Data contracts

- **Raw snapshot:** the same top-level shape as `/v1?year=YYYY`: `matches`, `rankings`,
  `round_robin`, `finals`, `alliances_round_robin`, `alliances_finals`, `awards`.
- **Processed:** documented at the top of `site/templates/data.js`.
- **Manual files:** documented in `data/raw/manual/README.md`.
- **Per-season maps:** `data/raw/manual/rankings/{year}.json` fixes the ranking columns
  and their order; `data/raw/manual/breakdown/{year}.json` fixes the match-breakdown
  rows. Both are required because the API's fields change every game.

## Live layer

While a season is `live`:

1. The Worker runs on a cron, fetches the full season snapshot and stores a reduced
   payload in KV (`LIVE_DATA`, key `live_json`).
2. The Worker serves it at `https://tfga.fgcmexico.com/live.json`.
3. The build publishes `live.js` and `live.json`, and sets `<html data-live-year="…">`.
4. `live.js` updates scores, rankings and alliance standings in the already-rendered HTML.

When the season is `archived`, the build publishes neither file, the site does not
request `/live.json`, and the Worker cron is disabled (`crons: []`). The static archive
is complete without the live layer.

## Validation and tests

`normalize` fails loudly on malformed data: unknown teams, duplicate ids, bad alliance
sizes, missing ranking positions, invalid URLs. `site/check.js` enforces the design
rules (no literal colors, no inline styles, no brand literals outside `brand.js`).
`node --test` runs the pipeline regression tests against the real data.

## History and roadmap

The project started as a mock-data static site, moved to real API data for 2024–2025,
added the live 2026 layer, and was migrated to a JSON-only pipeline when 2026 was
archived. The next season is a data and configuration exercise, not new code:
[`new-season.md`](new-season.md).

Known gaps are listed in [`../README.md`](../README.md) and
[`api-notes.md`](api-notes.md).
