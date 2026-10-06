# Hand-entered data

Everything here is filled in by a human. It is the **only** hand-written data in the repo; the rest is fetched or generated.

The rules, keys and full column list live in `docs/discovery/06-join-keys.md` — read that first. This file is the quick operational guide.

Regenerate the empty templates at any time:

```bash
node scripts/make-manual-templates.js
```

It never overwrites an existing file, so re-running it is always safe.

## Files

| File | Purpose |
|---|---|
| `seasons.csv` | One row per season: host city, country, ISO, dates, and `mode` |
| `teams.csv` | The roster, pre-filled from the API. Fill `continent`, `photo` and the social columns |
| `videos.csv` | Match video links: stream URL + start/end timestamps |
| `{year}/matches.csv` | Matches for years the API does not serve (2017–2019, 2022, 2023) |
| `{year}/rankings.csv` | Final rankings for those years |
| `{year}/alliances.csv` | Playoff alliances for those years |

Years without a folder are not missing — 2020 and 2021 had no physical competition (awards only, `mode=awards-only`), 2024 and 2025 come from the API, and 2026 is live.

## Rules that are easy to get wrong

- **`team_code` is ISO alpha-3, uppercase** (`MEX`). Never the numeric `teamKey` — it is reassigned every season. Use the codes as they appear in `teams.csv`, which is generated from the API. The one exception is `10`, the refugee team.
- **A blank cell means "no data".** Never write `0`, `-`, `N/A` or `?` to stand in for something we do not have. The site renders an explicit empty state; a fake zero shows up as a real result.
- **A blank score means the match was not played.** That is a state, not a 0–0.
- **Alliance size comes from the columns you fill**, not from a fixed number: 3 teams in `ranking`, 4 in `round_robin` and `finals`.
- **Quote any value containing a comma** — `"Team Hong Kong, China"`. Spreadsheets do this automatically; a hand-edited file must too.
- **`stage` is one of** `ranking`, `round_robin`, `finals`. **`mode` is one of** `archived`, `live`, `awards-only`.
- Do not add, rename or reorder columns. Extra columns are ignored; missing ones fail the build.

## Examples

`seasons.csv`

```
year,name,city,country,iso,dates,mode
2025,FIRST Global Challenge,Panama City,Panama,PAN,Oct 29 – Nov 1 2025,archived
```

`videos.csv` — one match per row, timestamps into a multi-hour stream:

```
match_id,video_url,start,end
2025_q12,https://www.youtube.com/watch?v=XXXXXXXXXXX,3:42:10,4:05:00
```

`2023/matches.csv` — a played match and an unplayed one:

```
year,id,stage,label,scheduled_time,field,red_1,red_2,red_3,red_4,blue_1,blue_2,blue_3,blue_4,red_score,blue_score,video_url
2023,12,ranking,Ranking Match 12,2023-10-11T09:15:00+08:00,2,MEX,BRA,JPN,,FRA,GER,ITA,,,,
```

`2023/alliances.csv` — `stage` tells the size: 4 picks in round robin and finals.

```
year,stage,alliance_number,captain,pick1,pick2,pick3
2023,round_robin,1,MEX,BRA,JPN,IND
```

## What the build does with these

Every file is validated (keys exist, no duplicate ids, controlled vocabularies, alliance sizes) and the build **fails loudly** on a bad row rather than rendering something wrong. The CSVs are then converted into the JSON the site consumes — nothing reads CSV at runtime, and no CSV is ever served.

Team photos are **not** copied into the repo: `teams.csv` holds the public FIRST URL and the page links to it. A team with no URL renders the UI placeholder, which is a normal state, not an error.
