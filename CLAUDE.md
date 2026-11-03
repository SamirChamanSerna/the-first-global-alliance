# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in
this repository.

## What this is

A static archive of **FIRST Global Challenge** results (2017–2026), modelled on The Blue
Alliance. No framework, no bundler, no client-side dependencies and no remote fonts. The
site works with JavaScript disabled. It is deployed at <https://tfga.fgcmexico.com/>.

## Commands

```bash
node scripts/normalize.js          # data/raw/ → data/processed/ (validates, fails loudly)
node site/build.js                 # data/processed/ → site/dist/
node scripts/dev.js                # local server on :3000 with live reload

node scripts/fetch-archive.js [years…]   # refresh API snapshots → data/raw/api/
node scripts/fetch-flags.js              # mirror flags → site/flags/
node scripts/fetch-playlist-thumbs.js    # fill playlist thumbnails
node scripts/check.js                    # design/token checks
node --test                              # pipeline regression tests

node scripts/poll-live.js [--watch]      # live overlay while a season is live
```

The pipeline is `fetch → normalize → build`. `data/processed/` and `site/dist/` are
generated and gitignored; `normalize` must run before `build` after a fresh clone. The
build refuses to publish the mock fixture when `data/raw/` exists; pass `--fixture` to
build the mock site on purpose.

`site/dist/` and `data/processed/` are **never hand-edited**. Edit `data/raw/`,
`scripts/`, `site/templates/`, `site/brand/`, `site/css/` or `worker/`.

## Data pipeline (JSON only)

Every season has one API-shaped snapshot:

- `data/raw/api/{year}.json` — verbatim response of `https://api.first.global/v1?year=YYYY`
  for the trusted seasons (2023–2026).
- `data/raw/manual/snapshots/{year}.json` — same shape, built from hand-maintained data
  for the untrusted seasons (2017–2022).

`seasons.json` decides which one to read with `source: "api" | "manual"`. `mode` is
`archived`, `live` or `awards-only`; only a `live` season turns on the overlay and the live
GameDay.

The rest of the manual inputs are JSON in `data/raw/manual/`:

```
seasons.json          team metadata, dates, mode, source
teams.json            roster, continent, flag key
photos.json           one photo per (season, team)
playlists.json        one YouTube playlist per season
awards/{year}.json    team awards for seasons where the API has none
breakdown/{year}.json match-breakdown rows for a season
rankings/{year}.json  ordered ranking columns and labels
streams/{year}.json   field/day streams for the live season
videos/{year}.json    video extractor output
```

The full shapes are in `data/raw/manual/README.md`.

## Architecture

```
data/raw/  ──normalize.js──►  data/processed/  ─┐
                                                ├→ templates/data.js → pages.js → blocks.js → dist/*.html
                    mock/mock.js (fixture) ─────┘
```

- **`site/templates/data.js`** is the only module that reads processed data. It falls back
  to the fixture in `site/mock/mock.js` when `data/processed/` is incomplete.
- **`site/templates/urls.js`** is the only module that builds site URLs.
- **`site/templates/pages.js`** has one function per screen and the exported `pages()`. It
  is dense and variable-heavy; read it slowly.
- **`site/templates/blocks.js`** holds shared markup and `layout()`, which wraps a page in
  nav/footer, emits SEO metadata and rewrites absolute internal links to relative ones.
- **`site/brand/brand.js`** is the identity master: name, logo, nav, labels (`t()`), meta
  descriptions (`metaText()`) and medals. `t()` and `metaText()` throw at build time on a
  missing key.
- **`site/brand/tokens.css`** is the only place colors, typography and radii are defined.
  `site/css/components.css` may only use `var(--…)`. The build concatenates both into
  `dist/site.css`.
- **`site/brand/ui.js`** is the always-loaded UI script (search). **`site/brand/live.js`**
  is only published when a season is `live`.
- **`worker/worker.js`** and **`scripts/poll-live.js`** are twins: the same transform of
  the live snapshot, one on Cloudflare's cron and one locally. Edit both or the site
  behaves differently locally and in production. `wrangler.jsonc` sets `SEASON_YEAR`.

## Non-negotiable rules

1. **Copy, don't rewrite.** Markup comes from `blocks.js` or from
   `docs/web-style-guide/demo-team-match.html`. Don't redesign components.
2. **CSS class names are the API.** Don't rename or invent them. A new component needs a
   proposal in `docs/web-style-guide/05-componentes-pendientes.md` and approval.
3. No `style=` attributes. No literal colors/radii outside `tokens.css`. No literal UI text
   in templates: use `t("key")` and `brand.*`.
4. **Light and dark differ only in color**; desktop and mobile differ only in layout.
5. **No JS required.** JS (sortable tables, theme toggle, live overlay) only enhances; the
   initial order must be correct in the HTML.
6. **Missing data is an explicit state** ("No data", "No awards"), never `0`, never `0–0`,
   never a blank. The one deliberate exception: a team that did not reach the playoffs
   shows no alliance row at all.
7. **Don't invent data or field names.** If a value is not evidenced, say so and ask.
8. Winning alliance gets the saturated tone, losing the faint one.
9. A specific match is always rendered with `matchRow`, never as prose or an ad-hoc table.
10. Awards on team pages always show the tier (`kvr` + `pip`).

## Conventions and gotchas

- **Code comments and commit messages are in Spanish; public documentation and UI
  strings are in English.** UI strings live in `brand.labels` / `brand.meta` and are
  whole phrases with placeholders, never fragments glued together. The original visual
  guide in `docs/web-style-guide/` remains in Spanish.
- **Path handling on Windows:** use `fileURLToPath(new URL(…, import.meta.url))`, never
  `URL.pathname` (it yields `/C:/…` and breaks `mkdir`).
- **Flags** are named by alpha-2 (`mx.svg`), resolved through `flags.json` and
  `data.js → flagFile()`. They come from flag-icons (MIT); results.first.global is only
  the fallback for codes flag-icons lacks.
- **Team codes are messy.** The roster code is canonical; competition codes are bridged
  through alpha-2 by `scripts/lib/codes.js`. **Never join on `teamKey`** — it is reassigned
  every season.
- **Photos are per (team, season)**, hotlinked from FIRST and never mirrored. A missing
  row is the normal "no photo" state.
- **Videos:** `video` is the exact deep link (or null), `stream` the field stream of that
  match's own day (or null). A match with neither shows no play button.
- **Breakdown is season-specific.** `data/raw/manual/breakdown/{year}.json` declares the
  rows; the API's `details` fields are scalar red/blue fields, not tuples.
- **Ranking columns are season-specific.** `data/raw/manual/rankings/{year}.json` fixes
  their order and labels.
- **Awards to individuals, mentors or institutions are excluded** from the site. The
  source files keep them for the record.
- **2020 and 2021** had no competition: awards only. **2017–2019 and 2022** have no match
  records; 2022's API team association is corrupt and is not used.
- **2026 is archived.** The Worker and `live.js` are dormant until a new season is set to
  `live`.

## Documentation map

- `README.md` — public overview, quick start, limitations, license.
- `docs/architecture.md` — data flow, modules and the live layer.
- `docs/api-notes.md` — API structure, code spaces, missing data and quirks.
- `docs/new-season.md` — the checklist for a new season, live and archive.
- `data/raw/manual/README.md` — the manual JSON formats and validation rules.
- `docs/web-style-guide/` — the visual specification, style guide and canonical demo.
- `worker/README.md` — Worker deployment and teardown.

If two docs contradict each other, **stop and report it** — don't pick one.
