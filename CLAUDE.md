# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static site that archives **FIRST Global Challenge** results (seasons, teams, awards, rankings, matches), modeled on The Blue Alliance. Deliberately KISS: no framework, no bundler, no dependencies, no remote fonts or images, works with JavaScript disabled. 11 screens, defined in `docs/discovery/00-…-Especificación-del-Proyecto.md` §2 and `docs/web-style-guide/00-instrucciones-agentes.md` §2.

## Commands

```bash
node site/build-mock.js          # regenerate site/dist/ (requires Node 20+)
```

Then open `site/dist/index.html`. There is no test suite, linter, or package manager — `site/package.json` exists only to declare `"type": "module"`.

**The build is currently broken on Windows.** `site/build-mock.js` derives its output path from `new URL('./dist/', import.meta.url).pathname`, which yields `/C:/Users/...`; `fs.mkdirSync` then resolves that against the current drive and fails with `ENOENT: mkdir 'C:\C:\Users\...'`. Fixing it means using `fileURLToPath` — do that if you touch the build. `site/dist/` is committed precisely because it can't always be regenerated; it is **generated output**, wiped and rewritten by the build, so never hand-edit it. Edit `site/templates/`, `site/brand/`, or `site/css/` instead.

Verification greps (from the delivery checklist, §9 of the agent instructions) — all three should return empty:

```bash
grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(' site/css/components.css       # no literal colors outside tokens.css
grep -rn 'style=' site/templates                                     # no inline styles
grep -rn 'The FIRST Global Alliance' site --include=*.js | grep -v brand.js
```

## Architecture

A tiny template engine, evaluated at build time; everything is string concatenation. Data flows one way:

```
mock/mock.js  →  templates/pages.js  →  templates/blocks.js  →  dist/*.html
  (data)           (one fn per screen)     (shared markup)
```

- **`site/mock/mock.js`** exports the data contract: `seasons[]`, `T[code] → [name, continent]`, `M[y][]` (matches), `S[y][]` (standings), `AL[y][]` (alliances), `A[y][]` (awards). A real data layer must expose the **same shapes** — see the table in `00-instrucciones-agentes.md` §4. Award types are `ty: 'a'` (alliance, one tier) / `'p'` (podium, gold-silver-bronze) / `'n'` (non-tiered). Alliance size is 3 in qualifiers, 4 in round robin/playoffs/finals — derive it from `red[]`/`blue[]` lengths, never hardcode it.
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

- **Code comments, docs, and commit messages are in Spanish; UI strings are in English** (via `brand.labels`). Keep that split. `brand.lang` is an undecided item.
- `href` values in `mock.js` (`/match/2025_q12/`) are absolute site paths; `layout()` relativizes them at the end of the build. Some URLs are still assembled inside `blocks.js` — the spec flags this as a pending refactor into a single `site/templates/urls.js` module, so templates should not build URLs on their own.
- Flags come from `brand.flagPath(iso)` → `/flags/{iso}.svg` in lowercase, and are SVG placeholders generated by the build (flag emoji don't render on Windows). Real flag art is supplied by the project team.
- `docs/web-style-guide/03-pages.md` is **obsolete** for routes and templates; only three of its principles survive (declare partial coverage, no empty states for missing data, work without JS).
- Doc precedence: markup/CSS appearance → `demo-team-match.html` and `site/`; design rules → `02-guia-de-estilos.md`; routes and screen content → the functional spec; value shape → the data contract.
- `docs/discovery/01-hybrid-architecture.md` … `06-join-keys.md` plan the move from mock data to real data: static archive for past seasons, a DB-backed live layer for the current one, the raw-data standard, the pipeline, the staged plan, and the join-key standard for hand-entered data. `06` is authoritative for identifiers — in particular **`teamKey` is reassigned every season and is never a join key**; teams are identified by ISO alpha-3. Read them before changing how data reaches the templates.

## Open decisions (don't silently resolve these)

Interface language (en/es), search-results page, venue map, team photo carousel, real GameDay, breakdown row types, the "Honorable" medal symbol, and whether award counts mix honorable mentions with non-tiered awards. §8 and §9 of `00-instrucciones-agentes.md` list the full set.
