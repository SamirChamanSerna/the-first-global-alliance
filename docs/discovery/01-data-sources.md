# 01 — Data Sources Inventory

> All endpoints in this document were **executed and verified live on 2026-10-02** from a development machine, with no authentication, unless explicitly marked otherwise.

---

## 1. `api.first.global` — the results API

The authoritative machine-readable source. It is the exact API that `results.first.global` calls.

**Server:** `nginx/1.18.0` fronting a Node/Fastify service (`{"message":"Route GET:/x not found",...}` 404 shape).
**Authentication:** none.
**CORS:** `access-control-allow-origin: *` — browsers can call it directly.
**Caching:** `Cache-Control: no-cache, no-store, max-age=0, must-revalidate`. No `ETag`, no `Last-Modified` → **conditional requests are impossible**; every call is a full re-fetch.
**Rate limiting:** no rate-limit headers observed. No published limit. No `robots.txt` policy.
**Documentation:** none published.

### 1.1 Confirmed endpoints

| Endpoint | Status | Returns |
|---|---|---|
| `GET /v1?year=YYYY&excludeMatchDetails=true` | 200 | Full season bundle (7 arrays) without scoring breakdowns |
| `GET /v1?year=YYYY` | 200 | Same, **with** `matches[].details` inline |
| `GET /v1` | 200 | All arrays empty (118 bytes) |
| `GET /v1/matches?year=YYYY&tournamentKey=tN&id=N` | 200 | Array with one match, **richer shape** (adds `startTime`, `fieldNumber`, `result`, `details`) |
| `GET /v1/teams` | 200 | All-time team registry — **207 entries** |
| `GET /v1/teams?year=YYYY` | 200 | That season's roster — 183 entries for 2025; adds `cardStatus`, `hasCard`, `shortName`; `name` loses the `"Team "` prefix |
| `GET /v1/rankings?year=YYYY` | 200 | Rankings across **all** tournament levels (2025: 226 rows = 181 + 33 + 12) |
| `GET /v1/awards?year=YYYY` | 200 | Awards for the season (2025: 19) |
| `GET /v1/alliances?year=YYYY&tournamentKey=tN` | 200 | Alliances for a stage (`tournamentKey` required, else 400) |

### 1.2 Confirmed non-existent endpoints (404)

```
/v1/stats   /v1/opr   /v1/events   /v1/schedule   /v1/seasons
```

There is **no stats/analytics endpoint**, **no event-metadata endpoint**, and **no schedule endpoint**. Anything derived (OPR, EPA, schedules, event dates) must be computed or sourced elsewhere.

Years outside the supported range return `400 {"error":"Invalid year"}`. Supported years return `200` even when empty.

---

## 2. Per-year coverage matrix

Verified by iterating every year and recording array lengths from `/v1?year=YYYY&excludeMatchDetails=true`.

| Year | `matches` | `rankings` | `round_robin` | `finals` | `alliances_rr` | `alliances_finals` | `awards` | Payload |
|---|---|---|---|---|---|---|---|---|
| 2017 | **0** | 163 | 0 | 0 | 0 | 0 | 10 | 53 KB |
| 2018 | **0** | 161 | 0 | 0 | 0 | 0 | 21 | 64 KB |
| 2019 | **0** | 189 | 0 | 0 | 0 | 0 | 18 | 66 KB |
| 2020 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| 2021 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| 2022 | **0** | 162 | 32 | 12 | 8 | 3 | 19 | 97 KB |
| 2023 | 338 | 191 | 32 | 12 | 8 | 3 | 21 | 556 KB |
| 2024 | 379 | 181 | 32 | 12 | 8 | 3 | 23 | 628 KB |
| 2025 | 381 | 181 | 33 | 12 | 8 | 3 | 19 | 624 KB |
| 2026 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — *(event 7–10 Oct 2026)* |

**Total archive weight 2017–2025: ≈ 1.5 MB.**

### Interpretation

- **2017–2019 (three seasons):** rankings and awards only. No match-level data exists at all.
  - **2017:** `wins`/`losses`/`ties` present but **zeroed** — do not trust them. `highestScore` **is** populated (163 teams, range 56–155); `rankingScore` is cumulative points (237–716).
  - **2018:** `wins`/`losses`/`ties` present but **zeroed**. `highestScore` **zeroed**. `rankingScore` (0–16) is consistent with **2 × wins** — a soft oracle (see [10 §4.3](10-historical-reconstruction.md#43-2018--soft-oracle)).
  - **2019:** `wins`/`losses`/`ties` are **complete and internally consistent** (849 W = 849 L, 6 T) — the only season in this group with trustworthy win/loss data. `highestScore` is zeroed. `rankingScore` follows `2·W + T` exactly.
- **2022:** has round-robin and finals *rankings* plus alliances, but **no `matches` array**. So there are standings without games.
- **2020 / 2021:** no competition (COVID-era virtual programs). The API returns an empty-but-valid bundle, not an error.
- **2023–2025:** complete data — matches with scoring breakdowns, rankings, alliances, awards.
- **2016:** not supported at all (the platform predates it).

- **2022:** no `matches` array, and its `wins`/`losses` are **arithmetically impossible** (sum 835 W vs 1109 L; `W+L+T != played` in 135 of 162 rows). `highestScore` **is** populated (162 teams, range 137–549).

> **Design consequence:** any "lifetime" statistic whose denominator is *matches played* must exclude 2017–2019 and 2022, and any statistic including them must be labelled as a partial-coverage aggregate. **Win/loss specifically:** trustworthy only for **2019** (from rankings) and **2023–2025** (from matches); zeroed for 2017/2018 and corrupt for 2022. See [10](10-historical-reconstruction.md) for the recovery plan.

---

## 3. Payload shapes

### 3.1 Season bundle

```jsonc
{
  "matches":   [ /* Match */ ],
  "rankings":  [ /* Ranking */ ],
  "round_robin": [ /* Ranking (stage t3) */ ],
  "finals":    [ /* Ranking (stage t4) */ ],
  "alliances_round_robin": [ /* Alliance */ ],
  "alliances_finals":      [ /* Alliance */ ],
  "awards":    [ /* Award */ ]
}
```

Note `rankings`, `round_robin`, and `finals` are the **same shape** — they are the standings at each stage (`/v1/rankings?year=` returns all three concatenated).

### 3.2 Match

```jsonc
{
  "eventKey": "FGC_2025-FGC-CMP",
  "tournamentKey": "t2",
  "id": 1,
  "name": "Ranking Match 1",
  "scheduledTime": "2025-10-30T11:15:00.200-05:00",
  "cycleTime": 0,
  "redScore": 12,  "redMinPen": 0,  "redMajPen": 0,
  "blueScore": 16, "blueMinPen": 0, "blueMajPen": 0,
  "played": true,
  "field": 1,
  "participants": [ /* Participant */ ]
}
```

The `/v1/matches` variant adds `startTime` (string, often `""`), `fieldNumber`, `result`, and `details` — and omits `played`/`field`.

> **Shape hazard:** `/v1` and `/v1/matches` return *different* match objects. Normalize on ingest. `field` (1–5) and `fieldNumber` are the same concept.

`result` enum (from the official frontend's `base/Match.ts`): `-1` not played · `0` tie · `1` red win · `2` blue win.

### 3.3 Participant

```jsonc
{ "eventKey":"FGC_2025-FGC-CMP", "tournamentKey":"t2", "id":1,
  "station":11, "teamKey":70, "disqualified":0, "cardStatus":0,
  "surrogate":0, "noShow":0, "country":"GRN", "countryCode":"gd" }
```

Six participants per match. **Station decides the alliance:**

| Station | Meaning |
|---|---|
| `11`, `12`, `13` | Red alliance, robots 1–3 |
| `21`, `22`, `23` | Blue alliance, robots 1–3 |

This mapping is what makes per-team attribution of `details` possible (e.g. `redRobotTwoParking` ↔ the team at station `12`).

> ⚠️ Per the official frontend, stations `14`/`24` mean "did not play" for non-primary tournaments, and `cardStatus === 2` is a red card / disqualification. Rows where `noShow === 1` should be excluded from performance aggregates.

### 3.4 Ranking

```jsonc
{ "eventKey":"FGC_2025-FGC-CMP", "tournamentKey":"t2", "teamKey":1,
  "rank":164, "rankChange":-1, "played":12, "wins":5, "losses":7, "ties":0,
  "rankingScore":39.18, "highestScore":79, "protectionPoints":1.25,
  "team": { "teamKey":1, "cardStatus":0, "hasCard":0,
            "country":"AFG", "countryCode":"af", "name":"Afghanistan", "shortName":"" } }
```

The season-specific stat (`protectionPoints` in 2025) is a **sibling of `rankingScore`**, not nested. Its name changes every year — see the per-season table in [README §5](README.md#5-per-season-reference).

### 3.5 Alliance

```jsonc
{ "captain": { "teamKey":175, "allianceRank":3, "allianceNameShort":"#2",
               "allianceNameLong":"Alliance 2", "isCaptain":1, "pickOrder":1, "team":{...} },
  "pick1": {...}, "pick2": {...}, "pick3": {...},
  "name":"Alliance 2", "rankingScore":310, "played":2,
  "eventKey":"FGC_2025-FGC-CMP", "rank":1 }
```

Four teams per playoff alliance (captain + 3 picks).

### 3.6 Award

```jsonc
{ "name":"FIRST Global Winning Alliance Award - Gold",
  "description":"Awarded to the four teams in the winning alliance in the final match.",
  "gold":   { "country":"Panama", "countryCode":"pa" },
  "silver": null,
  "bronze": null,
  "other":  [ { "country":"Venezuela", "countryCode":"ve", "class":"gold" },
              { "country":"Mexico",    "countryCode":"mx", "class":"gold" } ],
  "eventKey":"2025_FGC-FGC-CMP",
  "sortOrder":1 }
```

`class` ∈ `"gold" | "silver" | "bronze" | "honorable mention" | null`.

> **Join hazard:** award `eventKey` (`2025_FGC-FGC-CMP`) differs from match `eventKey` (`FGC_2025-FGC-CMP`) **within the same season**. Do not use `eventKey` as a cross-entity join key.

---

## 4. Per-season scoring breakdown (`details`)

**This vocabulary is completely different every season** — verified:

| Year | Detail keys | Notes |
|---|---|---|
| 2023 | 13 | `redHydrogenPoints`, `redOxygenPoints`, `redAlignment`, `redOneProficiency`/`Two`/`Three`, `coopertitionBonus` |
| 2024 | 37 | `redResevoirConserved` *(sic)*, `redFoodProduced`, `redRobotOneParked`/…, `redCw1`–`redCw6`, `redEc1`–`redEc6`, `fieldBalanced`, `foodSecured` |
| 2025 | 20 | `barriersInRedMitigator`, `biodiversityUnits*Ecosystem`, `biodiversityDistributionFactor`, `redRobotOneParking`/…, `coopertition`, `redProtectionMultiplier`, `allBarriersCleared` |

Three naming generations of the same concept: `redOneProficiency` (2023) → `redRobotOneParked` (2024) → `redRobotOneParking` (2025). **A per-robot value exists in all three**, which is what enables per-team component metrics.

**2025 scoring formula** (from the official `FGC25_EcoEquilibrium.ts`):

```
final = ((WaterConserved + EnergyConserved + FoodProduced) * BalanceMultiplier)
      + FoodSecured + Coopertition
MatchEndRobotState: Level0=0, Level1=0.125, Level2=0.25, Level3=0.375, Level4=0.5
MajorFoul: 0.1, MinorFoul: 0.05   (applied to the OTHER alliance)
```

**2026 preview** — the official frontend already ships an `fgc_2026.ts` adapter for "Igniting Innovation", revealing the vocabulary **before the event happens**:

```
wildfireInRedSuppressionUnit, wildfireInBlueSuppressionUnit, wildfireInExtinguisher,
approximateWildfireIn{Red,Blue}SuppressionUnit, approximateWildfireInExtinguisher,
red/blueRobot{One,Two,Three}BraceState, coopertition,
redClimbMultiplier, blueClimbMultiplier, redPartnerClimbPoints, bluePartnerClimbPoints

BraceState:      None=0, Contact=0.05, Zone1=0.1, Zone2=0.2, Zone3=0.3
CoopertitionBonus: None=0, Four=10, Five=25, Six=40
```

> **There is no autonomous / teleop / endgame phase decomposition in any FGC season.** The FRC analytics model does not transfer directly. See [03-metrics-catalog.md](03-metrics-catalog.md).

---

## 5. `first.global` — the WordPress site

Separate from the results API. Serves team profiles, event metadata, and photos.

### 5.1 Per-nation team pages

```
https://first.global/<YEAR>-nations/<country-slug>-<year>/
e.g. https://first.global/2025-nations/mexico-2025/
```

Content: team photo, logo, roster/prose profile, contact information. **All of it is rendered HTML — there are no typed fields.** Built with WPBakery/Visual Composer, so the markup is shortcode-heavy.

**WordPress REST API is open:**

```
GET https://first.global/wp-json/wp/v2/pages?slug=mexico-2025&_fields=content,title,modified
```

Returns the full rendered content. `X-WP-Total` gives counts. This is far more reliable than scraping HTML, but still requires parsing prose out of the rendered content.

> **URL slugs are not uniform across years.** The `<year>-nations/<slug>-<year>` pattern does not hold for every season; slugs must be discovered per year, not constructed.

### 5.2 Event metadata

```
https://first.global/archive/fgc-<YEAR>/     (2017 … 2025; no 2016)
```

Contains dates, venue, theme, impact statistics, national-team lists, and links to that year's media. Also prose/HTML, not structured.

Example (2025): `29 OCT – 1 NOV 2025`, `PANAMA CITY, PANAMA`, theme `Sustainable Ecosystems`, `191 countries / 192 teams / 12,500+ youth / 41% female participation`.

### 5.3 Where event metadata actually lives today

Neither the API nor WordPress exposes typed event metadata. The official frontend **hard-codes it** in `lib/data.ts` (`yearData`) — per-year `date`, `customRankingName`, `customRankingKey`, and `watchLinks`. The archive pages are the human-readable equivalent.

**We will need our own small `events.json`**, hand-maintained once per year, sourced from the archive pages.

### 5.4 Photos and logos

Photos live inside the WordPress page content (Media Library URLs). There is **no API or structured field** for robot photos. Team logos and flags are available separately (§6).

---

## 6. Flags

The official frontend bundles 278 SVG flags from the [`lipis/flag-icons`](https://github.com/lipis/flag-icons) set (4:3), plus custom files for entities that have no country flag (`10_hope.svg`, `15.svg`, `qz.jpg`). It refreshes them with two PowerShell scripts that pull from `raw.githubusercontent.com`.

**For our project:** the same public flag set is reusable, and is a static asset we can vendor once. Note the license of `flag-icons` (MIT) differs from the results-site repo (unlicensed).

---

## 7. Video sources

| Property | Value |
|---|---|
| Official channel | **FIRST Global Media** — handle `@F1RSTglobal`, channel ID `UCTSVzV2M_ZH-dY1yAz5fiZw` |
| Per-field streams | Since 2022: **5 fields × 3 days = 15 VODs per year** |
| Title pattern | `<YEAR> FIRST Global Challenge - Day N, Field M` |
| Playlist | `<YEAR> FGC | Individual Field Streams` (public playlist) |
| **Visibility** | **Every field VOD is UNLISTED** — reachable by direct link/embed only, never via search, channel tab, or RSS |
| Main stream | `<YEAR> FIRST Global Challenge - Day N` (public), plus an Opening Ceremony video |
| Before 2022 | Single full-day streams only (no per-field split) |
| 2020 / 2021 | No field streams (virtual) |

**Critical consequences of "unlisted":**

- Playlist RSS returns **0 entries** — an easy trap to fall into.
- The channel's videos tab will never show them.
- Links must be captured and stored by us; they are not discoverable by browsing.

**There is no match → video or match → timestamp mapping anywhere** — not in the API, not in the playlists. The best official linkage is:

```
match.field (1–5)  +  match.scheduledTime (→ day)  →  field VOD URL
```

Some fields point at `first.global/live` instead of YouTube (2024 Field 3, 2025 Field 5).

> Capturing these playlists **now** is recommended: unlisted VODs plus a frontend config that changes on every rebuild make this a fragile discovery surface.

---

## 8. What is explicitly NOT available

- ❌ No documented/official API, no API keys, no API docs page, no ToS.
- ❌ No stats / OPR / EPA / Elo endpoint (an internal engine exists — see below — but is not exposed).
- ❌ No event/schedule metadata endpoint.
- ❌ No video or video-timestamp fields on matches.
- ❌ No photos or logos in the API.
- ❌ No CSV or bulk dataset export (the API call *is* the bulk export).
- ❌ No `ETag` / `Last-Modified` → no conditional GETs, no incremental sync.
- ❌ No autonomous / teleop / endgame phase decomposition in any season.
- ❌ No 2016 data; no 2020/2021 competition data.
- ❌ No published rate limits — treat as "be polite, unpublishable limits".

---

## 9. The unexposed internal stats engine

FIRST Global maintains a scoring/analytics system referred to as **EMS** (its season models live in a non-public `project-ems` codebase). The official frontend's code comments confirm that `api.first.global` is fed by an upload path that ships raw database rows from this system.

That engine reportedly defines **~212 statistics** (families: `DER` 60, `EMS` 133, `REF` 19), including:

| ID | Statistic | Model |
|---|---|---|
| A1 | OPR | least-squares |
| A6 | DPR | least-squares on opponent score |
| A7 | CCWM | score − opponent score |
| A8 | Adjusted / ridge OPR | `lambda` + mean prior |
| A9 | iOPR | iterative residual refinement |
| A10 | EPA | generic EPA |
| A11 | Component EPA | per-season component model |
| A15 | TrueSkill / Bradley-Terry | Weng & Lin 2011 |
| A16–A17 | Win probability, predicted score | |
| A20 | Model Brier score | |
| A21 | Upside/upset index | |
| A24–A25 | Strength of schedule | |
| A26 | Luck rating | |
| A29 | Ranking Score | the official ranking metric |

Its rating constants (from `rating-models.ts`): `eloPrior 1500`, `eloK 32`, `eloScale 400`, `epaK 0.3`, `btMu 25`, `btSigma 25/3`, `btBeta 25/6`, `probabilityScale 50`, `simulationSamples 1000`.

**None of this is reachable through the API, and none of it is rendered on `results.first.global`.**

> **Opportunity:** OPR/EPA-style analytics for FGC are greenfield. We would be the first to publish them. It also means we can adopt the same constants for comparability, rather than inventing our own.

> ⚠️ Because this engine is not public, all statements in this section are second-hand from frontend code comments and are **lower confidence** than the verified API behaviour above. Verify before relying on them.

---

## 10. Access etiquette

Even though nothing blocks us, this is a small volunteer-run platform and we should behave accordingly:

1. **Poll on a schedule, not in a loop.** The official site itself polls every 60 s (main) and 20 s (venue screens). Matching 60 s is defensible; going below 20 s is not.
2. **Never let each browser poll `api.first.global` directly.** Centralize polling in one service so N users cost the upstream exactly one poller. See [04-live-event-architecture.md](04-live-event-architecture.md).
3. **Backfill once and cache.** Historical seasons never change — fetch each year exactly once and commit it.
4. **Identify yourself.** Set a descriptive `User-Agent` on outbound requests.
5. **Seek permission** for sustained republishing. See [09-annual-runbook-and-risks.md](09-annual-runbook-and-risks.md).
