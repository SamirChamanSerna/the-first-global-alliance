# The-First-Global-Alliance

A static archive of **FIRST Global Challenge** results (seasons, teams, awards, rankings,
matches), modeled on The Blue Alliance. No framework, no bundler, no dependencies: the
output is plain HTML + one CSS file and works with JavaScript disabled.

## Requirements

Node 20+ — only to build. The generated site is static.

## Build

The pipeline is `fetch → normalize → build`. `data/raw/` is the source of truth;
`data/processed/` and `site/dist/` are **generated and not versioned**, so after a fresh
clone you must run `normalize` before `build`:

```bash
node scripts/normalize.js   # data/raw/  → data/processed/   (validates, fails loudly)
node site/build.js          # processed/ → site/dist/        (prints which source it used)
```

Then open **`site/dist/index.html`**. Internal links are rewritten to relative paths, so
the site works straight from disk — no server needed.

`build` refuses to run when raw data exists but processed does not, instead of silently
publishing mock data. To build the mock site on purpose:

```bash
node site/build.js --fixture
```

Optional data steps (only when you want to refresh or add input):

```bash
node scripts/fetch-archive.js [years…]  # download raw API responses → data/raw/api/
node scripts/fetch-flags.js             # mirror the team flags      → site/flags/
node scripts/make-manual-templates.js   # create empty CSV templates for hand-entered data
```

Hand-entered data (seasons, team continents, photos, videos, 2017–2023 matches) lives in
`data/raw/manual/` — see `data/raw/manual/README.md`.

## Serve locally (optional)

Opening the file from disk is enough. Use a server only if you want real URLs:

```bash
npx --yes serve site/dist          # or:  python -m http.server -d site/dist
```

## Editing

| Path | What it is |
|---|---|
| `site/templates/` | the pages and shared blocks (`pages.js`, `blocks.js`, `data.js`, `urls.js`) |
| `site/brand/` | identity master: `brand.js` (name, nav, **every UI string**), `tokens.css` (colors, type, radii) |
| `site/css/components.css` | component styles — only `var(--…)`, never literal colors |
| `data/raw/` | the source data (API snapshots + hand-entered CSVs) |
| `site/dist/` | generated — wiped and rewritten on every build, never hand-edit |

Conventions, the data contract and the non-negotiable rules are in **`CLAUDE.md`**.
