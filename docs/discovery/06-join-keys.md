# 06 — Join keys and ingestion standard

The single reference for anyone hand-entering data: **which fields identify a record**, in what format. If a manual file follows this, it joins to the API data and to every other file without transformation.

## Why this exists: `teamKey` is not stable

Measured against the live API, comparing the 168 countries present in both seasons:

| | 2024 vs 2025 |
|---|---|
| Countries compared | 168 |
| Same `teamKey` both years | **7** |
| **Different `teamKey`** | **161** |

(`ANG` 4→5, `ARG` 6→7, `ARM` 7→8, `AUS` 9→10, …)

`teamKey` is a **per-event roster id**, reassigned every season. It must never be used to join anything across seasons. It is kept only to join rows *within* one API payload.

## Canonical keys

| Entity | Key | Format | Example |
|---|---|---|---|
| **Team** | `team_code` | ISO 3166-1 **alpha-3, uppercase** | `MEX` |
| **Season** | `year` | 4-digit integer | `2025` |
| **Match** | `match_id` | `{year}_{stage}{id}` | `2025_q12` |
| **Alliance** | `alliance_number` | integer 1..N | `3` |
| **Award** | `award_slug` | kebab-case of the official name | `zhang-heng-award-for-engineering-design` |

`team_code` is the API's `country` field. It is the key in URLs, in `teams.csv`, in every manual CSV, and in every cross-file join.

### The API has two code spaces — the roster wins

Verified against the live data: `country` (alpha-3) is **not** consistent between `/v1/teams` and the match/ranking payloads, and not even between years.

| Country | matches / rankings | roster |
|---|---|---|
| Antigua and Barbuda | `ATG` in 2023–2024, **`ANT` in 2025** | `ANT` |
| Refugee team | `HPE` | `10` (the flag asset is `10_hope`) |

The alpha-2 code is the only field that always agrees (`ag`, `10`), so it is the bridge. **The roster code is canonical** — it is what the person filling `teams.csv` sees and what the site puts in URLs. `scripts/lib/codes.js` builds the alias map; everything from the competition is translated to the roster's space before it reaches a template.

Two consequences, both accepted and deliberate:

- `ANT` is a withdrawn ISO code and `10` is not an ISO code at all. They stay until the roster itself is corrected upstream — fixing it here would desynchronise the site from the file the owner fills in by hand.
- `brand.flagPath` maps `10` → the special `10_hope` asset, because there is no country flag for the refugee team.

### Match id derivation

The API's `(tournamentKey, id)` pair is unique and contiguous per tournament (verified: 362 ranking / 16 round robin / 3 finals in 2025, no gaps, no duplicates). Map it to the readable slug the UI already uses:

| API `tournamentKey` | API `name` | `stage` | Slug letter | Example |
|---|---|---|---|---|
| `t2` | Ranking Match N | `ranking` | `q` | `2025_q12` |
| `t3` | Round Robin Match N | `round_robin` | `rr` | `2025_rr3` |
| `t4` | Finals Match N | `finals` | `f` | `2025_f1` |

Manual years (2017–2023) use the same scheme; only the `id` source differs. `id` is the API's own numbering, **not** a row index.

## Never use as a key

- `teamKey` — reassigned yearly (above).
- Country **name** or `countryCode` (alpha-2) — display only. `countryCode` is fine for the flag path, nothing else.
- `rank`, scores, `sortOrder`, array position — values, not identities.
- `eventKey` — one per event/season (`FGC_2025-FGC-CMP`), not per record.

## Required fields per manual dataset

Every hand-entered file must carry these. Extra columns are allowed and ignored.

**`matches.csv`**

| Column | Key? | Format | Notes |
|---|---|---|---|
| `year` | ✅ | integer | |
| `id` | ✅ | integer, unique within `year`+`stage` | |
| `stage` | ✅ | `ranking` \| `round_robin` \| `finals` | |
| `label` | | text | official name; defaults to `{Stage} Match {id}` |
| `scheduled_time` | | ISO 8601 with offset | empty = not scheduled |
| `field` | | integer | |
| `red_1 red_2 red_3 [red_4]` | ✅ | `team_code` | 3 columns in ranking, 4 in round robin / finals |
| `blue_1 blue_2 blue_3 [blue_4]` | ✅ | `team_code` | same sizing rule |
| `red_score` `blue_score` | | integer | **empty = not played**, never `0` |
| `video_url` `video_start` `video_end` | | text / `H:MM:SS` | |

**`rankings.csv`** — `year` ✅, `team_code` ✅, `rank`, `wins`, `losses`, `ties`, `played`, `ranking_score`, `highest_score`.

**`alliances.csv`** — `year` ✅, `stage` ✅ (`round_robin` \| `finals`), `alliance_number` ✅, `captain` ✅, `pick1` ✅, `pick2` ✅, `pick3` ✅ (all `team_code`).

**`awards.csv`** (only if ever needed manually) — `year` ✅, `award_slug` ✅, `name`, `description`, `tier` ✅ (`gold` \| `silver` \| `bronze` \| `awarded`), `team_code` ✅. One row per team per award.

**`teams.csv`** — object keyed by `team_code`: `{ continent, photo, website, instagram, twitter, facebook, contact }`. `photo` is a public FIRST URL, hotlinked; a missing or empty value is a normal state and renders the UI placeholder.

**`seasons.csv`** — `year,name,city,country,iso,dates,reveal_video,mode`. `name` is the season's **game** (not the event), `iso` is the host country's alpha-3 and is what resolves its flag, and `reveal_video` must be `http(s)://` — the normalizer drops anything else rather than letting it reach an `href`.

## Awards: how the API shape maps to the site shape

An API award is `{name, description, gold, silver, bronze, other[], sortOrder}` where each slot is `{country, countryCode}` and each `other[]` entry also carries `class`. Four things are not obvious:

1. **`ty` is not in the data — it is inferred.** `a` (alliance) when the name contains "Alliance", `p` (podium) when a `gold`/`silver`/`bronze` slot exists, `n` otherwise.
2. **An alliance award puts its captain in the slot matching its own tier**, not always in `gold`: *Winning Alliance – Gold* fills `gold`, *Finalist – Silver* fills `silver`, *Finalist – Bronze* fills `bronze`. The rest of the alliance is in `other[]` with the same `class`. So the team list is `[tier slot, ...other]` — that is what makes four teams.
3. **`class` is the tier**, and it is the only place the tier appears for `other[]` entries.
4. **Some awards go to people, not teams** — the mentor award lists `recipientName` with no country. The site's model has no place for them, so they are dropped and counted in a warning at build time.

Also: the API gives country **names** and alpha-2 codes in awards, never alpha-3. Resolution goes alpha-2 → numeric code → name, and anything unresolved fails the build.

## Controlled vocabularies

| Field | Allowed values |
|---|---|
| `stage` | `ranking`, `round_robin`, `finals` |
| `tier` | `gold`, `silver`, `bronze`, `awarded` |
| award type (`ty`) | `a` alliance, `p` podium, `n` non-tiered |
| `continent` | `Africa`, `Americas`, `Asia`, `Europe`, `Oceania` |
| season `mode` | `archived`, `live`, `awards-only` |

These match the values the templates already switch on. Do not invent synonyms — the validator rejects anything else.

## Normalization rules

- `team_code` always uppercase, trimmed, ASCII (no accents, no dots).
- Team codes that are not in `/v1/teams` are rejected at build.
- **Absent means absent.** Omit the value; never write `0`, `-`, `N/A`, `""` or a blank cell as a stand-in for missing data. The templates turn absence into the explicit empty states.
- Scores are only written when the match was played.
- Dates are ISO 8601 with an offset; stored UTC, formatted for display per locale.
- CSV files are UTF-8, comma-separated, one header row, no merged cells, no formulas.
- Every file repeats `year` as a column even when the filename carries it — validated, so a misplaced row is caught.

## Validation gates (build fails, does not warn)

1. Every `team_code` exists in `/v1/teams`.
2. `(year, stage, id)` is unique across matches; `(year, stage, alliance_number)` unique across alliances.
3. Alliance size matches the stage (3 ranking / 4 round robin and finals).
4. All teams in a match belong to that season's roster.
5. Score present ⇔ both scores present.
6. Controlled vocabularies respected.
7. A processed file's `season`/`schemaVersion` header matches the build being produced.

A typo in a hand-typed code must break the build, not render a blank cell.
