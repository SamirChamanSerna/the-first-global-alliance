# FIRST Global results API — notes

These are working notes, not an official API contract. They describe what this project
actually observes and how it works around it. The upstream API can change without notice.

## Endpoints

| Endpoint | Contents |
|---|---|
| `GET https://api.first.global/v1/teams` | Static roster: `teamKey`, `country`, `countryCode`, `name`. |
| `GET https://api.first.global/v1?year=YYYY` | Full season snapshot. |
| `GET https://api.first.global/v1/awards?year=YYYY` | Awards only (empty for 2020, 2021 and 2026). |

The project always requests the **complete** snapshot: no `excludeMatchDetails=true`.
That flag removes `details`, which is the only source of the match breakdown. The stored
snapshots in `data/raw/api/` are verbatim responses.

## Snapshot shape

```json
{
  "matches": [],
  "rankings": [],
  "round_robin": [],
  "finals": [],
  "alliances_round_robin": [],
  "alliances_finals": [],
  "awards": []
}
```

`matches` contains every stage. The stage is in `tournamentKey`:

| `tournamentKey` | Stage | Site prefix |
|---|---|---|
| `t2` | qualification / ranking | `q` |
| `t3` | round robin | `rr` |
| `t4` | finals | `f` |

`round_robin` and `finals` are **ranking rows**, not matches. The match itself is in
`matches` with the corresponding `tournamentKey`.

## Match shape

- `participants[]` carries `station`: `11`–`14` are the red alliance, `21`–`24` the blue.
  Qualifiers use stations 11–13 and 21–23 (three teams); round robin and finals use four.
- `field` is the field number. `played` says whether the match has a result.
- `details` is game-specific and its fields change every season. The site never assumes a
  field list: each season has a map in `data/raw/manual/breakdown/{year}.json`.
- `scheduledTime` is ISO 8601 with the event's UTC offset. The site stores it as-is and
  derives the local clock time from the string, never from the build machine's timezone.

## Country codes

There are two code spaces:

- **Roster** (`/v1/teams`): the canonical code. `MEX`, `ANT`, `10`, `14`…
- **Competition** (`matches`, `rankings`, `alliances`): another alpha-3 that disagrees
  between seasons, e.g. `ATG` vs `ANT`, `HPE` vs `10`.

The alpha-2 field (`countryCode`) is the only reliable bridge. `scripts/lib/codes.js`
translates competition codes to roster codes. **Never use `teamKey` as a key**: it is
reassigned every season. Special cases:

- `10` is the refugee team; its flag asset is `10_hope`.
- `11`–`16` are the 2017–2018 continental teams, which are not in the API roster.
- Awards identify countries by name and alpha-2, never alpha-3.

## Awards

The API award shape is:

```json
{
  "name": "…",
  "description": "…",
  "gold": { "country": "…", "countryCode": "…" },
  "silver": null,
  "bronze": null,
  "other": [{ "country": "…", "countryCode": "…", "class": "gold", "recipientName": null }],
  "sortOrder": 10
}
```

- Alliance awards put their captain in the slot matching their own tier (`gold`, `silver`
  or `bronze`) and the rest of the alliance in `other[]` with `class`.
- `recipientName` marks an award to a person or institution. Those awards are **not team
  medals** and are excluded from the site.
- Awards for 2017–2019 and 2022 still come from the API, which is the only source for
  those years. Awards for 2020, 2021 and 2026 are maintained by hand in
  `data/raw/manual/awards/{year}.json`.

## Missing or unreliable data

| Season | Situation |
|---|---|
| 2017–2019 | No matches in the API. Rankings and awards exist; rankings are hand-maintained. |
| 2020–2021 | No competition. No matches, rankings or awards in the API. Awards are manual. |
| 2022 | The API returns rankings and playoff data, but its team association is corrupt (scores match by rank, teams do not). The project uses the hand-maintained ranking only. |
| 2023–2026 | Full API data, including `details`. 2023 is the first trusted season. |
| 2026 | The API has no awards. They are maintained by hand in `data/raw/manual/awards/2026.json`. |

Other gaps:

- The API has no season metadata, team continents, photos, social links or stream URLs.
  Those live in `data/raw/manual/`.
- 2024 has one ranking row without a `team` object (rank 181). The build skips it.
- In 2017 and 2018 the API reports `wins`, `losses` and `ties` as all zeros; they are not
  data and the site does not use them.

## Ranking criteria per season

| Season | Extra field | Label |
|---|---|---|
| 2017 | `cumulativePoints`, `matchPoints`, `highestScore` | Cumulative points, Match points, High score |
| 2018 | `rankingPoints`, `totalPoints`, `coopertitionPoints`, `parkingPoints` | Ranking points, Total points, Coopetition points, Parking points |
| 2019 | `rankingPoints`, `totalPoints` | Ranking points, Total points |
| 2022 | `carbonPoints` | Carbon points |
| 2023 | `oxyHydroPoints` | Total hydrogen/oxygen points |
| 2024 | `foodSecuredPoints` | Total food secured points |
| 2025 | `protectionPoints` | Protection points |
| 2026 | `climbPoints`, `played` | Climb points, Played |

The order is declared in `data/raw/manual/rankings/{year}.json`; the API does not declare
it.

## Terms

The API is public and currently unauthenticated. The project owner has reviewed its terms
and the use made of the data. See [`../LICENSE-DATA.md`](../LICENSE-DATA.md) for
attributions.
