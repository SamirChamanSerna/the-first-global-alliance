# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static site that archives **FIRST Global Challenge** results (seasons, teams, awards, rankings, matches), modeled on The Blue Alliance. Deliberately KISS: no framework, no bundler, no dependencies, no remote fonts, works with JavaScript disabled. The only remote images are team photos, which are hotlinked from FIRST (never mirrored) and always degrade to the UI placeholder — see the data gotchas. 11 screens, defined in `docs/discovery/00-…-Especificación-del-Proyecto.md` §2 and `docs/web-style-guide/00-instrucciones-agentes.md` §2.

## Commands

```bash
node scripts/fetch-archive.js [years…]  # download raw API responses → data/raw/api/
node scripts/normalize.js               # data/raw/ → data/processed/ (validates, fails loudly)
node site/build.js                      # data/processed/ → site/dist/ (requires Node 20+)

node scripts/make-manual-templates.js   # create empty CSV templates for hand-entered data
```

Data pipeline: `fetch` → `normalize` → `build`. Only `data/raw/` (the source) and `site/flags/` (mirrored assets) are versioned — `data/processed/` and `site/dist/` are generated and gitignored, so **`normalize` must run before `build`** after a fresh clone or on a deploy. `build` refuses to run when raw data exists but processed does not, rather than silently publishing the fixture; pass `--fixture` to build the mock site on purpose.

The build prints which data source it used (`processed` or `fixture`). Then open `site/dist/index.html`. There is no test suite, linter, or package manager — `site/package.json` exists only to declare `"type": "module"`.

`site/dist/` is committed on purpose so the site can be previewed and published without building, but it is **generated output** — wiped and rewritten on every build, never hand-edit it. Edit `site/templates/`, `site/brand/`, or `site/css/` instead. Both `site/dist/` and `data/` are deliberately tracked; `.gitignore` says so at the top.

**Path handling on Windows:** always use `fileURLToPath(new URL(…, import.meta.url))`, never `URL.pathname` — `pathname` yields `/C:/…` and `fs.mkdirSync` then fails with `ENOENT: mkdir 'C:\C:\…'`. This bug broke the build once; it is fixed in `site/build.js`.

Verification greps (from the delivery checklist, §9 of the agent instructions) — all three should return empty:

```bash
grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(' site/css/components.css       # no literal colors outside tokens.css
grep -rn 'style=' site/templates                                     # no inline styles
grep -rn 'The FIRST Global Alliance' site --include=*.js | grep -v brand.js
```

## Architecture

A tiny template engine, evaluated at build time; everything is string concatenation. Data flows one way:

```
data/raw/  ──normalize.js──►  data/processed/  ─┐
  (api + manual CSVs)                            ├→ templates/data.js → pages.js → blocks.js → dist/*.html
                          mock/mock.js (fixture) ┘     (source select)
```

- **`site/templates/data.js`** is the only module that reads data. It loads `data/processed/` when present and falls back to the `site/mock/mock.js` fixture otherwise, so the site always builds — with real data or with test data. `pages.js` imports from here, never from `mock.js`. Expected processed files are documented at the top of the module.
- **`site/mock/mock.js`** is the fixture and the reference for the data contract: `seasons[]`, `T[code] → [name, continent]`, `PH[year][code] → url` (one photo per team **and season**, hotlinked externally), `M[y][]` (matches), `S[y][]` (standings — `{code, rank, cols: [[label, value]…]}`, plus `w/l/t/n/avg` only when that season has a record), `AL[y][]` (alliances), `A[y][]` (awards), `AW[]` (award catalogue, as `[name, desc, ty, tier]` tuples). Real data must expose the **same shapes** — see `00-instrucciones-agentes.md` §4. Award types are `ty: 'a'` (alliance, one tier) / `'p'` (podium, gold-silver-bronze) / `'n'` (non-tiered). Alliance size is 3 in qualifiers, 4 in round robin/playoffs/finals — derive it from `red[]`/`blue[]` lengths, never hardcode it.
- **`site/templates/urls.js`** is the only module that builds site URLs (`urls.team(code, year)`, `urls.match(id)`, …), plus `outPath(url)` to turn a URL into its output file path. Templates must not construct paths themselves. The one exception is `brand.nav[].href` in `brand.js`, which the spec allows as precomputed config.
- **`site/templates/pages.js`** has one function per screen (`home`, `ins`, `teams`, `awards`, `rankings`, `matches`, `gameday`, `th`, `ts`, `mp`) and the exported `pages()` that assembles the full route list. It is dense, terse, and variable-heavy (`Y`, `L`, `sn`, `tl`, `cnt`, `won`) — read it slowly before editing.
- **`site/templates/blocks.js`** holds the shared markup (`dt`, `matchRow`, `matchList`, `scoreboard`, `breakdown`, `awardBlock`, `box/boxes`, `dd`, `kvr`, `pip`, `hero`) plus `layout()`, which wraps a page in nav/footer and rewrites absolute internal `/links` to relative `index.html` paths so `dist/` opens straight from disk.
- **`site/brand/brand.js`** is the identity master: name, tagline, logo SVG, nav, footer, flag path, medals, and **every UI string** under `labels`. `t(key)` throws at build time on a missing key — that's intentional, it keeps stray literals out.
- **`site/brand/tokens.css`** is the only place colors, typography, and radii may be defined (`light-dark(a, b)`); **`site/css/components.css`** may only use `var(--…)`. The build concatenates both into a single `dist/site.css`.

Changing the brand means editing exactly three files: `brand.js`, `tokens.css` (and keeping `brand.themeColor` in sync with `--brand`), and `favicon.svg` — never `components.css`.

## Non-negotiable rules

`docs/web-style-guide/00-instrucciones-agentes.md` is the operative spec; read it before touching templates. Its rules, condensed:

1. **Copy, don't rewrite.** Markup comes from `blocks.js` or from `docs/web-style-guide/demo-team-match.html` (components are delimited by `<!-- @component:NAME -->`). Don't redesign components.
2. **CSS class names are the API** — don't rename or invent them. A new component needs a written proposal in `docs/web-style-guide/05-componentes-pendientes.md` and approval first.
3. No `style=` attributes. No literal colors/flows/radii outside `tokens.css`. No literal brand or UI text in templates — use `t("key")` and `brand.*`.
4. **Light and dark differ only in color**; desktop and mobile differ only in layout.
5. **No JS required.** JS (sortable `dt` tables, theme toggle) only enhances; initial order must be correct in the HTML.
6. **Missing data is an explicit state** ("No data", "Did not play playoffs", "No awards") — never `0`, never `0–0`, never a blank.
7. **Don't invent data or field names.** The style guide calls this `SIN EVIDENCIA`: if a value isn't evidenced, say so and ask.
8. Winning alliance gets the saturated tone, losing the faint one — in `matchRow` and `scoreboard` the tone follows *who won*, in `breakdown` it marks *total vs detail* rows.
9. A specific match is always rendered with the standard `matchRow`; never as prose or an ad-hoc table. In Insights, the video card goes **below** the row.
10. Awards on team pages always show the tier (`kvr` + `pip`); counts only on `/awards/` and Team Overview KPIs.

If two docs contradict each other, **stop and report it** — don't pick one.

## Conventions and gotchas

- **Code comments, docs, and commit messages are in Spanish; UI strings are in English** (via `brand.labels`). Keep that split. English is primary but every label must stay translatable: whole phrases with placeholders, never a string glued together from fragments (see `docs/discovery/01-hybrid-architecture.md`).
- Site URLs are absolute while rendering (`/team/MEX/`); `layout()` rewrites them to relative `index.html` paths at the end, so `dist/` opens straight from disk. Build them through `urls.js` — never inline a path in a template.
- Flags live in `site/flags/`, mirrored by `node scripts/fetch-flags.js`. Two things to know: they are named by **alpha-2** (`mx.svg`, not `mex.svg`), resolved through `flags.json` + `data.js` → `flagFile()`; and the source is **flag-icons** (MIT), with results.first.global used only for the codes flag-icons lacks. Using results.first.global for everything costs 47 MB — see `docs/discovery/02-data-sources.md`. The build copies real flags and only draws a grey placeholder for what is missing, so no page shows a broken image.
- The logo in `brand.logoSvg` is the official icon. It is a **filled** mark with a non-square `viewBox` (600×523) whose orientation depends on its `<g transform>` — do not strip the transform or add `preserveAspectRatio="none"`, and keep `.logo` as `fill:currentColor;stroke:none`.
- `docs/web-style-guide/03-pages.md` is **obsolete** for routes and templates; only three of its principles survive (declare partial coverage, no empty states for missing data, work without JS).
- Doc precedence: markup/CSS appearance → `demo-team-match.html` and `site/`; design rules → `02-guia-de-estilos.md`; routes and screen content → the functional spec; value shape → the data contract.
- `docs/discovery/01-hybrid-architecture.md` … `06-join-keys.md` plan the move from mock data to real data: static archive for past seasons, a DB-backed live layer for the current one, the raw-data standard, the pipeline, the staged plan, and the join-key standard for hand-entered data. `06` is authoritative for identifiers — in particular **`teamKey` is reassigned every season and is never a join key**; teams are identified by ISO alpha-3. Read them before changing how data reaches the templates.

## Data gotchas

- **Country codes are messy.** `api.first.global` uses two alpha-3 spaces that disagree between sources *and between years* (`ATG`/`ANT`, `HPE`/`10`). The roster's code is canonical; `scripts/lib/codes.js` bridges via alpha-2. Never join on `teamKey` — it is reassigned every season. See `docs/discovery/06-join-keys.md`.
- **Awards identify countries by name and alpha-2, never alpha-3**, and alliance awards put their captain in the slot matching their own tier (`silver` for the silver award), not always in `gold`.
- **Team photos are per (team, year), never per team.** Members change every season, so `photos.csv` is keyed `(year, team_code)` and feeds `PH[year][code]`; there is no team-level photo. URLs are hotlinked from FIRST (never mirrored) and only `http(s)://` is accepted — a bad scheme fails the build rather than being dropped, because the row is an explicit claim that the URL is that team's photo. A missing row is the normal "no photo" state and renders the `.photo` placeholder.
- **2020 and 2021 exist in neither the API nor any fetch** — awards included. Those seasons are hand-entered.

## Known gaps

- What is still missing is input only a human can supply, not code: `teams.csv` has the social/contact columns empty for all 207 rows and `continent` empty for 3 teams (those 3 match none of the five groups on `/teams/`, so they are simply not listed there). `photos.csv` and `videos.csv` are empty templates, so every team page renders the photo placeholder and no match has a video. 2020/2021 (no competition) and 2026 (live) have no match or award records yet. Not bugs — just missing input. See `docs/discovery/05-plan.md` S2.

## Open decisions (don't silently resolve these)

Search-results page, venue map, the **multi-photo** carousel (one photo per team and season already ships; several per season is deferred), real GameDay, breakdown row types, the "Honorable" medal symbol, and whether award counts mix honorable mentions with non-tiered awards. §8 and §9 of `00-instrucciones-agentes.md` list the full set; `docs/discovery/05-plan.md` tracks what is settled (English primary, Cloudflare KV, per-season breakdown map, photos hotlinked) and what is not.
