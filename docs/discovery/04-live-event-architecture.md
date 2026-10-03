# 04 — Live Event Architecture

> ⏭ **DEFERRED — post-MVP**, but the analysis stands and §4.1 (cadence), §4.2 (two-tier fetch), §4.4 (client payload) and §5 (degradation) are the specification for phase F5.
>
> **Refined by decision D2:** the live system is not a separate site. It is a **second data origin serving the same artifact paths**, produced by re-running the *same emit code* against R2. The page reads a URL it was given at build time and never knows which origin it came from. See [`../plan/01-architecture.md §4`](../plan/01-architecture.md).
>
> **Corrected:** §4.4 and §5 assume "publishing the live overlay" is a cheap operation. It is not cheap *via a deploy* — a 60 s cadence is ~2,400 publishes per event against a 500/month Cloudflare Pages limit and a ~10/hour GitHub Pages limit. That is why the overlay goes to object storage ([`../plan/README.md §2`](../plan/README.md#2-decisions-log), D3).

> How to follow an FGC event in progress with ≤15–30 min lag, at ~$0, without abusing the upstream API.

---

## 1. The requirement, restated

The stated goal: live coverage during the event with a **maximum lag of 15–30 minutes** versus the official FIRST Global platform.

**This requirement is easily met — and it is not the hard part.** Because we would consume the *same* API that `results.first.global` consumes, our data is never fundamentally staler than theirs. Realistically we can track within **60 seconds**.

The actual engineering problems are:

1. **Politeness.** `api.first.global` has no rate limiting and no caching (`Cache-Control: no-store`). Nothing stops us from hammering it — which is exactly why we shouldn't.
2. **Fan-out.** A hundred concurrent viewers must not become a hundred pollers.
3. **Derived metrics.** Rankings, ratings, and per-team aggregates must be computed server-side, not per-client.
4. **Degradation.** The upstream API will have bad moments during an event. The site must stay useful.

---

## 2. What "live" means upstream

The official site's own behaviour (read from its source) establishes the reference:

| Page | Poll interval |
|---|---|
| Home / results | 60 s |
| Venue screens (`/_pit`, `/_ticker`) | 20 s |

There is **no WebSocket, no SSE, no push channel** — polling is the only mechanism, for them and for us.

"Liveness" of a match is **derived client-side, not signalled**:

```
isLive = !match.played && |match.scheduledTime - now| < 3.5 minutes
```

That is the whole live-detection heuristic. We should reuse it rather than invent one.

### Field and stream mapping

Each match carries `field` (1–5). The official site carries a hard-coded `watchLinks` map with 7 keys — `all`, `main`, `field1` … `field5` — pointing at either `first.global/live` or a YouTube URL. That is the complete official match→stream linkage.

---

## 3. Candidate topologies

### Option A — Browser polls `api.first.global` directly

Because CORS is `*`, a static page can call the API with no backend at all.

| | |
|---|---|
| ✅ | Zero infrastructure. Truly $0. Nothing to run or maintain. |
| ✅ | Zero lag versus official — same source, same moment. |
| ❌ | **Every viewer becomes a poller.** 200 viewers × 60 s polls = 200× the load on a small volunteer-run API. Unacceptable. |
| ❌ | Every viewer downloads the full 620 KB season bundle per poll. On the slow connections this project explicitly targets, that is disqualifying. |
| ❌ | No derived metrics (ratings, aggregates) without shipping the computation to every client. |
| ❌ | No control: if the API shape changes mid-event, every cached client breaks at once. |

**Rejected** — the fan-out is the fatal flaw, and it violates the access etiquette in [01 §10](01-data-sources.md#10-access-etiquette).

### Option B — Central poller → public store → clients

One Docker service polls upstream; clients read a small, purpose-built payload from a cheap public store.

| | |
|---|---|
| ✅ | Upstream sees exactly **one** poller regardless of audience size. |
| ✅ | Clients download a **small** payload, not the 620 KB bundle. |
| ✅ | Derived metrics (standings, ratings, per-team views) computed once, server-side. |
| ✅ | Full control over degradation and caching. |
| ❌ | A service must be running during the event. |
| ❌ | Introduces a public store dependency. |

### Option C — Hybrid: static archive + live overlay (recommended)

Option B, plus the static archive as the always-available base layer.

| | |
|---|---|
| ✅ | Everything in B. |
| ✅ | Historical pages work with **no** live service running — pure static, cacheable forever. |
| ✅ | If the poller dies or the store is down, the site degrades to the last-frozen archive instead of failing. |
| ✅ | Exactly matches the required year-over-year cycle: live → freeze → static. |

---

## 4. Recommended design

```
                    ┌──────────────────────────────┐
                    │  api.first.global  (upstream)│
                    └───────────────┬──────────────┘
                                    │ 1 poll / 60 s (active windows only)
                                    ▼
                    ┌──────────────────────────────┐
                    │  Poller  (Docker, home host) │
                    │  • poll season bundle        │
                    │  • detect changes            │
                    │  • backfill match details    │
                    │  • compute derived metrics   │
                    └───────┬──────────────┬───────┘
                            │              │
             publishes live │              │ commits frozen archive
                            ▼              ▼
              ┌──────────────────┐   ┌─────────────────────┐
              │ Public live store│   │  Git repo → Pages   │
              │ (Supabase / R2)  │   │  (static JSON)      │
              └────────┬─────────┘   └──────────┬──────────┘
                       │                        │
                       └───────────┬────────────┘
                                   ▼
                        ┌─────────────────────┐
                        │  Static frontend    │
                        │  (GitHub Pages)     │
                        │  historical: static │
                        │  live: poll store   │
                        └─────────────────────┘
```

### 4.1 Polling schedule

Do **not** poll at a constant rate around the clock. Drive the cadence from the published schedule:

| Window | Cadence | Rationale |
|---|---|---|
| No event running | **never** | Historical data is frozen; nothing to poll. |
| Event day, outside match blocks | 300 s | Cheap heartbeat to catch schedule changes. |
| Event day, match block active | **60 s** | Matches the official site's own cadence. |
| Within ±3.5 min of a `scheduledTime` | 20 s | Matches the official venue screens; scores land promptly. |

Estimated upstream load for a 4-day event, ~10 active hours/day at 60 s: **~2,400 requests total**, or roughly **1.5 GB** downloaded once. That is modest and defensible — comparable to what a single official venue screen consumes.

### 4.2 Two-tier fetching (the key efficiency win)

The season bundle is fetched **without** `details` (`excludeMatchDetails=true`, 624 KB for 2025). Match details are fetched separately, and **only once per match, only after it is final**:

```
poll:  GET /v1?year=2026&excludeMatchDetails=true         # ~600 KB, every 60 s
diff:  for each match that transitioned played=false→true:
           GET /v1/matches?year=2026&tournamentKey=tN&id=N  # ~1.8 KB, exactly once
```

Why this is correct:

- A completed match's `details` **never change** — no need to re-fetch.
- ~380 matches × 1.8 KB ≈ **684 KB total** for an entire season's scoring breakdowns.
- Live polls stay on the lighter payload.

### 4.3 Change detection

Never republish blindly. Compute a content hash over the arrays that matter (`matches[].{played,redScore,blueScore}`, `rankings[]`) and publish only when the hash changes. During dead periods this reduces store writes to zero, which matters on free tiers that bill writes or count them against quotas.

Publishing should also be **idempotent** — the same input must produce byte-identical output, so repeated runs are no-ops and git commits stay meaningful.

### 4.4 Client payload

Clients must not receive the season bundle. Publish a small, purpose-built live document:

```jsonc
// live/2026.json   — target < 40 KB
{
  "generated_at": "2026-10-08T14:32:11Z",
  "source_ok": true,
  "stale": false,
  "season": 2026,
  "stage": "t2",
  "standings": [ { "team_id":"kz", "rank":1, "w":9, "l":3, "rs":412.5 } ],
  "recent":    [ { "match_id":"2026:t2:214", "field":3, "red":[...], "blue":[...],
                   "red_score":88, "blue_score":74, "result":"red",
                   "scheduled_time":"...", "is_live":false } ],
  "upcoming":  [ /* next N matches with field + scheduledTime */ ],
  "streams":   { "main":"...", "field1":"...", "field5":"..." }
}
```

Clients poll **this** every 60 s (not upstream). At ~40 KB and CDN caching, a thousand concurrent viewers is a non-issue.

---

## 5. Failure and degradation

| Failure | Behaviour |
|---|---|
| `api.first.global` returns 5xx | Keep last-good payload; re-serve it with `"stale": true` and a "data may be delayed" banner. Retry with exponential backoff (5 s → 10 s → 30 s → 60 s, cap 60 s). |
| `api.first.global` slow / times out | Timeout at 15 s, count as a failed poll, keep last-good. Never block the publish cycle on a slow response. |
| Poller host offline | Clients keep polling the store; payload ages. After a threshold (e.g. 5 min), the UI shows a "live updates paused" state. The static archive keeps working throughout. |
| Store unreachable | Frontend falls back to the frozen static archive for all historical pages and shows an explicit "live unavailable" notice. |
| Schema change mid-event | The poller validates the payload shape before publishing. On unexpected shape: **do not publish**, alert, keep serving last-good. This is the highest-risk failure — see [09](09-annual-runbook-and-risks.md). |

**Principle: the site must never show a blank page or a wrong score.** Showing an explicitly-stale score is acceptable; showing a silently-stale one is not.

---

## 6. Why not Supabase Realtime / WebSockets?

Tempting, but:

- FGC already has **no push channel** — any push we add is synthesized from polling anyway.
- Supabase's free tier allows ~200 peak realtime connections; a 60 s HTTP poll of a CDN-cached 40 KB file scales further and costs less.
- HTTP polling is trivially cacheable and degrades gracefully; a websocket either connects or doesn't.

**Recommendation: plain HTTP polling of a static live document.** Revisit only if realtime demand materialises.

---

## 7. Event-day runbook (summary)

Full procedure in [09](09-annual-runbook-and-risks.md).

1. **T−7 days:** verify the API returns the new season; confirm the `yearData` entry (dates, theme, ranking stat name) from `first.global/archive/fgc-<year>/`.
2. **T−7 days:** capture the season's per-field stream playlist URLs (unlisted — capture before the event).
3. **T−1 day:** start the poller in `live` mode; confirm it detects the empty season and idles.
4. **During:** monitor poll success rate and publish latency. Target end-to-end lag ≤ 60 s.
5. **T+0 (after finals):** verify all matches are `played`, all details backfilled.
6. **T+1 day:** run `freeze` mode → emit static archive → commit → redeploy Pages.
7. **T+2 days:** stop the poller. The site is now fully static until next year.

---

## 8. Open questions

1. **Where does the live store live?** Supabase vs Cloudflare R2 vs Supabase Storage public bucket. See [05 §4.2](05-storage-and-distribution.md#42-live-store-options).
2. **Should clients poll the store, or should the store push to a CDN?** Leaning CDN-cached GET.
3. **How many viewers are realistic?** FGC's audience is global but modest. Sizing for ~1,000 concurrent is likely generous; sizing for 100 is probably realistic. This affects the store choice more than the topology.
4. **Does the upstream API have a maintenance window that coincides with events?** Unknown — hence the mandatory stale-serving path.
