# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An independent static archive for the **FIRST Global Challenge**, built at ~$0 hosting cost: no framework, no database, no server between the reader and the data. JSON files → templates → HTML files → a CDN. Node ≥22, ESM throughout, **zero runtime dependencies** — `package.json` has no `dependencies` block and should keep it that way.

Three trees, and the split matters more than anything else here:

| Tree | Role | In git? |
|---|---|---|
| `pipeline/raw/`, `pipeline/lookups/`, `pipeline/overlays/` | inputs — fetched or hand-written | ✅ |
| `pipeline/normalized/`, `data/`, `dist/` | derived, byte-deterministically | ❌ |

## Commands

There is no linter and no test framework. `npm run check` is the verification suite.

```bash
npm run probe            # verify api.first.global still behaves; writes nothing
npm run fetch            # season bundles + registries → pipeline/raw/api/  (the only networked step)
npm run fetch:details    # per-match scoring breakdowns; resumable, skips what's on disk

npm run identity         # rebuild pipeline/lookups/team-identity.json from observed codes
npm run seasons          # rebuild pipeline/lookups/seasons.json

npm run normalize        # raw → pipeline/normalized/          [--years 2023,2024]
npm run quality          # data-quality report; non-zero exit on any error finding
npm run emit             # normalized + lookups → data/v<N>/   (runs the quality gate first)
npm run pipeline         # normalize && emit

npm run build            # site → dist/                        [--only teams] [--limit 20]
npm run serve            # serve dist/ over HTTP               [--port 8080] [--open]

npm run flags            # vendor flag SVGs from lipis/flag-icons
npm run videos           # video-overlay coverage report, per season
npm run style            # copy tokens.css/components.css/brand.js from the style guide [--check]
npm run test:determinism # prove two pipeline runs produce identical bytes
npm run check:links      # fail on any internal link with no page behind it (needs dist/)
npm run check            # quality && videos && test:determinism && style --check && check:links
npm run issues           # create GitHub issues from docs/plan/05-backlog.md  [--dry-run]
```

`npm run build` does **not** run the pipeline. A full rebuild from scratch is `npm run pipeline && npm run build`.

There is no CI config in the repo yet, and no `_headers` file — both are open items in F0.

## Architecture

### The pipeline, layer by layer

1. **`pipeline/fetch/`** — the only code that talks to the network. Raw responses are written **verbatim** and committed; they are evidence. Upstream has already lost data once (2022 kept its standings but not its matches), so `raw/` is the one thing that cannot be recreated.
2. **`pipeline/lookups/`** — hand-curated registry (`team-identity.json`) and season metadata (`seasons.json`). The only two files a human edits year to year.
3. **`pipeline/overlays/videos/<year>.json`** — the hand-written video dataset. A **build input**: merged into match rows at emit time, never published, never fetched by a browser.
4. **`pipeline/normalize/`** — reconciles upstream's two disagreeing payload shapes into one canonical shape. Writes `pipeline/normalized/<year>/{matches,standings,awards,alliances}.json`. Reports upstream defects; never silently corrects them.
5. **`pipeline/quality/`** — `checks.mjs` returns findings, it does not print and does not exit. `emit/cli.mjs` uses it as a gate (errors → refuse to publish) and `quality/cli.mjs` formats it for a human. One implementation of each check.
6. **`pipeline/emit/`** — writes `data/v<N>/`, the **runtime surface** browsers fetch and the live origin will mirror.
7. **`site/build.mjs`** — route table → template → `dist/<route>/index.html`.

### The two rules that hold the whole thing together

**One definition per page.** `pipeline/emit/payloads.mjs` defines what each page contains. `emit/cli.mjs` writes those payloads to disk; `site/build.mjs` inlines the *same payload objects* into HTML. The build therefore **never reads `data/`** — if it did, there would be two implementations of "what a team-season page contains". `pipeline/emit/context.mjs` (`loadContext()`) is the shared in-memory load of everything.

**Templates are pure string functions.** `site/templates/**` return HTML strings — no DOM, no framework. That is what lets the same module run in Node at build time and in the browser at hydration time. `build.mjs` copies `site/templates/` to `dist/tpl/` precisely so the browser imports the build's own renderer. Losing that property is how the "one renderer, not two" guarantee dies.

### Data origins (designed, not yet implemented)

A page is handed the absolute URL of its data and does not know whether that URL points at a frozen archive or a live mirror. `build.config.json` resolves the origin for each artifact **at build time**; page code contains no origin logic. `active_season` also comes from there, never from the visitor's clock. The live layer (R2 + a poller) is phase F5 and changes no page code.

### Conventions

- `data_version` in `build.config.json` is the version segment in every published URL (`/data/v<N>/…`). Bumping it is how a correction retires cached URLs.
- Emit is **byte-deterministic**: sorted keys, explicit array order, fixed float precision, LF, no timestamps in artifacts. The derived trees are gitignored, which is only safe because of this — `npm run test:determinism` exists because a break in determinism is otherwise invisible.
- Shared HTML helpers live in `site/templates/html.js` (`esc`, `attr`, `wlt`, `pct`, `num`) and reusable blocks in `site/templates/blocks.js`. One implementation per block; no per-page variants.

## Invariants that bite

These are all silent-failure traps. Each was discovered the hard way, and each is documented in `docs/`.

- **Never join on `teamKey`.** It is a per-season participant number; it means a different team every year.
- **Never join on `countryCode` alone.** It is unique *within* a season, not across seasons — code `15` is "Team Asia" in 2017 and "Chinese Taipei" in 2024–2025. Always go through `resolveTeamId(identity, year, code)` (`pipeline/normalize/identity.mjs`), which checks the season override table first and **throws** on a contested code with no override. A guess here is worse than a failure.
- **Never join on `eventKey`** — it has two coexisting formats that disagree within the same season.
- **`match_id`** = `<year>:<tournamentKey>:<id>`. The `id` alone is per-tournament, not global. Match *routes* use the normalized stage (`/matches/2025/ranking/10/`), never the raw `tournamentKey`.
- **`data_coverage`** (`full` | `standings_only` | `awards_only` | `upcoming` | `none`) is the switch for what a page renders. Never `year === 2025`. One template serves 2019 (awards only) and 2025 (everything) with no special case.
- **W-L-T is derived from `matches`, never from `rankings[].wins/losses/ties`** — the upstream ranking rows are internally inconsistent (2025: 148 of 181 rows report more results than games played). 2019 is the sole pre-2023 exception where the ranking record is usable.
- **Absent data is `null`, never `0`.** Zero is a claim. The UI must say "not published" rather than show a zero it does not have. `num()` and `pct()` in `html.js` render an em dash for null.
- **A video `day` is never inferred** — not from `scheduled_time`, not from match order. No day → no link at all. A wrong VOD is a false statement about a real event; a missing one is an honest gap.
- **Adapter `positioning` scales are not comparable across seasons** (`0,1,2` in 2023; `0,0.125,…,0.5` in 2025). `positioning` unifies the *shape* so code stays generic — it does not make the values chartable together.

## Design authority

`docs/web-style-guide/` (Spanish, draft v2) is the **binding visual contract**. It is derived from screenshots of The Blue Alliance's beta site and adapted to FGC, and it is explicit that values marked `≈` are estimates to be verified with DevTools, not to be treated as final. Read it before touching any styling.

- `docs/web-style-guide/Demo-team-match/` is the reference implementation of the token system: `tokens.css` (the single source of colour/type/shape, using `light-dark()`), `brand.js` (name, logo, nav, and **every** fixed UI string via `t(key)` — templates must not contain literal UI text), `components.css`, and a working `demo-team-match.html`.
- Section 7 of the style guide is a **list of prohibited patterns** (gradients, shadows, transitions, hero sections, giant metric tiles, emoji as UI icons, pill badges everywhere, decorative imagery). Section 1 is its positive counterpart: dense, information-first, emphasis carried by typography and cell background.

**How the guide reaches the site.** `tokens.css` and `components.css` are copied **verbatim** from the demo by `scripts/sync-style-guide.mjs`; they are never edited in `site/`, and `npm run check` fails if a copy drifts from the guide. Everything the guide defines but the demo does not implement — the §3.13 data table, the §3.14 charts, the §3.3 carousel dots — lives in `site/css/guide.css`, each rule citing its section. `site/templates/brand.js` is seeded from the demo and then owned by the repo, because it holds this project's own strings. The three CSS files are concatenated into one `dist/assets/app.css` at build time.

Templates are assembled from the demo's `<!-- @component:… -->` blocks, use only the class names those files define, and contain **no literal UI text and no literal colours** — labels come from `t("key")`, colours from `var(--…)`. `npm run style --check` guards the copies; `npm run check:links` fails on any internal link with no page behind it.

## Working agreements

- **Conversation in Spanish; anything written into the repo in English** — code, comments, doc prose, commit messages.
- **Repetitive work belongs in a committed script.** API calls, bulk generation and bulk edits go into `scripts/` or `pipeline/` and get run, never performed turn-by-turn.
- **The owner makes the commits.** Do not run `git commit` or `git push` unless asked.

## Where to read more

`docs/plan/` is the reference for **what we build**; `docs/discovery/` is the reference for **why** things are the way they are.

| Doc | Contents |
|---|---|
| `docs/plan/README.md` | Decisions D1–D13, scope, and what is deliberately deferred |
| `docs/plan/01-architecture.md` | Data-origin contract, render model, caching, the git-tree rule |
| `docs/plan/02-data-contract.md` | Artifact layout and shapes, normalization rules §4 (the source of most invariants above) |
| `docs/plan/03-pages.md` | Page inventory: route, template, data source, blocks |
| `docs/plan/04-roadmap.md` | Phases F0–F5 and current status |
| `docs/plan/05-backlog.md` | Issue-ready backlog, created by `scripts/create-issues.mjs` |
| `docs/plan/06-palette.md` | Verified FGC brand colours and measured contrast ratios |
