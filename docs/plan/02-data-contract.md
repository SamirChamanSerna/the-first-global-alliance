# 02 — Data Contract

> The rules that make "load the page and it fetches what it needs" work without ever downloading 620 KB to render 2 KB.

---

## 1. The rule

> **One page = one data file.**
>
> A page fetches exactly one JSON document, and that document contains *everything the page renders*. If a page needs two, the second is an explicitly-declared overlay (only the video overlay qualifies today).

This is the whole optimisation. The naive design serves the 620 KB season bundle to every page; the correct design serves the 3 KB the page actually displays. It also means a template never has to join or filter across datasets — the data arrives in the shape the template renders.

Corollary: **do not over-fragment either.** If a page would need six files, the split is wrong. Aim for one.

---

## 2. Layout

Two trees, deliberately separate: what **is published** (`data/`, under a version segment) and what **feeds the build** (`pipeline/overlays/`, never published).

```
data/                                  # PUBLISHED. immutable. served at /data/v<N>/
├─ manifest.json                       # index + data_version + generated_at  (unversioned path)
├─ v<N>/                               # N = data_version. every URL carries it.
│   ├─ teams.json                      # the team registry (all entities, all eras)
│   ├─ seasons.json                    # season metadata (2017–2026)
│   │
│   ├─ seasons/
│   │   └─ <year>/
│   │       ├─ index.json              # ← the Season page
│   │       ├─ matches.json            # ← the season match list
│   │       └─ standings.json          # ← the standings table (when shown alone)
│   │
│   ├─ teams/
│   │   └─ <team_id>/
│   │       ├─ index.json              # ← the Team History page
│   │       └─ <year>.json             # ← the Team/Season page
│   │
│   ├─ matches/
│   │   └─ <year>/
│   │       └─ <stage>/
│   │           └─ <id>.json           # ← the Match page
│   │
│   ├─ insights/
│   │   ├─ index.json                  # ← Insights (all-time)
│   │   └─ <year>.json                 # ← Insights (season)
│   │
│   ├─ medals.json                     # ← the Medal table page
│   │
│   ├─ media/
│   │   └─ <year>/
│   │       └─ <team_id>.webp          # team primary image
│   │
│   └─ live/
│       └─ <year>.json                 # live origin only. never in the archive.
│
pipeline/overlays/                     # BUILD INPUTS. never published. see §6
└─ videos/
    └─ <year>.json                     # hand-edited. mutable. merged into match rows.
```

`<stage>` ∈ `ranking` | `round_robin` | `finals` (never the raw `t2`/`t3`/`t4`).

**Why the version segment.** Immutable caching is only truthful if the URL changes when the bytes change. Without `v<N>`, a corrected file is unreachable behind a year-long cache ([01 §5](01-architecture.md)). With it, a correction is "bump `N`, rebuild, deploy" and no cache anywhere needs invalidating. The version is written into every URL at build time, and every URL is already precomputed — so this costs one integer.

**Why the overlay is not in `data/`.** Everything published under `/data/v<N>/` is immutable, which means *nothing mutable may live there*. The video overlay is not a runtime artifact at all: the build merges it into the compact match rows and the browser never requests it. Keeping it as a build input removes the only path that would otherwise have needed a short cache inside an immutable tree.

### 2.1 Size check

| Artifact | Count | Size each | Total |
|---|---|---|---|
| `teams/<id>/<year>.json` | ~190 × 3 | ~4 KB | ~2.3 MB |
| `teams/<id>/index.json` | ~215 | ~3 KB | ~650 KB |
| `seasons/<year>/matches.json` | 4 | ~90 KB | ~360 KB |
| `matches/.../<id>.json` | ~1,100 | ~2 KB | ~2.2 MB |
| Everything else | ~30 | small | ~200 KB |
| **Total data** | ~1,700 | | **≈ 6 MB** |

Well inside Cloudflare Pages' 20,000-file and 25 MB-per-file limits. **But note:** data files are *not* counted against the Pages asset limit the way one might assume — verify the file count early (issue F1.6) and, if it becomes a problem, collapse `matches/**` into `seasons/<year>/matches.json` and serve the match page from the season list. That is a one-line change in the build.

---

## 3. Artifact shapes

All shapes are **versioned by `data_version`** in `manifest.json`. Fields marked ⓗ are hooks for deferred work — present and populated from day one so later phases never migrate the archive.

### 3.1 `manifest.json`

```jsonc
{
  "data_version": 3,
  "generated_at": "2026-10-11T09:14:22Z",
  "seasons": [2017, 2018, 2019, 2022, 2023, 2024, 2025, 2026],
  "active_season": 2026,
  "match_seasons": [2023, 2024, 2025, 2026],
  "team_count": 215,
  "counts": { "matches": 1100, "awards": 170, "teams_by_season": { "2025": 191 } }
}
```

### 3.2 `teams.json` and the identity registry

Source of truth is the hand-curated `pipeline/lookups/team-identity.json`; `data/teams.json` is its published form.

```jsonc
{
  "team_id": "af",                 // ours. stable forever. never derived at build time.
  "name": "Afghanistan",
  "display_name": "Team Afghanistan",
  "entity_type": "country",        // country | refugee | continental | special
  "iso2": "af", "iso3": "AFG",
  "aliases": {                     // every spelling ever seen upstream
    "country_code": ["AF", "af"],
    "name": ["Team Afghanistan", "Afghanistan", "AFG"]
  },
  "first_season": 2017,
  "seasons_active": [2017, 2018, 2019, 2022, 2023, 2024, 2025],
  "notes": ""
}
```

**Requirements:**

1. **Every entity that could ever appear must be representable**, including ones with no data (issue F1.2 seeds this from the flag set + IOC/ISO lists).
2. **`team_id` is never derived from upstream.** `teamKey` is a per-season participant number ([discovery 02 §1](../discovery/02-data-model.md)) and is stored only as `upstream_team_key` for traceability.
3. **A team with no data for a year is a first-class state**, not an error. The page renders "did not participate" — it does not 404.

### 3.3 `seasons.json` (hand-maintained, ~10 rows)

```jsonc
{
  "year": 2025, "host_city": "Panama City", "host_country": "Panama",
  "start_date": "2025-10-29", "end_date": "2025-11-01",
  "theme": "Sustainable Ecosystems", "game_name": "Eco Equilibrium",
  "ranking_stat_name": "Protection Points", "ranking_stat_key": "protectionPoints",
  "data_coverage": "full",          // full | standings_only | awards_only | none
  "match_source": "api",            // ⓗ api | video | mixed
  "synopsis": "…2–3 sentence summary of the challenge…",
  "score_formula": "…human-readable formula, rendered on the season page…",
  "streams": { "days": [ { "day": 1, "date": "2025-10-29",
                           "fields": { "1": {"url": "…", "kind": "youtube"},
                                       "main": {"url": "…", "kind": "youtube"} } } ] }
}
```

`data_coverage` is what the UI reads to decide which sections exist. It is set once per season by the owner and is the reason the same template can serve 2019 (awards only) and 2025 (everything) without branching on the year.

### 3.4 `teams/<id>/<year>.json` — the Team/Season page

The richest artifact. It carries that team's slice of the season so the page needs nothing else.

```jsonc
{
  "team_id": "af", "year": 2025,
  "team":       { /* teams.json entry */ },
  "media":      { "primary": "/data/media/2025/af.webp", "alt": "Team Afghanistan robot, 2025" },
  "standing":   { "rank": 164, "played": 12, "wins": 5, "losses": 7, "ties": 0,
                  "ranking_score": 39.18, "highest_score": 79,
                  "custom_stat": { "key": "protectionPoints", "value": 1.25 } },
  "alliance":   { "stage": "round_robin", "name": "Alliance 2", "role": "pick1", "rank": 1 },
  "awards":     [ { "name": "…", "class": "gold", "sort_order": 1 } ],
  "record":     { "w": 5, "l": 7, "t": 0, "win_rate": 0.4167,
                  "by_stage": { "ranking": {"w":5,"l":7,"t":0} } },
  "matches":    [ /* the compact match rows below — only this team's ~20 */ ],
  "coverage":   "full"                    // copied from seasons.json, for notices
}
```

The **compact match row** is the shape repeated everywhere a match list is rendered — team page, season page, insights:

```jsonc
{
  "match_id": "2025:t2:214",
  "href": "/matches/2025/ranking/214/",     // ready to use. template does not build URLs
  "stage": "ranking", "name": "Ranking Match 214",
  "scheduled_time": { "utc": "2025-10-30T16:15:00.200Z", "offset": "-05:00",
                      "local": "2025-10-30T11:15:00.200-05:00" },
  "field": 3,
  "red_score": 88, "blue_score": 74,
  "result": "red",                          // red | blue | tie | unplayed
  "played": true,
  "alliances": { "red":  ["af","mx","br"], "blue": ["pe","cl","ar"] },
  "is_team_red": true,                      // precomputed highlight flag
  "video": { "url": "https://youtu.be/…?t=4213", "t": 4213, "precision": "exact" },
  "breakdown": {                            // ⓗ null until derived metrics exist
    "available": false,
    "components": null
  }
}
```

> **Precomputing `href`, `is_team_red` and `video.url` is deliberate.** It removes URL construction, alliance lookup and video-link assembly from the templates entirely — the same work done once at build instead of on every visit. It is also what lets the whole page be rendered from a single file.

### 3.5 `teams/<id>/index.json` — the Team History page

```jsonc
{
  "team_id": "af",
  "team": { /* teams.json entry */ },
  "career": {
    "seasons": 6, "matches": 72, "w": 30, "l": 40, "t": 2, "win_rate": 0.4286,
    "medals": { "gold": 2, "silver": 1, "bronze": 0, "honorable": 4 },
    "best_rank": { "year": 2023, "rank": 41 },
    "coverage_span": [2023, 2025]          // the denominator. must be rendered.
  },
  "timeline": [                            // newest first. This is the default view.
    { "year": 2025, "host": "Panama City", "rank": 164,
      "record": {"w":5,"l":7,"t":0}, "win_rate": 0.4167, "highest_score": 79,
      "awards": [ { "name": "…", "class": "gold" } ],
      "media": "/data/media/2025/af.webp",
      "href": "/teams/af/2025/",
      "coverage": "full",
      "summary": null                       // ⓗ reserved for an LLM-generated synopsis
    },
    { "year": 2019, "rank": 88, "record": null, "awards": [ … ], "coverage": "awards_only" }
  ],
  "awards": [ { "year": 2025, "name": "…", "class": "gold" } ]
}
```

`coverage` per row is what makes a timeline honest: a season with no match data renders its rank and awards and simply has no record column, rather than showing zeros.

### 3.6 `seasons/<year>/index.json` — the Season page

```jsonc
{
  "year": 2025,
  "meta":   { /* the seasons.json row, including synopsis + score_formula + streams */ },
  "coverage": "full",
  "standings_top": [ /* top 10 compact standing rows */ ],
  "awards": [ { "name": "…", "description": "…", "sort_order": 1,
                "recipients": [ { "team_id": "pa", "class": "gold" } ] } ],
  "counts": { "teams": 191, "matches": 381, "award_count": 19 },
  "calculator_href": "/calculator/2025/",
  "links": { "matches": "/seasons/2025/matches/" }
}
```

For a season with `data_coverage: "awards_only"`, `standings_top` is `[]` and the template omits the section — driven by `coverage`, not by the year.

### 3.7 `seasons/<year>/matches.json`

```jsonc
{ "year": 2025, "stages": [ { "stage": "ranking", "name": "Ranking Matches",
                              "matches": [ /* compact rows */ ] } ] }
```

`~90 KB` for the full season, which is acceptable for the one page that genuinely needs all of them.

### 3.8 `matches/<year>/<stage>/<id>.json` — the Match page

```jsonc
{
  "match_id": "2025:t2:214", "year": 2025, "stage": "ranking",
  "name": "Ranking Match 214",
  "scheduled_time": { /* … */ },
  "field": 3, "played": true, "result": "red",
  "score": { "red": 88, "blue": 74 },
  "penalties": { "red": {"minor":0,"major":0}, "blue": {"minor":0,"major":0} },
  "alliances": {
    "red":  [ { "team_id":"af", "slot":1, "name":"Afghanistan", "flag":"af",
                "station":11, "disqualified":false, "no_show":false,
                "components": { "parking": 0.25 } } ],
    "blue": [ /* … */ ]
  },
  "component_model": "fgc2025",             // which adapter produced `components`
  "breakdown": {                            // the raw, season-specific scoring values
    "available": true,
    "raw": { "barriersInRedMitigator": 2, "coopertition": 10, "…": 0 }
  },
  "derived": null,                          // ⓗ ratings contributions, later
  "video": { "url": "https://youtu.be/…?t=4213", "t": 4213, "precision": "exact" }
}
```

The raw `details` vocabulary is season-specific ([discovery 01 §4](../discovery/01-data-sources.md)) and is rendered **only** on that season's match pages, never charted across years. `components` is the normalized subset that does generalize (per-robot positioning + coopertition).

### 3.9 `medals.json` and `insights/*.json`

```jsonc
// medals.json — complete 2017–2026, because awards are the only uninterrupted series
{ "generated_for": [2017, …, 2026],
  "rows": [ { "team_id":"us", "gold":4, "silver":2, "bronze":1, "honorable":7, "total":14,
              "by_year": { "2019": {"gold":1}, "2024": {"silver":1} } } ] }
```

`insights/<year>.json` holds the aggregate distributions the Insights pages plot (score distribution, rank movement, award counts by region, per-season comparison). Shape is defined when that page is built (issue F3.3) — it is the one artifact deliberately left unspecified until the visualisation exists.

---

## 4. Normalization rules the emit step must enforce

These come from [discovery 02 §3](../discovery/02-data-model.md) and [12](../discovery/12-normalization-layer.md) and are non-negotiable:

1. `countryCode` → `trim().toUpperCase()` → **`resolve(year, code) → team_id`**, i.e. the per-season override table first, then the global alias table. **Never join on `teamKey`**, and **never join on `countryCode` alone** — it is unique within a season, not across seasons. Code `15` is Team Asia in 2017 and Chinese Taipei in 2024–2025 ([discovery 02 §1](../discovery/02-data-model.md#-correction--2026-10-03-countrycode-is-not-stable-either)).
2. `eventKey` → derive the year integer. **Never join on `eventKey`**; it has two coexisting formats that disagree within the same season.
3. `match_id` = `<year>:<tournamentKey>:<id>`. `id` alone is per-tournament, not global.
4. `field | fieldNumber` → `field`. The `/v1` and `/v1/matches` payloads disagree; normalize on ingest.
5. `played` (bool) and `result` (enum) are both derived from upstream's `-1|0|1|2` and stored together.
6. Scores are rounded to 6 decimals; times stored as `{ utc, offset, local }`. Never a bare local timestamp.
7. Absent data is `null`, never `0`, never omitted. **Null is meaningful** — it means "no data", and the UI must say so.
8. Exclude `no_show = 1` and `disqualified = 1` participants from aggregates; treat `card_status = 2` as a disqualification.
9. Every record carries provenance: `source` (`api` | `video` | `user`), `rule_version`, `schema_version`. Populated even though the MVP is API-only.
10. Emit deterministically: sorted keys, explicit array ordering, fixed float precision, UTF-8, LF. The same input must produce byte-identical output — a rebuild with no upstream change must produce an empty diff.

---

## 5. Media

```
data/media/<year>/<team_id>.webp
```

- **Primary team image**, sourced once from the official `first.global/<year>-nations/<slug>-<year>/` page ([discovery 01 §5.1](../discovery/01-data-sources.md)).
- Downloaded, capped at 1600 px, converted to WebP, committed. **Not hotlinked.**
- Referenced only if it exists; a missing image is `null` and the template renders the flag alone.
- Additional robot photos are **out of scope** (D9, and [discovery 07 §1](../discovery/07-user-content-and-moderation.md)); the field is reserved so they can be added without a format change.

---

## 6. Video links — the overlay

Kept out of the frozen archive on purpose (D8). The build **merges** it into the compact match rows; the page never reads it directly.

```jsonc
// pipeline/overlays/videos/<year>.json  — BUILD INPUT. hand-edited, mutable,
// never published as an artifact, never fetched by a browser.
{
  "2025": {
    "t2:214": { "t": 4213, "precision": "exact", "by": "owner" },
    "t2:215": { "t": null, "precision": "vod",   "by": "owner" }
  }
}
```

### Resolution algorithm (runs at build time)

```
url(match):
  day   = dayIndexOf(match.scheduled_time)          # 1..N, from seasons.json streams.days
  field = match.field
  stream = streams[day].fields[field] ?? streams[day].fields["main"]
  if stream is null                    → no link, render nothing
  entry = videos[year][stage:id]
  if entry?.t != null                  → stream.url + "?t=" + entry.t   precision=exact
  else                                 → stream.url                      precision=vod
```

This covers the two required behaviours exactly: **no timestamp → the correct VOD; timestamp → that minute:second.** The link is precomputed into every compact match row, so the icon is just an `<a href>`. Timestamps are added by the owner directly in the JSON with no rebuild of the archive and no pipeline run.

> The merged `video` object always carries `precision`, so the UI can label an approximate link honestly ([discovery 07 §5.4](../discovery/07-user-content-and-moderation.md)) rather than implying a precision it does not have.

---

## 7. The live overlay

The only artifact that exists solely in the live origin.

```jsonc
// live/<year>.json  — target < 40 KB
{
  "generated_at": "2026-10-08T14:32:11Z",
  "source_ok": true, "stale": false,
  "seed": 7,
  "season": 2026, "stage": "ranking",
  "team_states": { "kz": { "rank": 1, "w": 9, "l": 3, "rs": 412.5 } },
  "matches": { "t2:214": { /* the same compact match row */ } },
  "streams": { "main": "…", "field1": "…" }
}
```

Hydration **patches by ID**, not by replacing the page: the client re-renders the containers whose IDs appear in `matches`/`team_states`. `seed` is a monotonically increasing integer the client uses to skip re-renders when nothing changed — cheaper and simpler than hashing on the client.

The overlay uses the **same compact match row** as every other artifact. One shape, one template, three renderers (build archive, live server, live client).

---

## 8. Determinism, provenance and the quality report

1. **`raw/` is immutable; `normalized/` and `derived/` are fully rebuildable.** A rebuild must be reproducible bit-for-bit.
2. **Upstream defects are reported, never silently corrected.** The pipeline emits a quality report ([discovery 12 §5](../discovery/12-normalization-layer.md)) and a human reads it before anything is published.
3. **Nothing publishes on an unknown shape.** Fail closed, keep the last good artifact, alert.
4. **Coverage is data, not code.** The UI branches on `data_coverage`, never on `year === 2025`.

---

## 9. Open questions

1. **File count on Pages.** ~1,700 data files plus ~1,700 pages — verify against the plan's limits before committing to per-match files (issue F1.6). The fallback is folding `matches/**` into the season list.
2. ~~**`data_version` granularity.**~~ **Resolved: global.** With the version in the path ([§2](#2-layout)), bumping `N` does not *invalidate* anything — it retires old URLs, and cached copies of them are simply never requested again. Per-season versions would buy nothing and complicate the layout. The re-download cost of a global bump is also near zero, because archive pages inline their data and `/data/**` has no page-view consumer.
3. **Team image licensing.** We are republishing photographs published by FIRST Global. Needs a stated attribution and a takedown path ([discovery 09 §9](../discovery/09-annual-runbook-and-risks.md)).
4. **`insights/<year>.json` shape** is intentionally undefined until the page is designed.
