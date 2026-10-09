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

**`streams.csv`** (`manual/{year}/streams.csv`) — the official stream of each field, for each day of competition.

| Column | Key? | Format | Notes |
|---|---|---|---|
| `year` | ✅ | integer | must exist in `seasons.csv`, and match the folder |
| `field` | ✅ | integer 1–5 | the field **number**, the same one `matches.csv` uses |
| `day` | ✅ | integer ≥ 1 | competition day; day 1 is the earliest date in that season's API snapshot |
| `youtube_url` | | `http(s)://` YouTube URL with an id | the id is what the GameDay embeds, so a URL without one fails the build |

`(year, day, field)` is the key: a repeated pair fails the build. There is no `date` column on purpose — the day is derived from the schedule, so a fixed date can never drift out of sync with the matches. The GameDay shows the highest `day` present, so rolling it over is just adding the next day's five rows.

**`{year}.json`** (`manual/{year}/{year}.json`) — the video extractor's output, not hand-written. Joined to matches by `match_number` inside the `RANK` (qualification) block, which is the `N` of the site's `{year}_qN` match id — the country codes in that file are the extractor's alpha-3 spelling (`VUT`, `BWA`), which is **not** the roster's, so teams are never the join key here. Each entry's `video.url` becomes the match's `video`; entries without a readable stage or teams (`stage: "UNKNOWN"`) are skipped and counted.

**`rankings.csv`** — the final ranking of **every** season, including 2024-2025 (the API does not return all the tie-breaker criteria, and they differ year to year, so the CSV always wins).
| Column | Key? | Format | Notes |
|---|---|---|---|
| `year` | ✅ | integer | must exist in `seasons.csv` |
| `team_code` | ✅ | `team_code` | must exist in the roster (ISO alpha-3 is accepted — see below) |
| `rank` | | integer | 1..N, contiguous, one row per team |
| *criteria* | | number | **every column after `rank`** is a tie-breaker of that season, in its own order — `Cumulative_Points`, `Ranking_Score`, `Protection_Points`… The set differs every year; there is no fixed list |

Two things are not obvious:

- **`Wins`/`Losses`/`Ties` are not criteria.** If the file carries them, they fill the fixed W-L-T column rather than being printed as data columns. Only 2019 has them in its CSV; for 2024-2025 they are derived from the qualification matches.
- **Every criteria column needs a readable label** in `data/raw/manual/rankings.labels.json` (header → label, e.g. `Total_Hydrogen_Oxygen_Points` → `Total hydrogen/oxygen points`). A missing label fails the build rather than printing a raw header.

**Codes:** the roster's alpha-3 and the standard ISO alpha-3 disagree for ~88 countries (`ZAM`/`ZMB`, `GER`/`DEU`, `SUI`/`CHE`, `KSA`/`SAU`, `TPE`/`TWN`…). Either spelling is accepted in a manual CSV: the normalizer bridges alpha-3 → alpha-2 → roster through `data/raw/api/iso-regions.json`, which is the same alpha-2 bridge described above. Two cases the bridge cannot decide on its own and that must be spelled the canonical way:

- the continental teams of 2017-2018, which the competition codes `11`–`16` (see `teams.csv`);
- the refugee team, whose canonical code is `10` (`HOPE` also resolves to it).

**`alliances.csv`** — `year` ✅, `stage` ✅ (`round_robin` \| `finals`), `alliance_number` ✅, `captain` ✅, `pick1` ✅, `pick2` ✅, `pick3` ✅ (all `team_code`).

**`awards.csv`** (only if ever needed manually) — `year` ✅, `award_slug` ✅, `name`, `description`, `tier` ✅ (`gold` \| `silver` \| `bronze` \| `awarded`), `team_code` ✅. One row per team per award.

**`teams.csv`** — object keyed by `team_code`: `{ continent, website, instagram, twitter, facebook, contact }`. `continent` is required for the `/teams/` grouping and exists nowhere in the API.

**`photos.csv`** — the team photo **per season** (members change every year, so there is no team-level photo).

| Column | Key? | Format | Notes |
|---|---|---|---|
| `year` | ✅ | integer | must exist in `seasons.csv` |
| `team_code` | ✅ | `team_code` | must exist in the roster |
| `photo_url` | | public `http(s)://` URL | hotlinked, never mirrored; only `http(s)` is accepted |

One row per `(year, team_code)`; a duplicate pair fails the build. An empty or non-`http(s)` URL fails the build rather than being skipped — unlike `reveal_video`, a row here is an explicit statement that this URL is the photo, so dropping it silently would leave a mute hole. A missing row is the normal "no photo" state and renders the UI placeholder.

**`seasons.csv`** — `year,name,city,country,iso,dates,reveal_video,mode,teams`. `name` is the season's **game** (not the event), `iso` is the host country's alpha-3 and is what resolves its flag, and `reveal_video` must be `http(s)://` — the normalizer drops anything else rather than letting it reach an `href`. `teams` is the number of participating teams and stays **empty** in the normal case: it is derived from the ranked teams. Fill it only for a season where that cannot be derived because there were no rankings or matches — today just 2020 (175) and 2021 (177), which were held virtually.

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
