# New season checklist

Everything a new FIRST Global Challenge season needs, in order. Commands assume the
repository root.

## 1. Check what the API publishes

```bash
curl -s "https://api.first.global/v1?year=YYYY" | jq '{
  matches: (.matches|length),
  details: ([.matches[]|select(.details)]|length),
  rankings: (.rankings|length),
  round_robin: (.round_robin|length),
  finals: (.finals|length),
  awards: (.awards|length)
}'
```

Record what is missing. A zero in `awards` or `details` is a fact to work around, not a
bug to hide.

## 2. Add the season

Add one object to `data/raw/manual/seasons.json`:

```json
{
  "year": 2027,
  "name": "Game name",
  "city": "Host city",
  "country": "Host country",
  "iso": "ISO alpha-3 of the host",
  "dates": "1–4 October 2027",
  "revealVideo": "https://youtu.be/…",
  "mode": "live",
  "source": "api",
  "teams": null
}
```

`source` is `api` for 2023 onward and `manual` for untrusted seasons. `teams` stays `null`
unless the season has no rankings from which to derive it (the 2020/2021 case).

## 3. Fetch and process

```bash
npm run fetch:archive -- 2027
npm run normalize
npm run build
```

`normalize` fails loudly if the snapshot or a manual file is malformed. Fix the input; do
not relax the check.

## 4. Add the season-specific manual files

- `data/raw/manual/rankings/2027.json` — ordered ranking columns and labels.
- `data/raw/manual/breakdown/2027.json` — the rows of the match breakdown. The API's
  `details` fields are game-specific; the map names the red/blue pair, the global fields
  and the format of each row.
- `data/raw/manual/awards/2027.json` — only if the API has no awards.
- `data/raw/manual/streams/2027.json` — field and day streams, if the event has them.
- `data/raw/manual/playlists.json` — that season's YouTube playlist. Run
  `npm run fetch:playlist-thumbs` afterwards.
- `data/raw/manual/videos/2027.json` — the video extractor's output, if available.
- `data/raw/manual/photos.json` — one photo per team and season, hotlinked.
- `data/raw/manual/teams.json` — continents for any new teams.

## 5. Turn on the live layer

1. Set `"SEASON_YEAR": "2027"` in `wrangler.jsonc`.
2. Add the KV namespace id and confirm the Worker name (see `worker/README.md`).
3. Deploy: `npm run worker:deploy`.
4. Verify:

   ```bash
   curl -s https://<host>/live.json | jq '{season, updatedAt, matchesCount, playedCount}'
   ```

5. Open a season page, a match page and GameDay with JavaScript on and off.

The client reads the live year from `<html data-live-year="…">`; the build writes it when
some season is `live`. No other switch is needed.

## 6. Archive after the event

1. Freeze the final snapshot: `npm run fetch:archive -- 2027`.
2. Set `"mode": "archived"` in `seasons.json`.
3. Remove `"triggers"` from `wrangler.jsonc` (or delete the Worker) and deploy.
4. Rebuild:

   ```bash
   npm run normalize
   npm run build
   npm run check
   ```

5. Confirm the static site no longer requests `/live.json`, and that the season page uses
   the archived layout.
6. The pre-JSON CSVs were removed after the migration; there is nothing left to clean up.

## 7. Update the docs

- Add the season to `README.md` if the coverage wording changes.
- Note any API gap in `docs/api-notes.md`.
- Keep `worker/README.md` in sync with `scripts/poll-live.js` — they are twins.
