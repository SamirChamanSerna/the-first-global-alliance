# Live worker

A single Cloudflare Worker with two jobs:

- **`scheduled`** — every cron tick, fetch the complete snapshot of the live season
  (`https://api.first.global/v1?year=YYYY&excludeMatchDetails=false`), reduce it to the
  small payload the browser needs, and store it in KV.
- **`fetch`** — serve that payload at `GET /live.json` with a short cache.

The static site only loads this while a season is marked `live`. When the season is
archived, the site stops requesting `/live.json` and the worker should be stopped too.

`worker/worker.js` and `scripts/poll-live.js` are **twins**: both must produce the same
payload. Edit one and edit the other.

## Current configuration

`wrangler.jsonc` already carries the production values:

| Value | Current value |
|---|---|
| `name` | `fgc-live-poller` |
| `account_id` | `9bce53d4bb385cdab6c1072df07813bd` |
| `kv_namespaces[0].id` | `dc6a4775b2904ef09f3c5f1e8532e33e` |
| `vars.SEASON_YEAR` | `2026` (archived) |
| `triggers.crons` | `[]` — set `["*/2 * * * *"]` for a live season |
| `routes` | `tfga.fgcmexico.com/live.json` |

The Worker is reachable at `fgc-live-poller.samirchamans.workers.dev`. No secret is
required: the upstream API is public.

## Setup

```bash
npm install
npx wrangler login
npm run worker:deploy
```

If `wrangler deploy` says it is creating a Worker instead of updating one, the `name`
is wrong. Stop and fix it before continuing.

## Local test

```bash
npm run worker:dev
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
curl -s http://localhost:8787/live.json | head -c 300
```

Local KV starts empty, so the scheduled call must run before `/live.json` returns data.

## Verify in production

```bash
curl -s https://<host>/live.json | jq '{season, updatedAt, matchesCount, playedCount}'
curl -sSI https://<host>/live.json
```

The response should carry `Content-Type: application/json`, `Access-Control-Allow-Origin: *`
and `Cache-Control: public, max-age=15`.

## Archive a season

1. Set `mode: "archived"` in `data/raw/manual/seasons.json` and rebuild the static site.
2. Set `triggers.crons` to `[]` in `wrangler.jsonc` (or delete the Worker) and deploy.
3. Confirm the site no longer requests `/live.json`; then the KV namespace can be deleted
   if it is no longer needed.

## Known limitation

The `bd` (breakdown) block in both twins is written for the 2026 game. Starting a new
live season requires updating it together with
`data/raw/manual/breakdown/{year}.json`.
