# Hand-maintained data

Everything in this directory is JSON and is maintained by a person. The rest of the
pipeline is either fetched from the FIRST Global API or generated.

The API is trusted for **2023–2026**. For **2017–2022** the API is not reliable, so those
seasons use snapshots built from this directory. 2020 and 2021 had no physical
competition: they only have awards.

## Files

| File | Purpose |
|---|---|
| `seasons.json` | One object per season: name, host city/country/ISO, dates, reveal video, `mode` (`live`, `archived`, `awards-only`) and `source` (`api` or `manual`). |
| `teams.json` | The roster: display name, continent, flag key and optional social links. |
| `photos.json` | Team photos: `{ "2025": { "MEX": "https://…" } }`. One photo per team **and season**. |
| `playlists.json` | One YouTube playlist per season: `{ "2026": { "url", "title", "thumbnail" } }`. |
| `awards/{year}.json` | Awards for seasons where the API has none (2020, 2021, 2026). Team awards only. |
| `breakdown/{year}.json` | The rows of the match breakdown for a season. |
| `rankings/{year}.json` | Ordered ranking columns and labels for a season. |
| `snapshots/{year}.json` | API-shaped snapshot for an untrusted season (2017–2022). |
| `streams/{year}.json` | Field and day streams for a live season. |
| `videos/{year}.json` | Output of the video extractor: the exact deep link of each match. |

## Rules that are easy to get wrong

- **Team identity is the roster code**, normally ISO alpha-3 (`MEX`, `KAZ`). ISO alpha-3
  spellings (`DEU`, `CHL`) are accepted and bridged through alpha-2. Never use `teamKey`:
  it changes every season.
- **A missing value is `null` or an absent key.** Never write `0`, `-`, `N/A` or an empty
  string to stand in for data you do not have. The site has explicit empty states.
- **A blank score means the match was not played**, not 0–0.
- **Alliance size comes from the data**: three teams in qualifiers, four in round robin
  and finals.
- **Awards are for teams.** Awards to individuals, mentors, sponsors or institutions are
  excluded from the site, even if they are listed in the source.
- **Photos are hotlinked**, never copied into the repository. Only `http(s)` URLs are
  accepted; a bad URL fails the build.
- **Playlists are one per season.** `thumbnail` is optional; `npm run fetch:playlist-thumbs`
  fills it from YouTube's `og:image`.
- **Ranking columns are per season.** `rankings/{year}.json` fixes the order and the label
  of every criterion; the API does not declare either.

## File shapes

### `seasons.json`

```json
[
  {
    "year": 2026,
    "name": "Igniting Innovation",
    "city": "Incheon",
    "country": "Republic of Korea",
    "iso": "KOR",
    "dates": "7–10 October 2026",
    "revealVideo": "https://youtu.be/…",
    "mode": "archived",
    "source": "api",
    "teams": null
  }
]
```

`teams` is normally `null`; the count is derived from the ranking. Fill it only when there
is nothing to derive it from (2020 and 2021).

### `rankings/{year}.json`

```json
{
  "year": 2024,
  "fields": [
    { "field": "rankingScore", "label": "Ranking score" },
    { "field": "highestScore", "label": "Highest points" },
    { "field": "foodSecuredPoints", "label": "Total food secured points" }
  ]
}
```

Rank and W-L-T are fixed columns outside this list.

### `breakdown/{year}.json`

```json
{
  "year": 2024,
  "rows": [
    { "label": "Food produced", "red": "redFoodProduced", "blue": "blueFoodProduced" },
    { "label": "Coopertition", "global": "coopertition", "column": "both" }
  ]
}
```

A row can be:

- `{ red, blue }` — one API field per side.
- `{ global, column }` — one match-wide field, shown in `red`, `blue` or `both`.
- optional `format`: `plain`, `multiplier`, `ceil`, `fixed2`, `percent`.
- optional `multiply: { red, blue }` — multiply the side field by its multiplier field.

### `awards/{year}.json`

```json
[
  {
    "award": "FIRST Global Winning Alliance Award - Gold",
    "description": "Awarded to the four teams in the winning alliance.",
    "type": "alliance",
    "tier": "gold",
    "teams": ["UZB", "MDA", "VEN", "ESA"]
  },
  {
    "award": "Albert Einstein Award for FIRST Global International Excellence",
    "description": "…",
    "type": "podium",
    "winners": { "gold": "MEX", "silver": "ROU", "bronze": "TUR" }
  }
]
```

`type` is `alliance`, `podium`, `non-tiered`, `individual` or `mentorship`. The last two
are kept in the file for the record but are not published as team awards.

### `snapshots/{year}.json`

Same top-level shape as the API:

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

A ranking row uses `team.country` (roster or ISO alpha-3), `rank`, `team.countryCode`,
`team.name` and the season's criteria keys.

### `streams/{year}.json`

```json
{
  "year": 2026,
  "days": [
    { "day": 1, "fields": { "Field 1": { "id": "…", "url": "https://…" } } }
  ]
}
```

The GameDay uses the highest day present. Add the next day's rows when it starts.

## Legacy files

The pre-JSON CSVs and the `make-manual-templates.js` generator were removed after the
migration. The JSON files above are the only source.
