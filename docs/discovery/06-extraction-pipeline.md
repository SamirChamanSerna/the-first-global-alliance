# 06 — Extraction Pipeline

> The Docker service that turns `api.first.global` into our normalized archive and live overlay. Runs on the owner's personal server; publishes to a public store.

---

## 1. Design principles

1. **Three modes, one codebase.** `backfill`, `live`, `freeze`. Same normalization code throughout — the modes differ only in when they run and what they emit.
2. **Idempotent by construction.** The same upstream input must always produce byte-identical output. Re-running any mode must be a no-op. This is what makes reruns safe during a live event.
3. **Stateless between runs** (except a small cursor). State lives in the published artifacts, not in the process. A crashed or restarted container resumes cleanly.
4. **Fail closed on unknown shapes.** If the upstream payload does not match expectations, **do not publish**. Keep serving the last-good artifact and alert. Silently publishing a partial or misparsed season is the worst possible failure.
5. **Preserve raw, publish normalized.** Always store the untouched upstream response alongside the normalized result, so discrepancies can be audited and reported by users ([07](07-user-content-and-moderation.md)).

---

## 2. Modes

### 2.1 `backfill` — one-time historical import

```
for year in [2017, 2018, 2019, 2022, 2023, 2024, 2025]:
    fetch /v1?year=<year>&excludeMatchDetails=true     → 7 requests total
    for each match with played=true:
        fetch /v1/matches?year=<year>&tournamentKey=&id=  → details
fetch /v1/teams                                          → registry
fetch /v1/teams?year=<year>   (per year)                 → rosters
```

Total: **~7 + ~1,100 + 8 ≈ 1,115 requests**, run **once**, then never again. Historical seasons never change, so the output is committed and frozen.

> Politeness: run this once, not on a schedule. Add a small delay between detail fetches; there is no deadline.

### 2.2 `live` — during an event

Long-running service. Polls on the schedule in [04 §4.1](04-live-event-architecture.md#41-polling-schedule):

```
loop:
    if no event active:  sleep 300s; continue
    if outside match window: sleep 300s; continue
    if within ±3.5 min of a scheduledTime: sleep 20s
    else: sleep 60s

    bundle = GET /v1?year=<current>&excludeMatchDetails=true
    validate_shape(bundle)            # abort+alert on mismatch
    if content_hash(bundle) == last_hash: continue
    newly_played = matches where played became true
    for m in newly_played:
        details[m] = GET /v1/matches?year=&tournamentKey=&id=
    publish live.json
```

Publishes the small live overlay ([04 §4.4](04-live-event-architecture.md#44-client-payload)) plus incrementally-updated season files.

### 2.3 `freeze` — after the event

Run once, the day after finals:

1. Fetch the season bundle one final time.
2. Backfill any match details still missing.
3. Run full validation (see §5).
4. Compute all derived metrics — lifetime aggregates, medal table, ratings.
5. Emit the complete static archive under `data/v<N>/`.
6. Bump `data_version` in `manifest.json`.
7. Leave the artifacts for a human to review and commit.

After `freeze`, the live store can be emptied and the poller stopped. The site is fully static until the next event.

---

## 3. Pipeline stages

```
  fetch → validate → normalize → enrich → aggregate → emit
```

### 3.1 fetch
HTTP with a descriptive `User-Agent`, 15 s timeout, 3 retries with exponential backoff. Store the raw response body verbatim.

### 3.2 validate
Checks before any publishing:
- Top-level keys all present.
- Array lengths within a sane range versus the previous run (e.g. matches must not drop by >20% mid-event — that indicates a truncated response, not a correction).
- Every `teamKey` in a match participant resolves to a team.
- Every match has exactly 6 participants (excluding known edge cases).

### 3.3 normalize
Applies the rules in [02 §3](02-data-model.md#3-normalization-rules):
- `countryCode` → uppercase, trimmed.
- `teamKey` → our stable `team_id` via the season's key map.
- `eventKey` → derive `season` integer.
- Match `id` + `tournamentKey` → composite `match_id`.
- Union the team registry so continental/refugee entities missing from `/v1/teams` are included.

### 3.4 enrich
Apply the **season adapter** ([02 §4](02-data-model.md#4-season-adapter-strategy)) to map raw `details` into the normalized component vocabulary, and attach per-robot values to the correct team via station → slot mapping.

### 3.5 aggregate
Compute derived outputs:
- Per-team lifetime aggregates → `data/teams/<id>.json`
- Medal table
- Per-season standings
- Ratings (Bradley-Terry; optionally CCWM) with uncertainty intervals

> ⚠️ Aggregation must respect coverage rules: no win-rate for 2017–2018 or 2022 (2019's is valid, from rankings), no `highest_score` for 2018/2019, no matches at all for 2017–2019/2022 ([02 §5](02-data-model.md#5-data-quality-rules), [10](10-historical-reconstruction.md)).

### 3.6 emit
Write files deterministically (sorted keys, stable ordering, fixed float formatting) so that unchanged input produces unchanged bytes and git shows no diff.

---

## 4. Runtime shape

A single small container. Suggested responsibilities:

| Command | Purpose |
|---|---|
| `run --mode=backfill` | One-shot historical import |
| `run --mode=live` | Long-running event poller |
| `run --mode=freeze --year=2026` | One-shot post-event archive generation |
| `verify` | Validate existing artifacts without fetching |

**Scheduling:** `backfill` and `freeze` are manual/one-shot — never on a cron, because running them accidentally is either wasteful or harmful. Only `live` is long-running, and it should be **started deliberately before an event and stopped after**.

This matters for the year-over-year cycle: between events, **nothing runs at all**. There is no always-on service to maintain, patch, or pay for.

**Bootstrap:** `backfill` needs the network once; after that the archive is local. The container needs no database, no message queue, and no persistent volume beyond an output directory.

---

## 5. Validation report

`freeze` should produce a human-reviewable report before anything is published:

```
=== FGC 2026 freeze validation ===
season 2026 · generated 2026-10-11T09:14:22Z

matches         381   expected ~380      OK
  played        381   (100%)             OK
  details       381   (100%)             OK
ranking rows    181                      OK
alliances        8 rr / 3 finals         OK
awards           19                      OK
participants   2286   (381 × 6)          OK
  unresolved teamKey refs   0            OK
  no_show rows              4            note: excluded from aggregates

teams: 191 in season, 207 all-time, 7 legacy continental
files: 40 emitted → data/v5/

WARNINGS
  - 2 matches missing startTime (expected; upstream leaves this empty)
  - team 'gm' (Gambia) has 11 matches, expected 12  ← REVIEW

DIFF vs 2025
  - awards: 19 (2025) → 19 (2026)
  - new teams: 0
```

**Nothing is committed until a human reads this.** This is the single highest-value safety mechanism in the pipeline, because it is the only thing standing between an upstream data glitch and a wrong statistic on the public site.

---

## 6. Error handling

| Condition | Action |
|---|---|
| HTTP 4xx (other than transient) | Alert; do not publish; do not retry indefinitely |
| HTTP 5xx / timeout | Retry ×3 with backoff; keep last-good |
| Shape validation failure | **Abort; do not publish**; alert |
| Array length regression | Abort; alert — likely a truncated response |
| Unresolved team reference | Abort; alert — indicates a registry gap |
| Detail fetch fails for one match | Skip that match's details; leave `details: null`; retry next cycle. Do not block the whole publish. |
| Publish to store fails | Retry; keep local copy; alert after N failures |

**Alerting:** a push notification or webhook to the owner is enough. A silent failure during a live event is the scenario worth designing against.

---

## 7. Idempotency & change detection

```
hash(state) where state = {
  matches:  [(id, played, redScore, blueScore, result)],
  rankings: [(teamKey, rank, wins, losses, rankingScore)],
}
```

- Hash unchanged → no publish, no store write, no commit.
- Hash changed → publish; the diff tells us exactly what changed.

This keeps store writes (a billed resource on some free tiers) proportional to *real* changes rather than to poll count. During a quiet period it drops to zero.

---

## 8. Year-over-year resumption

The pipeline is designed so that resuming after a year off requires only:

1. Merge the new season into the supported-years list.
2. Add a season adapter if the game's `details` vocabulary is new (it always will be — see [02 §4](02-data-model.md#4-season-adapter-strategy)).
3. Hand-update `seasons.json` from `first.global/archive/fgc-<year>/`.
4. Capture the season's stream playlist URLs (unlisted — capture early).
5. Run `backfill --year=<new>` → `live` during the event → `freeze` after.

No infrastructure changes are expected between years. Full procedure in [09](09-annual-runbook-and-risks.md).

---

## 9. Open questions

1. **Language/runtime for the poller.** Node is the natural choice (matches the frontend, native `fetch`, and the existing Node 24 toolchain on the dev machine); Python is equally viable. Deferred to the build phase.
2. **Whether `freeze` should open a pull request automatically** rather than leaving files for manual commit. A PR is reviewable and keeps the human in the loop — likely yes.
3. **Retention of raw upstream responses.** Storing every poll's full response during an event would be ~1.5 GB. Recommend storing only the raw response at first-fetch and at freeze, plus a diff log — not every poll.
4. **Whether to accept the 620 KB poll or find a finer-grained live endpoint.** None exists today; the two-tier strategy in [04 §4.2](04-live-event-architecture.md#42-two-tier-fetching-the-key-efficiency-win) is the mitigation.
