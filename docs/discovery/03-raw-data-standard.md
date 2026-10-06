# 03 — Raw data standard

The rule that keeps this maintainable: **raw data is never edited by hand, processed data is never edited by hand.** Raw is what the source gave us; processed is what the build reads. A script is always in between.

> Keys and per-file column lists are defined in **`06-join-keys.md`**. That document is the standard; this one describes the layout around it.

## Repository layout

```
data/
  raw/
    api/{year}.json              # verbatim /v1?year= response, untouched
    api/{year}.matches.json      # verbatim per-match responses with details
    manual/                      # hand-entered CSVs — the ONLY hand-written inputs
      README.md                  # operator's guide
      seasons.csv  teams.csv  videos.csv
      {year}/{matches,rankings,alliances}.csv
      breakdown.{year}.json      # game-specific field map (no tabular form)
  processed/                     # ENTRADA DEL BUILD — generada, NO versionada (.gitignore). data.js lee esto
    seasons.json                 # [{y,name,city,country,iso,dates,mode}]
    teams.json                   # {CODE: {name, continent}}
    awards.json                  # [[name,desc,ty,tier], …]  award catalogue
    {year}/matches.json  rankings.json  alliances.json  awards.json
```

`raw/api/*` is written by the fetcher and never opened by hand. `raw/manual/*` is the only thing a human edits, and it is **CSV** because that is what a spreadsheet emits. The build converts it into `processed/*.json`, which is what the templates actually read through `site/templates/data.js` — no CSV is parsed at runtime, and none is ever served.

`processed/*` is **derived and not committed** (`.gitignore`). `data/raw/` is the source of truth and is enough to rebuild it with no network. `scripts/normalize.js` wipes and rewrites the whole directory on every run, so there is nothing in it worth versioning — and editing it by hand is pointless.

Empty templates: `node scripts/make-manual-templates.js` (never overwrites an existing file).

## Formats

- **CSV** for anything tabular that gets hand-filled (2017–2023 matches, rankings). A spreadsheet is the right tool, and the build converts CSV → JSON with a script — no CSV parsing at runtime, no dependency.
- **JSON** for everything the API produced, and for the rare hand-edited file with no tabular form (the breakdown map).
- Every processed file carries a header so a stale file is detectable:

```json
{ "season": 2025, "source": "api.first.global", "generator": "scripts/normalize.js",
  "generatedAt": "2026-10-05T21:00:00Z", "schemaVersion": 1, "data": [ … ] }
```

## Identifier conventions

| Thing | Canonical id | Notes |
|---|---|---|
| Season | integer year (`2025`) | |
| Team | **ISO alpha-3, uppercase** (`MEX`) | the API's `country` field. The URL key and the join key everywhere |
| Match | `{year}_{stage}{id}` → `2025_q12` | `stage` ∈ `q` \| `rr` \| `f`, derived from the API's `tournamentKey`; `id` is the API's own numbering |
| Alliance | `alliance_number` = the API's `allianceRank` | |
| Award | kebab-case of `name` | `first-global-winning-alliance-award-gold` |

**`teamKey` is never a key** — it is reassigned every season (161 of 168 countries changed it between 2024 and 2025). Full rationale, derivations and the per-dataset field lists are in `06-join-keys.md`, which is the authoritative version of this table.

The mock UI's `/match/2025_q12/` happens to be the correct scheme, so the routes in the templates survive; the URL module (`site/templates/urls.js`, already required by the agent instructions §4) is where the derivation from `tournamentKey`+`id` gets implemented, once.

## Hand-entered datasets to define

These are the gaps the API cannot fill. Each needs a schema and, where the volume justifies it, a CSV template the owner can fill in.

The column list for every hand-entered file lives in **`06-join-keys.md`** ("Required fields per manual dataset"), with the controlled vocabularies and the validation gates. It is not repeated here — one source of truth.

Two rules apply across all of them:

- Alliance size is read from the number of filled team columns (3 in ranking, 4 in round robin and finals) — never fixed at 3.
- A blank score means the match was not played. That is a state, not a zero.

**`seasons.csv`** — `year,name,city,country,iso,dates,mode`

`mode` ∈ `archived | live | awards-only`. This single field drives rendering (2020/2021 are `awards-only`).

**`teams.csv`** — `team_code,name,continent,photo,website,instagram,twitter,facebook,contact`

Pre-filled with the API roster (`node scripts/make-manual-templates.js`), so only the last seven columns are typed. `name` is a read-only reference so a code is never mis-filled. `continent` is required for the `/teams/` grouping and exists nowhere in the API. `photo` is the **public FIRST URL, hotlinked** — not mirrored into the repo; empty means no photo, and the page renders its placeholder.

**`videos.csv`** — `match_id,video_url,start,end`

A match link is the stream URL plus a timestamp. Store `start`/`end` as `H:MM:SS` and convert to `t=` seconds at build time.

**`breakdown.{year}.json`** — the one hand-edited file with no tabular form; it maps game-specific API field names to display rows.

## Mapping raw → the site's data contract

The templates expect the shapes in `00-instrucciones-agentes.md` §4. The normalizer is the only place that knows both sides.

| Site shape | Built from | Status |
|---|---|---|
| `seasons[]` | `seasons.csv` | manual |
| `T[code] → [name, continent]` | `/v1/teams` + `teams.csv` | name auto, continent manual |
| `M[y][]` | `/v1?year=` matches + participants, or `manual/matches.csv` | auto for 2024/2025 |
| `S[y][]` | `/v1?year=` rankings, or `manual/rankings.csv` | auto for 2024/2025 |
| `AL[y][]` | `alliances_round_robin` + `alliances_finals` | auto for 2024/2025 |
| `A[y][]` | `awards[]`: `gold/silver/bronze` + `other[].class` → `ty`/`tier`/`w[]` | auto 2017–2025 |

### One contract change is unavoidable

The mock's match carries `bd[4]` = `[redWater, redParking, blueWater, blueParking]` — hardcoded to the 2024-ish game. The real `details{}` object is game-specific (`barriersInRedMitigator`, `biodiversityUnits*`, `biodiversityDistributionFactor`, …) and differs every season.

Replace `bd[4]` with:

```json
"breakdown": [ { "label": "Biodiversity units (red)", "red": 9, "blue": 3, "kind": "detail" } ]
```

driven by `data/raw/manual/breakdown.{year}.json`, which maps API field names to a row label, a side and a `kind`. Without that map there is no row to draw — this is open decision #10 in the style guide, and the raw standard resolves it in favour of an explicit per-season map rather than a fixed four-slot array.

## Validation (fail loud, at build time)

- Schema check every every `raw/manual/*.csv` and the breakdown map before use — a typo in a hand-typed team code must break the build, not render a blank cell.
- Reject any team code not present in `/v1/teams`.
- Reject a match whose teams are not all in the same season's roster.
- Reject a processed file whose `season`/`schemaVersion` header does not match the requested build.
- Missing data is absent from the input, never represented as `0` or `""`. The templates turn absence into the explicit empty states the spec requires.
