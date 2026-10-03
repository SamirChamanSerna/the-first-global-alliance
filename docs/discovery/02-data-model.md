# 02 — Data Model

> This document defines the canonical model we will archive in. It exists because the upstream API is **not** internally consistent across seasons, and naive ingestion produces silently wrong statistics.

---

## 1. The central problem

The upstream API was clearly built season-by-season, and each season's data was shaped by whoever built that year's adapter. The result is that **almost every field that looks like a stable identifier is in fact per-season.**

The most dangerous case:

### `teamKey` is NOT a team identity

`teamKey` is a **per-season participant number**, reassigned from scratch every year. Verified:

| Season | What `teamKey: 1` means |
|---|---|
| 2017 | `14` / "Team Europe" |
| 2018 | `ROU` / "Team Romania" |
| 2019 | `ISR` / "Team Israel" |
| 2022 | `KAZ` / "Team Kazakhstan" |
| 2023 | `AFG` / "Team Afghanistan" |
| 2024 | `AFG` / "Team Afghanistan" |
| 2025 | `AFG` / "Afghanistan" |

A `JOIN ON teamKey` across seasons produces **silently incorrect** career statistics — it would attribute a European continental team's 2017 results to Afghanistan. This is the single highest-risk mistake in the project, because it fails without erroring.

> **Rule: the cross-season join key is the normalized `countryCode`.** Never `teamKey`. Never `name` (it changes form: "Team Afghanistan" vs "Afghanistan" vs "AFG" vs "POL" vs "Poland").

### ⚠️ Correction — 2026-10-03: `countryCode` is not stable either

The rule above was verified against the live archive and **is false for at least one code**. This section originally claimed the normalized `countryCode` was a safe cross-season join key. It is not:

| `countryCode` | 2017 | 2018 | 2019 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|---|
| `15` | **Team Asia** | — | — | — | — | **Chinese Taipei** | **Chinese Taipei** |
| `TW` | Chinese Taipei | Chinese Taipei | — | — | — | — | — |
| `10` | Refugees | Team Hope | Team Hope | Team Hope | Team Hope | — | Hope (Refugees) |

Two conclusions, both verified against the raw API responses:

1. **Code `15` denotes two different entities.** It was assigned to the continental team "Team Asia" in 2017 and reappears as Chinese Taipei in 2024–2025.
2. **One entity moved between codes.** Chinese Taipei is `TW` in 2017–2018 and `15` in 2024–2025; the all-time registry spells it `tw`.

The 2017 season assigned codes `10`–`16` to continental and refugee teams, and those numbers sit inside the space later used for other purposes. `15` is the only collision **present in the data we hold**; `11`, `12`, `13`, `14` and `16` are latent collisions that would appear without warning in a future season. There were **28 codes** whose display name is disjoint across years, but 27 of those are cosmetic (Czech Republic → Czechia, Turkey → Türkiye, "&" vs "and", official long forms). Only `15` is a genuine entity collision.

> **Corrected rule: `countryCode` is unique *within* a season, not *across* seasons.**
>
> Resolution is `resolve(year, countryCode) → team_id`: a global alias table as the default, plus a small per-season override table for the exceptions. The implementation is `pipeline/lookups/build-team-identity.mjs` and the resulting `pipeline/lookups/team-identity.json`.
>
> A validator must assert that **no season maps two different codes to the same team**, and that a contested code is never resolved without an override.

---

## 2. Canonical entities

Four entities, plus two auxiliary registries.

```
Team ──< SeasonEntry >── Season ──< Event
  │                          │
  │                          ├──< Match ──< MatchParticipant >── Team
  │                          ├──< Ranking >── Team
  │                          ├──< Alliance ──< AllianceMember >── Team
  │                          └──< Award
  └──< TeamSeasonStat (derived)
```

### 2.1 `Team` — the durable identity

One row per country/entity, **independent of season**.

| Field | Type | Notes |
|---|---|---|
| `team_id` | string | **Our own stable slug**, derived from `countryCode`. e.g. `af`, `mx`, `10_hope`. Primary key. |
| `country_code` | string | Normalized IAC code, uppercase, no spaces. The actual join key. |
| `country_code_raw` | string[] | Every raw spelling seen, for traceability. |
| `name` | string | Display name, chosen by us (e.g. "Afghanistan"). |
| `display_name` | string | Long form, e.g. "Team Afghanistan". |
| `iso3` | string? | Where derivable, for flag lookup. |
| `entity_type` | enum | `country` \| `continental` \| `refugee` \| `special`. |
| `first_season` | int | First season this team appears in. |
| `last_season` | int | Most recent appearance. |
| `seasons_active` | int[] | e.g. `[2017, 2018, 2023, 2024, 2025]`. |

### 2.2 `Season`

One row per year. Hand-maintained, since the API has no event endpoint.

| Field | Notes |
|---|---|
| `year` | 2017, 2018, 2019, 2022, 2023, 2024, 2025, 2026 |
| `host_city`, `host_country` | From `first.global/archive/fgc-<year>/` |
| `start_date`, `end_date` | ditto |
| `theme` | e.g. "Sustainable Ecosystems" |
| `game_name` | e.g. "Eco Equilibrium" |
| `ranking_stat_name` | e.g. "Protection Points" |
| `ranking_stat_key` | e.g. `protectionPoints` |
| `has_match_data` | bool — `false` for 2017–2019, 2022 |
| `data_coverage` | enum: `rankings_awards_only` \| `partial` \| `full` |
| `streams` | array of per-field VOD references |

### 2.3 `Match`

| Field | Type | Notes |
|---|---|---|
| `match_id` | string | **Composite:** `<year>:<tournamentKey>:<id>`. `id` alone is per-tournament, not global. |
| `season` | int | |
| `stage` | enum | `ranking` (t2) \| `round_robin` (t3) \| `finals` (t4) |
| `name` | string | Preserve raw; naming is inconsistent across years ("Qualification Match" vs "Ranking Match"). |
| `scheduled_time` | datetime | ISO with offset |
| `start_time` | datetime? | Usually empty upstream |
| `field` | int 1–5 | Which physical field → which stream |
| `red_score`, `blue_score` | number | |
| `red_minor_pen`, `red_major_pen`, `blue_minor_pen`, `blue_major_pen` | number | |
| `result` | enum | `red` \| `blue` \| `tie` \| `unplayed` (upstream: 1 / 2 / 0 / -1) |
| `played` | bool | |
| `details` | object | **Raw, season-specific.** Never assume keys. |
| `details_version` | string | Which season adapter applies, e.g. `fgc2025`. |

### 2.4 `MatchParticipant`

Six per match.

| Field | Notes |
|---|---|
| `match_id` | FK |
| `team_id` | FK → **our** `team_id`, not upstream `teamKey` |
| `upstream_team_key` | int — preserved for traceability only |
| `station` | 11–13 red, 21–23 blue |
| `alliance` | `red` \| `blue` (derived from station) |
| `slot` | 1–3 (derived: station − 10 or − 20) |
| `disqualified`, `card_status`, `surrogate`, `no_show` | bools/int |

`slot` is what maps a team to the per-robot detail fields (`redRobotTwoParking` ↔ red slot 2).

### 2.5 `Ranking`

| Field | Notes |
|---|---|
| `season`, `stage`, `team_id` | composite key |
| `rank`, `rank_change` | |
| `played`, `wins`, `losses`, `ties` | **May be zeroed for 2017** — check `Season.data_coverage` before trusting |
| `ranking_score` | |
| `highest_score` | **Zeroed for 2019** |
| `custom_stat_key`, `custom_stat_value` | The year-specific stat, e.g. `protectionPoints: 1.25` |

### 2.6 `Alliance` / `AllianceMember`

Playoff alliances: a captain plus three picks. `AllianceMember` records `team_id`, `role` (`captain`\|`pick1`\|`pick2`\|`pick3`), `alliance_rank`, `pick_order`.

### 2.7 `Award`

| Field | Notes |
|---|---|
| `season`, `sort_order`, `name`, `description` | |
| `recipients[]` | Each with `team_id`, `class` (`gold`/`silver`/`bronze`/`honorable mention`), `recipient_name?` |

> Award `class` is a property of the *recipient*, not the award. A single award can have one gold recipient and several `other[]` recipients also classed `gold` (see the 2025 Winning Alliance Award in [01](01-data-sources.md#36-award)).

---

## 3. Normalization rules

### 3.1 `countryCode`

Raw values drift in **case** and in **convention**:

| Seasons | Style | Example |
|---|---|---|
| 2017 | Uppercase, mixed ISO-2 and numeric | `PL`, `AM`, `14` |
| 2018–2022 | Uppercase ISO-2 | `RO`, `US`, `MX` |
| 2023–2025 | **Lowercase** ISO-2 | `af`, `al`, `dz` |

```
normalize(code) = String(code).trim().toUpperCase()
```

Yields `AF`, `RO`, `14`, `10_HOPE`. This is safe and matches the official frontend's `normalizeCode()`.

### 3.2 The continental-team registry gap

The all-time registry `GET /v1/teams` returns **207 teams**, but it is **incomplete**: it contains only `10_hope` among the non-country entities. The 2017 season introduces seven entities that **do not exist in the registry at all**:

| Code | Name (2017) |
|---|---|
| `10` | Refugees |
| `11` | Team South America |
| `12` | Team Oceania |
| `13` | Team North America |
| `14` | Team Europe |
| `15` | Team Asia |
| `16` | Team Africa |

Note that `10_hope` (registry) and `10` (season data) are the *same conceptual entity under two different codes*, and `10_hope` is a registry-specific spelling that never appears in season data.

> **Corrections, verified against the live archive:**
>
> 1. **The continental teams ran in 2017 _and 2018_, not 2017 only.** Codes `11`–`14` and `16` appear with the same names in both seasons; `15` (Team Asia) appears in 2017 alone. The claim above that "they never returned after 2017" is wrong.
> 2. **Code `15` is the dangerous one.** Because the registry does not know it, and because `15` was later reassigned to Chinese Taipei, it must be resolved per season — see the correction in §1.
> 3. **There are six continental entities, not seven**, plus one refugee team. Code `10` is the refugee team, not a continental one.

> **Consequence:** we cannot treat `/v1/teams` as authoritative. We must build our `Team` table as the **union** of the registry and every `countryCode` observed in season data, with an explicit alias map for the continental/refugee entities.

### 3.3 `eventKey`

Two coexisting formats, and they disagree **within the same season**:

| Season | `rankings`/`matches` | `awards` |
|---|---|---|
| 2017 | `2017-FGC-CMP` | `2017-FGC-CMP` |
| 2018 | `2018-FGC-CMP` | `2018_FGC-FGC-CMP` |
| 2019 | `2019-FGC-CMP` | `2019_FGC-FGC-CMP` |
| 2022 | `FGC_2022-FGC-CMP` | `FGC_2022-FGC-CMP` |
| 2023 | `FGC_2023-FGC-CMP` | `2023_FGC-FGC-CMP` |
| 2024 | `FGC_2024-FGC-CMP` | `2024_FGC-FGC-CMP` |
| 2025 | `FGC_2025-FGC-CMP` | `2025_FGC-FGC-CMP` |

> **Rule: do not join on `eventKey`.** Derive our own `season` key (the year integer) from it and use that. `eventKey` is preserved as an attribute only.

### 3.4 `tournamentKey`

Stable across the years that have match data:

| Key | Stage |
|---|---|
| `t2` | Ranking Matches (the main qualification phase) |
| `t3` | Round Robin (playoffs, stage 1) |
| `t4` | Finals (playoffs, stage 2) |

2025 distribution: `t2` ×362, `t3` ×16, `t4` ×3. No `t1`/practice matches appear in any season's `matches` array.

`round_robin` rows carry `tournamentKey: 100` and `finals` rows `t4` — these are *ranking* rows, whose `tournamentKey` does **not** always match the match-level `tournamentKey` for the same stage. Treat the top-level array as authoritative for stage.

### 3.5 `scheduledTime`

ISO-8601 **with a UTC offset** (`2025-10-30T11:15:00.200-05:00`). The offset reflects the host venue. Store as UTC plus the original offset; display in both the venue's local time and the viewer's.

---

## 4. Season adapter strategy

Because `details` is different every year, and because three naming generations exist for the same concepts, we need **one adapter module per season family**, not one universal parser.

```
adapters/
  fgc2023.ts     # 13 keys  — Proficiency generation
  fgc2024.ts     # 37 keys  — Parked + Cw/Ec generation
  fgc2025.ts     # 20 keys  — Parking + biodiversity generation
  fgc2026.ts     # 17 keys  — BraceState/Climb generation (pre-written, season starts Oct 2026)
  legacy.ts      # 2017-2019, 2022 — rankings + awards only, no match adapter
```

Each adapter's job:

1. Declare which `custom_stat_key` that season uses.
2. Map raw `details` keys → a **normalized component vocabulary** (see [03](03-metrics-catalog.md#4-component-model)).
3. Declare per-robot fields and map them to alliance slots.

### Normalized component vocabulary

To make cross-season charts possible at all, adapters should emit a small common shape wherever the season supports it:

```jsonc
{
  "score": { "red": 12, "blue": 16 },
  "penalties": { "red": {"minor":0,"major":0}, "blue": {"minor":0,"major":0} },
  "coopertition": 0,
  "per_team": {            // keyed by alliance slot 1-3
    "red":  [ {"parking": 0}, {"parking": 0.5}, {"parking": 0} ],
    "blue": [ {"parking": 0.5}, {"parking": 0.125}, {"parking": 0.5} ]
  },
  "season_specific": { /* raw keys, untouched */ }
}
```

Only `score`, `penalties`, and `per_team[*].parking` (the endgame/positioning element) generalize across 2023–2026. Everything else stays in `season_specific` and is rendered only on that season's pages.

---

## 5. Data-quality rules

Aggregation code must enforce these, or statistics will be wrong:

1. **Exclude non-participating rows.** Drop participants with `no_show = 1` or `disqualified = 1` from performance aggregates.
2. **Handle `card_status = 2`** as a disqualification (red card).
3. **Respect coverage.** Do not compute win rate for a team-season whose `Season.data_coverage` is `rankings_awards_only`.
4. **Never trust `wins`/`losses` for 2017.** Present but zeroed. Derive from matches where available; otherwise omit.
5. **Never trust `highest_score` for 2019.** Zeroed.
6. **Scores are not comparable across seasons.** Any cross-season points aggregate must be normalized per-season (see [03](03-metrics-catalog.md#6-cross-season-comparability)).
7. **Preserve raw values.** Store the raw upstream record alongside the normalized one so discrepancies can be audited and reported by users.

---

## 6. Storage shape

Given the tiny scale (§[01](01-data-sources.md#2-per-year-coverage-matrix) — ~1.5 MB total), the canonical archive is **JSON files**, not a database:

```
data/
  teams.json                    # Team registry (union, ~215 entries)
  seasons.json                  # Season metadata (hand-maintained)
  seasons/2025/
    season.json                 # meta + rankings + alliances + awards
    matches.json                # all matches, normalized
    matches-details.json        # raw details, keyed by match_id
    teams.json                  # that season's roster
  teams/
    af.json                     # per-team lifetime aggregate (see 03)
    mx.json
```

The per-team files are the key distribution optimization: a team page loads ~3 KB instead of a 620 KB season bundle. See [05-storage-and-distribution.md](05-storage-and-distribution.md).

A relational store is only needed for **live event data** and **user submissions** — both mutable. The immutable archive stays as files.

---

## 7. Open model questions

1. **Team identity across geopolitical change.** Team names/codes may change (e.g. a country renaming). Our `team_id` should be stable even if the display name changes — needs an alias table.
2. **Whether the continental teams (2017 only) should be shown as teams at all,** or folded into a separate "legacy/continental" presentation. They never returned after 2017.
3. **Whether to expose `season_specific` details in the API** we publish, or only the normalized vocabulary.
4. **How to represent the 2022 standings**, which have no matches — a "results without games" state that most UI assumes away.
