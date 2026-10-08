# 04 — Pipeline

Two pipelines, one normalizer. Both produce the same shapes (`03-raw-data-standard.md`) so the templates never learn where data came from.

## A. Build-time (local and CI) — archived seasons

```
scripts/fetch-archive.js   →  data/raw/api/{year}.json        (verbatim, refreshable)
scripts/normalize.js       →  data/processed/{year}/*.json    (+ validation, fails loud)
site/build.js              →  site/dist/                      (static HTML)
deploy                     →  Cloudflare Pages                (or GitHub Pages)
```

Runs on a developer machine and in CI. No network needed at build time once `raw/` is committed — the fetch step is optional and only re-run when we want to refresh a season. This is the whole cost of the archive half: zero runtime, zero services.

Done in S0: `site/build.js` reads `data/processed/` through `site/templates/data.js`. The templates, blocks and pages did not change (agent instructions §7 Etapa 1 says exactly this), and `site/dist/` came out byte-identical.

Because `data/processed/` is not versioned, a build without it would fall back to the `mock/mock.js` fixture — so `build.js` now **stops with an error** in that case instead of quietly publishing mock data, unless `--fixture` is passed.

## B. Live worker (docker, 24/7 during the event)

A single long-running container. No inbound network, no public port.

```
loop:
  GET /v1                      → raw snapshot
  GET /v1/matches?…&id=…       → per-match details (only for new/updated matches)
  validate                     → reject partial/empty; keep last-good
  normalize                    → processed shapes
  PUT snapshot                 → DB / KV
  sleep(interval)
```

**Polling cadence**

| Condition | Interval |
|---|---|
| Match in progress (`scheduledTime` within ±cycleTime, or a new match appears) | **20 s** |
| Event day, idle between matches | **60 s** |
| Out of season | worker stopped / 15 min heartbeat |
| API error | exponential backoff 30 s → 5 min, keep last-good |

The 60 s/20 s split the owner asked for. The worker decides by reading `scheduledTime` on the match list; no manual toggling.

**Validation before publish** — the API cannot be fully trusted, so nothing reaches the DB unvalidated:
- Reject an empty payload while a match was expected; an empty `/v1` is normal *before* the event and suspicious *during* it.
- Reject a snapshot whose match count went backwards (events only accumulate).
- Reject rows that fail the schema, or reference a team not in `/v1/teams`.
- Keep the previous snapshot on any rejection and log loudly. The DB always holds a complete, valid state.

**End of the event:** freeze the final snapshot into `data/raw/` and commit **that** (`data/processed/` is derived and gitignored), rebuild statically, flip the season to `archived`, **stop the container**. That is the whole teardown — nothing to maintain until 2027.

## Storage

**Decided: Cloudflare KV.** One key, `live:snapshot`, holding exactly the JSON the browser fetches. This is a single-read workload with no queries, so KV's eventual consistency and short edge cache are a feature, not a limitation — and it keeps the DB on the same platform as the hosting, behind a Pages Function, with no second service to operate. Zero cost at this volume.

Rejected: **D1** (per-entity SQL we do not need — nothing queries "only this team's matches" from the live layer) and **Supabase** (adds a second platform, CORS handling and a client key in the browser, for Postgres and realtime features we are not using). Revisit only if one snapshot file stops being enough.

Serving, on Cloudflare Pages:

```
GET /api/live.json  →  Pages Function  →  KV  →  Cache-Control: public, max-age=30, s-maxage=30
```

Same origin (no CORS), the KV binding never reaches the client, and cache headers are ours. Between the 20–60 s worker interval and the 30 s CDN TTL, a viewer is at most ~90 s behind the field, with a single cached GET.

**Free-tier limits that shape the design:** Cloudflare Pages allows 500 builds/month, so live updates must *not* be per-minute rebuilds — that is why the live layer is a JSON fetch and rebuilds happen a few times a day. Cloudflare Workers/KV free tier (100k reads/day) is far above what a cached single-key read generates.

## Cost

| Piece | Free tier | Our usage |
|---|---|---|
| Cloudflare Pages hosting | unlimited requests/bandwidth | ok |
| Pages builds | 500/month | ~10–30/day on event days |
| Workers/KV reads | 100k/day (cached at edge) | a fraction |
| Docker host | owner-provided, already running | one container, 24/7 during the event only |
| Domain | optional | — |

Total recurring cost: **0** apart from the machine that already runs the container.

## Failure modes to handle explicitly

- API down or returning partial data mid-event → last-good snapshot stays live; the site shows a "data delayed" note rather than going blank.
- Worker dies → the static build is still complete and correct; only freshness is lost. Restart is safe (idempotent writes, keyed by match slug).
- Clock/timezone: `scheduledTime` carries an offset; store UTC, format for display from the season's timezone.
- A match id reused across seasons → prevented by the `{year}_{tournamentKey}{id}` slug.
