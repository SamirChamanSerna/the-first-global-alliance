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
| `seasons.csv` | One row per season: game name, host city/country/ISO, dates, reveal-video URL, and `mode` |
| `teams.csv` | The roster, pre-filled from the API. Fill `continent` and the social columns |
| `photos.csv` | One team photo per season: `year`, `team_code`, hotlinked `photo_url` |
| `videos.csv` | Match video links: stream URL + start/end timestamps |
| `{year}/matches.csv` | Matches for years the API does not serve (2017–2019, 2022, 2023) |
| `{year}/rankings.csv` | Final ranking of **every** season, 2024-2025 included. Fixed columns `year,team_code,rank`, then that season's tie-breaker criteria |
| `rankings.labels.json` | Readable label for each ranking criterion (`Total_Hydrogen_Oxygen_Points` → `Total hydrogen/oxygen points`) |
| `{year}/alliances.csv` | Playoff alliances for those years |

Years without a folder are not missing — 2020 and 2021 had no physical competition (awards only, `mode=awards-only`), 2024 and 2025 come from the API, and 2026 is live.

## Rules that are easy to get wrong

- **`team_code` is the roster's code** as it appears in `teams.csv` (`MEX`, `ZAM`, `GER`). The standard ISO alpha-3 (`ZMB`, `DEU`) is also accepted for country codes — the build bridges both through alpha-2. Never the numeric `teamKey`, which is reassigned every season. The exceptions are the special teams, which must use their canonical code: `10` (refugees, though `HOPE` also resolves) and `11`–`16` (the 2017-2018 continental teams).
- **A blank cell means "no data".** Never write `0`, `-`, `N/A` or `?` to stand in for something we do not have. The site renders an explicit empty state; a fake zero shows up as a real result.
- **A blank score means the match was not played.** That is a state, not a 0–0.
- **Alliance size comes from the columns you fill**, not from a fixed number: 3 teams in `ranking`, 4 in `round_robin` and `finals`.
- **Quote any value containing a comma** — `"Team Hong Kong, China"`. Spreadsheets do this automatically; a hand-edited file must too.
- **`stage` is one of** `ranking`, `round_robin`, `finals`. **`mode` is one of** `archived`, `live`, `awards-only`.
- Do not add, rename or reorder columns. Extra columns are ignored; missing ones fail the build.

## Examples

`seasons.csv` — one row per season. Everything here shows up directly on the site: fill it and rebuild, nothing else to touch.

```
year,name,city,country,iso,dates,reveal_video,mode,teams
2025,Eco Equilibrium,Panama City,Panama,PAN,"Oct 29 – Nov 1, 2025",https://www.youtube.com/watch?v=VIDEOID,archived,
```

- `name` is the **game** of that season ("Eco Equilibrium"), not the event — it is what the season heading and match pages show. `year` is already filled; leave `mode` as it is.
- `iso` is the host country's **alpha-3** (`PAN`). It is what resolves the flag next to the country name, so a wrong code means a grey box, not a wrong flag.
- Quote any value containing a comma — dates usually do (`"Oct 29 – Nov 1, 2025"`).
- `reveal_video` is the game-reveal URL. It must start with `http://` or `https://`; anything else is ignored rather than rendered. The season page shows that season's video, and the Insights overview shows the most recent season that has one. Leave it blank and the page keeps its placeholder box.
- `teams` is the number of participating teams, and it stays **empty** in the normal case — it is derived from that season's ranked teams. Fill it **only** when there is nothing to derive it from: 2020 and 2021 were held virtually, with no rankings or matches, so they carry `175` and `177`. Leave the cell empty, never `0`.

`videos.csv` — one match per row, timestamps into a multi-hour stream:

```
match_id,video_url,start,end
2025_q12,https://www.youtube.com/watch?v=XXXXXXXXXXX,3:42:10,4:05:00
```

`photos.csv` — one photo per team **and season**:

```
year,team_code,photo_url
2025,MEX,https://i0.wp.com/first.global/wp-content/uploads/2025/10/team-mexico.jpg?w=900&quality=89&ssl=1
```

- One row per `(year, team_code)`. Both keys must exist elsewhere: the year in `seasons.csv`, the code in `teams.csv` (the API roster). A row with an unknown year or code, a duplicate pair, or a URL that is not `http(s)://` **fails the build** — it is not skipped.
- Write the URL exactly as it comes, with a raw `&` and no surrounding quotes (there is no comma in it).
- A team with no photo for that season simply renders the UI placeholder. That is a normal state, not an error.

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

Team photos are **not** copied into the repo: `photos.csv` holds the public FIRST URL and the page hotlinks it. A photo belongs to **one season**, not to the team in general — the members change every year, so it is keyed by `(year, team_code)` and shows next to that season in the Team History timeline and on the Team Season page. A team with no URL renders the UI placeholder, which is a normal state, not an error. Because the URL is third-party, it can rot: if the image disappears later the browser shows a broken/alt state rather than the placeholder.
