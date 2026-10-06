# 02 — Data sources and reliability

## api.first.global

Base URL: `https://api.first.global` (staging: `https://api.fgcstage.zaiser.dev`). Fastify-style JSON, no auth, no documented rate limit. Discovered by inspecting the client bundle of `results.first.global`.

| Endpoint | Returns | Notes |
|---|---|---|
| `GET /health` | `{"status":"ok"}` | liveness check for the worker |
| `GET /v1/teams` | `[{teamKey, country, countryCode, name}]` | full static roster, **not** per-year. `country` = ISO alpha-3, `countryCode` = alpha-2 |
| `GET /v1?year=YYYY` | snapshot object (below) | the main endpoint |
| `GET /v1` | same, for the current/live event | empty arrays before the event starts |
| `GET /v1/matches?year=&tournamentKey=&id=` | one match **with `details{}`** | the game-specific breakdown lives here only |
| `GET /v1/awards` | `[]` | empty; awards actually arrive inside `/v1?year=` |

Unknown query params are ignored; the official client uses `excludeMatchDetails=true` to keep the snapshot small. **Without it the snapshot already carries match details**, which is what we want for the → breakdown UI.

### Snapshot shape (`/v1?year=`)

Top level: `matches[]`, `rankings[]`, `round_robin[]`, `finals[]`, `alliances_round_robin[]`, `alliances_finals[]`, `awards[]`.

- **match**: `{eventKey, tournamentKey, id, name, scheduledTime, cycleTime, redScore, redMinPen, redMajPen, blueScore, blueMinPen, blueMajPen, participants[]}`. `participants[]` = `{station, teamKey, country, countryCode, disqualified, cardStatus, surrogate, noShow}`. **Station encodes the side**: `11,12,13` = red, `21,22,23` = blue. `tournamentKey` observed: `t2` = ranking, `t3` = round robin, `t4` = finals.
- **ranking / round_robin / finals row**: `{teamKey, rank, rankChange, played, wins, losses, ties, rankingScore, highestScore, protectionPoints, team{}}`. `finals` reuses `rankingScore` to carry something else — verify before trusting.
- **alliance**: `{captain, pick1, pick2, pick3}` — each `{teamKey, allianceRank, allianceNameShort, allianceNameLong, isCaptain, pickOrder, team{}}`. Alliance number = `allianceRank`. Confirms 3 teams in quals, 4 in RR/finals.
- **award**: `{name, description, gold:{country,countryCode}, silver, bronze, other:[{country,countryCode,class}], eventKey, sortOrder}`. Tiered awards fill `gold/silver/bronze` with **one** country each; alliance awards put the winning alliance in `gold` plus the rest in `other[]` with `class:"gold"`. `class` is the tier for every `other` entry.
- **not present anywhere**: season metadata (city, venue, dates), team continent, photos, social links, video URLs.

**2020 and 2021 do not exist in the API at all** — zero matches, zero rankings, zero awards. The owner's instruction is to keep those seasons' awards, so they have to be entered by hand; there is no source to fetch them from. Everything else in this section is confirmed against live responses.

**The API has two code spaces.** Match and ranking rows use one alpha-3 (`ATG`), `/v1/teams` uses another (`ANT`), and they disagree with each other between years too; the refugee team is `HPE` in matches and `10` in the roster. The alpha-2 field is the only consistent bridge. See `06-join-keys.md` for the rule and `scripts/lib/codes.js` for the implementation.

**Round trip worth knowing:** `field` and `played` are only present when the request includes `excludeMatchDetails=true`. Without it the snapshot has neither — counterintuitive, verified.

**`teamKey` is not stable across seasons** — measured, 161 of the 168 countries present in both 2024 and 2025 carry a different `teamKey`. It joins rows *within* one payload and nothing else. The stable identity is the ISO alpha-3 `country` field; see `06-join-keys.md`.

Field sets also drift between seasons: the 2024 ranking rows carry a game-specific `foodSecuredPoints` where 2025 carries `protectionPoints`, and 2024 contains one ranking row with no `team` object at all (a 181st entry with no country). Normalization must tolerate both — read fields defensively, never assume a fixed set.

## Reliability matrix

Per the owner, only these are trustworthy:

| Data | 2017–2023 | 2020–2021 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|
| matches / rankings / alliances | ❌ manual | — no event — | ✅ trusted | ✅ trusted | live |
| awards | ✅ trusted | ✅ trusted | ✅ trusted | ✅ trusted | live |

2020 and 2021 had no physical competition: **awards only**, no matches, rankings or team timelines.

Everything outside the ✅ cells is treated as **nonexistent** until the owner supplies it. It is not "probably wrong" — it is absent, and pages must show the explicit empty states the spec already mandates.

## Sources that are not the API

| Need | Source | How |
|---|---|---|
| Team flags (SVG) | `https://results.first.global/static/flags/4x3/{iso2}.svg` | download once, **mirror** into `site/flags/` (licence believed MIT). Special codes also exist: `10_hope`, `11_south-america`, `12_oceania`, `13_north-america`, `14_europe` |
| Team photo | `https://i0.wp.com/first.global/wp-content/uploads/…?w=900&quality=89&ssl=1` | **hotlink**; the owner supplies a manual list of URLs, one per team. No URL ⇒ the UI's placeholder |
| Team social / contact | `https://first.global/{year}-nations/{country}-{year}/` | scraped once, stored in the overlay |
| Season metadata | first.global archive pages, manual | city, venue, country, ISO, dates |
| Team continent | manual | needed for the `/teams/` grouping; the API has no continent |
| Match video + timestamp | manual, owner-supplied | one multi-hour stream per session; a match link is a deep link with `&t=` |
| 2017–2023 matches / rankings | manual, owner-supplied | follows the raw standard in `03-raw-data-standard.md` |

**Flags are mirrored, photos are hotlinked.** Flags are tiny, static and licensed permissively (MIT) — mirroring them keeps a page from ever failing on a third party. Photos are large and belong to FIRST; they are **linked as-is from the public URLs**, and the owner maintains the list by hand. No mirroring, no copying — the low-risk option legally and the cheaper one operationally.

A team with no URL, or whose image later disappears, simply renders the **placeholder the UI already defines** (`.photo`). Photos are decorative and never load-bearing: the `width`/`height` + lazy-loading rules already keep a missing image from breaking the layout. That is the accepted trade-off, and it is why the overlay treats an absent `photo` as a normal state rather than an error.

## Open items on sources

- `/v1` without `year` returns the *current* event; confirm it also accepts a past year not in the trusted list (it does for 2024/2025, so the "untrusted" years are a data-quality judgement, not an API limitation).
