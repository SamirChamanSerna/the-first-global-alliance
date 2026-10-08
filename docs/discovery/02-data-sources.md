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
| Team flags (SVG) | **flag-icons** (`lipis/flag-icons`, MIT) for everything it covers; `https://results.first.global/static/flags/4x3/{alpha2}.svg` only for the codes it does not have | `node scripts/fetch-flags.js` mirrors into `site/flags/`. See the note below |
| Team photo | `https://i0.wp.com/first.global/wp-content/uploads/…?w=900&quality=89&ssl=1` | **hotlink**; the owner supplies a manual list of URLs, **one per team and season**, in `photos.csv`. No row for that season ⇒ the UI's placeholder |
| Team social / contact | `https://first.global/{year}-nations/{country}-{year}/` | scraped once, stored in the overlay |
| Season metadata | `https://first.global/archive/fgc-{year}/` — filled by hand into `seasons.csv` | host city/country/ISO, dates and the **game name** (2017 H2O Flow, 2018 Energy Impact, 2019 Ocean Opportunities, 2022 Carbon Capture, 2023 Hydrogen Horizons, 2024 Feeding the Future, 2025 Eco Equilibrium). 2026 is Incheon, Republic of Korea, 7–10 Oct, game not announced yet. 2020 and 2021 were **virtual** — no venue, so their rows stay blank |
| Team continent | manual | needed for the `/teams/` grouping; the API has no continent |
| Match video + timestamp | manual, owner-supplied | one multi-hour stream per session; a match link is a deep link with `&t=` |
| 2017–2023 matches / rankings | manual, owner-supplied | follows the raw standard in `03-raw-data-standard.md` |

**Flags: flag-icons first, results.first.global as the fallback.** Both sets are indexed by **alpha-2** (`mx.svg`), not alpha-3 — the site stores the mapping in `data/processed/flags.json` and `urls.flag()` resolves through it.

results.first.global was the original choice, but measured it is unusable for this site: its flags are 1600×960 Inkscape exports with detailed coats of arms — **47 MB for the 207 team flags**, up to 1.3 MB for one file, and the `/teams/` page would pull **45 MB** (lazy loading does not save you from scrolling). Stripping metadata only recovers 2%; the weight is the artwork.

| Source | Whole set | `/teams/` page | Median file |
|---|---|---|---|
| flag-icons (MIT) | 2.0 MB | 1.4 MB | 0.8 KB |
| results.first.global | 47 MB | 45 MB | 9.7 KB |

So: the **entire flag-icons 4x3 set** is mirrored (all 270, not only what today's seasons use, so 2026 has whatever it needs), and the handful of codes flag-icons lacks — the refugee team's `10_hope`, plus the four regional assets `11_south-america`, `12_oceania`, `13_north-america`, `14_europe` — are copied verbatim from results.first.global. Result: 275 files, 2.9 MB. `site/build.js` falls back to a grey placeholder for anything still missing, so no page ever shows a broken image.

Flag sharing is not a legal question here: flag-icons is MIT and the results.first.global assets are served publicly with no robots restrictions (verified), but the provenance of the latter is an assumption, not a confirmed licence — worth confirming before any redistribution.

**Photos are hotlinked, not mirrored.** They are large and belong to FIRST; the owner maintains the URL list by hand. No copying — the low-risk option legally and the cheaper one operationally. A photo belongs to **one season** (`photos.csv` is keyed by `year` + `team_code`), because the team's members change every year.

A season with no row simply renders the **placeholder the UI already defines** (`.photo`). Photos are decorative and never load-bearing: the frame's `aspect-ratio` plus lazy loading keep a missing image from breaking the layout, and that is why an absent photo is a normal state rather than an error. A URL that exists but later **disappears** is the one case the placeholder cannot catch: the browser shows its own broken-image/alt state inside the frame. Accepted, since the alternative — mirroring third-party images — is the thing we deliberately chose not to do.

## Open items on sources

- `/v1` without `year` returns the *current* event; confirm it also accepts a past year not in the trusted list (it does for 2024/2025, so the "untrusted" years are a data-quality judgement, not an API limitation).
