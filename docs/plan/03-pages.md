# 03 — Page Inventory

> Every route, the one template that renders it, the one data file it reads, and the blocks it draws. If a page is not in this table it is not in the MVP.
>
> **Reading the "Data" column:** these are the artifacts the **build** reads. Published paths carry a version segment (`data/v<N>/…`, [02 §2](02-data-contract.md)); it is omitted here for legibility and resolved by the build. At runtime an archive page fetches **nothing** — its data is inlined into the HTML.

---

## 1. Route table

| Route | Template | Data (one fetch) | Extra | Live |
|---|---|---|---|---|
| `/` | `home` | `manifest.json` | — | — |
| `/seasons/` | `season-index` | `seasons.json` | — | — |
| `/seasons/<year>/` | `season` | `seasons/<year>/index.json` | — | ✓ if live year |
| `/seasons/<year>/matches/` | `season-matches` | `seasons/<year>/matches.json` | `pipeline/overlays/videos/<year>.json` (build input) | ✓ if live year |
| `/teams/<id>/` | `team-history` | `data/teams/<id>/index.json` | — | ✓ active-season card |
| `/teams/<id>/<year>/` | `team-season` | `data/teams/<id>/<year>.json` | — | ✓ if live year |
| `/matches/<year>/<stage>/<id>/` | `match` | `data/matches/<year>/<stage>/<id>.json` | — | ✓ if live year |
| `/medals/` | `medals` | `data/medals.json` | — | — |
| `/insights/` | `insights-all` | `data/insights/index.json` | — | — |
| `/insights/<year>/` | `insights-year` | `data/insights/<year>.json` | — | — |
| `/calculator/<year>/` | `calculator` | `data/seasons/<year>/index.json` + `site/calc/<year>.js` | — | — |
| `/search/` | `search` | `data/search-index.json` | client-side filter | — |
| `404` | `not-found` | none | — | — |

**Thirteen templates.** That is the entire frontend. A new season adds zero templates; a new season only adds data.

### 1.1 URL conventions

- All lowercase, trailing slash, plural collections (`/teams/af/2025/`).
- `<id>` is the path segment of the upstream match id within its stage (`/matches/2025/ranking/214/`).
- `<stage>` is always `ranking` \| `round_robin` \| `finals` — never `t2`/`t3`/`t4`.
- Every link in the UI is **precomputed into the data** (`href` fields). Templates never build URLs.

---

## 2. Shared blocks

Small composable pieces, each a function in `site/templates/blocks.js`. Every page is assembled from these.

| Block | Renders | Notes |
|---|---|---|
| `flag(team_id, size)` | SVG flag | Falls back to a country-code chip for entities with no flag. |
| `teamLink(team_id)` | Flag + name, linked | Used everywhere a team is named. |
| `medalPip(class)` | Gold/silver/bronze/honorable chip | Color **and** text label — never color alone. |
| `record(w, l, t)` | `5–7–0` + `41.7%` | Tabular numerals. |
| `matchRow(match, opts)` | One row of a match list | The most reused block in the project. See §3. |
| `matchList(matches, opts)` | Grouped by stage | Played above upcoming, or chronologically by stage. |
| `rankDelta(from, to)` | ▲4 / ▼2 / — | |
| `total(stat, unit)` | Statistic tile | |
| `coverageNotice(coverage, span)` | Informational banner | **Mandatory** wherever the data is partial. |
| `liveBadge(state)` | LIVE / PAUSED / STALE | Only on live pages. |
| `videoLink(video)` | Play icon | Omitted when `video` is null. |

### 2.1 `matchRow`

The single most important block. Rendered on the team page, team-season page, season match list, match page (as context) and inside the live hydration.

```
┌──────────────┬────────┬──────────────────────────────┬──────┬─────────┐
│ ▲ Match 214  │ 11:15  │  🇦🇫 Afghanistan  …          │ 88–74│  ▶  ⌄   │
│   Ranking    │ Field 3│  (the viewer's team marked)  │      │         │
└──────────────┴────────┴──────────────────────────────┴──────┴─────────┘
```

- **The viewer's team is highlighted** — a left border in the brand color, bold name, and an `aria-current`-adjacent class. `is_team_red` is precomputed so the alliance color is available without a lookup.
- The match **number and stage are a link** to the match page.
- `▶` is the video link (only when `video.url` exists); `⌄` expands the breakdown inline. With JS disabled, `⌄` is a plain link to the match page.
- Unplayed matches show the **estimated time** and "Field 3", never a score of `0–0`.
- `no_show` / `disqualified` participants are marked, not hidden.

---

## 3. Page specifications

### 3.1 `/` — Home

| Block | Content |
|---|---|
| Header | Logo, nav (Seasons · Teams · Insights · Medals), search, theme toggle |
| Active season card | Shown only when `active_season` is set. Dates, host, live standing of the day, next matches. |
| Seasons strip | One card per season 2017→2026: year, host, flag, theme. Award-only seasons are visually lighter and labelled. |
| Leaders | Medal table top 5, most seasons participated, best single-season rank. |
| Footer | Data source attribution (FIRST Global), last updated, coverage disclaimer, licence. |

### 3.2 `/seasons/<year>/` — Season

Driven entirely by `data_coverage`. Sections that have no data are **omitted, not emptied**.

| Block | Content | Requires |
|---|---|---|
| Header | Year, host city + country flag, dates, theme, game name | always |
| Challenge summary | `meta.synopsis` | always |
| Scoring | `meta.score_formula` rendered as a readable formula + **link to `/calculator/<year>/`** | always |
| Coverage notice | "Match data is not available for this season" | when `coverage != full` |
| Standings | Top 10 + link to the full list | `full` \| `standings_only` |
| Awards | Grouped by award, recipients with medal class, flags | always |
| Season-by-the-numbers | Teams, matches, awards count | `full` |
| Links | All matches, insights for this season | `full` |

### 3.3 `/seasons/<year>/matches/` — Season match list

All matches of the season, grouped by stage, filterable client-side by field, played/unplayed and team. This is the one page that legitimately downloads the ~90 KB season file.

### 3.4 `/teams/<id>/` — Team History *(default team route)*

**Resolution of "current season vs history" (decision D13):** this route always renders the history view. When `active_season` is set **and** the team participates in it, the active season is promoted to a **hero card at the top**, above the timeline, hydrated live. The timeline stays below. Nothing changes based on the visitor's clock.

| Block | Content |
|---|---|
| Header | Flag, name, entity type, first season, seasons active, ISO codes |
| Active season hero | *only when applicable* — current standing, today's/next matches, live badge |
| Career snapshot | Seasons · Matches · W–L–T · Win rate · Medals, **with the coverage denominator stated** |
| Medal cabinet | Gold / Silver / Bronze / Honorable, complete 2017→present |
| Timeline | Newest first. Per year: image, year, host, awards, rank, max score, W–L–T, win %, coverage label, optional `summary` |
| Awards list | Every award, by year, with class |
| Links | Out to each season's team page |

Rows for seasons with no competition data render the year, the awards and an explicit "no match data" label — never a zeroed record.

### 3.5 `/teams/<id>/<year>/` — Team / Season

The TBA-style per-season team page.

| Block | Content |
|---|---|
| Header | Flag, name, year, host, coverage notice if partial |
| Media | Primary team image; reserved slot for additional robot photos |
| Standing card | Rank (+ delta), record, ranking score, highest score, the year's custom stat |
| Playoff | Alliance, role (captain / pick N), alliance rank |
| Awards | For that year |
| Matches | The `matchList` block, viewer's team highlighted |
| Where to watch | Field VOD link for the day's stream |

### 3.6 `/matches/<year>/<stage>/<id>/` — Match

| Block | Content |
|---|---|
| Header | Match name, stage, number, scheduled time (venue local **and** viewer local), field, result |
| Score | Red vs blue, with penalties |
| Breakdown | The season's raw `details` vocabulary, rendered generically as a key/value table |
| Components | The normalized subset (per-robot positioning, coopertition), **only where the model supports it** |
| Alliances | Six participants with slot, station, card status, per-robot components where attributable |
| Video | Deep link at the recorded timestamp, labelled with its `precision` |
| Context | Other matches on the same field that day |

The breakdown renders whatever keys the season has — one template, any season, no per-year code ([discovery 01 §4](../discovery/01-data-sources.md)).

### 3.7 `/medals/` — Medal table

Sortable all-time table: team, gold, silver, bronze, honorable, total, and a per-year expansion. **Complete 2017→present**, because awards are the only uninterrupted series — this is the single most valuable all-time view in the project.

### 3.8 `/insights/` and `/insights/<year>/` — Insights

Modeled on [TBA Insights](https://www.thebluealliance.com/insights). Read-only distributions, no predictions.

| Insights view | Content |
|---|---|
| All-time | Awards by region, participation by region, seasons participated distribution, most-awarded teams |
| Season | Score distribution, rank movement, award distribution, alliance-role breakdown, most-improved |

All charts are inline SVG built from a tiny helper — no charting library. Every chart states its denominator and coverage.

### 3.9 `/calculator/<year>/` — Points calculator

A **generic shell** that renders its inputs from a per-season module:

```js
// site/calc/2025.js
export const meta = { year: 2025, name: "Eco Equilibrium",
                      formula: "…", source: "FGC25_EcoEquilibrium" };
export const inputs = [
  { id: "waterConserved", label: "Water Conserved", type: "number", min: 0 },
  { id: "balanceMultiplier", label: "Balance Multiplier", type: "select",
    options: [1, 1.25, 1.5, 2.125] },
  { id: "robot1Parking", label: "Robot 1 parking", type: "select", options: [0,0.125,0.25,0.375,0.5] },
];
export function score(v) { /* returns { total, lines: [{label, value}] } */ }
```

The shell renders inputs, calls `score()`, and displays the total with a **line-by-line breakdown** so the number is auditable. Adding a season = adding one file. **2025 and 2026 ship first**; the rest can be added later without touching the shell.

### 3.10 `/search/`

A single pre-built `search-index.json` (~30 KB: `team_id`, names, aliases, ISO codes, seasons active) filtered client-side with accent-insensitive, alias-aware matching. No service, no index server.

### 3.11 `404`

Suggests the seasons index and the team search. Must not be a dead end.

---

## 4. What every page must get right

1. **Coverage is stated.** Any page showing a partial statistic says so, inline, next to the number ([discovery 03 §5.3](../discovery/03-metrics-catalog.md)). This is the rule that keeps the site trustworthy.
2. **No blank states from missing data.** A team that did not participate says so; a season without matches says so; an unplayed match shows its estimate.
3. **The viewer's team is visually marked** wherever a list contains it.
4. **Light and dark are both correct**, checked at build time, not "later".
5. **It works without JavaScript.** The JS only ever *updates* what is already on screen.
6. **It is one request on a slow connection** plus the shared CSS. No page loads a bundle it does not render.

---

## 5. Deferred pages (not in the MVP)

| Page | Why deferred |
|---|---|
| Submit / moderate | No user interaction in the MVP (D6) |
| Team comparison / head-to-head | Needs the analytics phase |
| Ratings / event simulator | Needs uncertainty-quantified ratings ([discovery 03 §2.5](../discovery/03-metrics-catalog.md)) |
| Robot photo gallery | No submission path yet (D9) |
| API docs | The archive is the API; publish documentation only once it is stable |
