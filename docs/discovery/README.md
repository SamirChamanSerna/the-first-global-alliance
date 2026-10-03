# Discovery — The First Global Alliance

> **Status:** Research complete. **The discovery phase is closed** — the documents below are the reference for *why* the project is shaped the way it is, and are not expected to change.
> **Scope:** Determine what data is automatically obtainable for the FIRST Global Challenge (FGC), what is computable from it, and what architecture would serve an archive + live event platform at ~$0 maintenance cost.
> **Date of research:** 2026-10-02

> ### ➜ The build plan lives in [`../plan/`](../plan/README.md)
>
> This directory is the **evidence**. It deliberately explores more than we will build: nine seasons of normalization, video reconstruction, OCR, user-generated content. The MVP is a deliberately smaller subset.
>
> | Read this | For this |
> |---|---|
> | [`../plan/README.md`](../plan/README.md) | Scope decisions (D1–D13) and what is in/out |
> | [`../plan/01-architecture.md`](../plan/01-architecture.md) | The data-origin contract and render model |
> | [`../plan/02-data-contract.md`](../plan/02-data-contract.md) | File layout and artifact shapes |
> | [`../plan/03-pages.md`](../plan/03-pages.md) | Every route and template |
> | [`../plan/04-roadmap.md`](../plan/04-roadmap.md) | Phases and estimates |
> | [`../plan/05-backlog.md`](../plan/05-backlog.md) | Issue-ready backlog |
>
> **Documents `10` and `11` describe deferred work** (historical reconstruction, video OCR) and are not MVP inputs. **Document `12` is the exception: it is architecturally binding** — the data contract in the plan implements it directly.

---

## 1. What this project is

A lightweight stats platform for the **FIRST Global Challenge** — conceptually a blend of:

| Reference | What we take from it |
|---|---|
| [The Blue Alliance](https://www.thebluealliance.com/) | Overall information architecture, team/event/match pages, user-submitted videos & robot photos with admin approval |
| [Statbotics](https://www.statbotics.io/) | Predictive analytics presentation (EPA), charts, event simulation |
| [frc.agameserver.org lifetime view](https://frc.agameserver.org/team/4400/lifetime) | The career/lifetime team page: Career Record, Streaks & Highlights, Performance Trends, Historical Timeline, Year-by-Year Breakdown |

**Hard constraints set by the project owner:**

- KISS, modular, easy to maintain, resumable year after year.
- All heavy computation runs locally in Docker; results are published to a public data store.
- Frontend is static (now **Cloudflare Pages**, see §6) — plain HTML/CSS/JS, no framework.
- Must be usable on any device and any connection speed.
- Near-$0 operating cost.
- Primary language English, but multi-language capable.
- Aesthetics: modern, deliberately *not* AI-looking; visually adjacent to The Blue Alliance.

---

## 2. Executive summary

**The single most important finding: no scraping is required.**

`results.first.global` is a thin frontend over a public, undocumented, unauthenticated REST API with wide-open CORS:

```
GET https://api.first.global/v1?year=YYYY&excludeMatchDetails=true
GET https://api.first.global/v1/matches?year=YYYY&tournamentKey=tN&id=N
GET https://api.first.global/v1/teams
GET https://api.first.global/v1/teams?year=YYYY
GET https://api.first.global/v1/alliances?year=YYYY&tournamentKey=tN
```

The official frontend is itself open source — [`the-orange-alliance/first-global-results`](https://github.com/the-orange-alliance/first-global-results) — and confirms it consumes this same API. However, **that repository is unlicensed** (no `LICENSE` file, `"private": true`), so its *code* must not be copied. The endpoints and payload shapes documented here are observable facts about a public API and are fine to build against.

### The seven findings that shape the design

| # | Finding | Consequence |
|---|---|---|
| 1 | **Scale is tiny.** 207 teams all-time, 1 event/year, ~380 matches/year. Every season 2017–2025 combined is **~1.5 MB**. | A 100% static JSON archive is viable. No database needed for historical data. |
| 2 | **`teamKey` is not a stable identity.** It is reassigned every season — `teamKey: 1` is "Team Europe" (2017), "Team Romania" (2018), "Team Israel" (2019), "Team Kazakhstan" (2022), "Afghanistan" (2023–2025). | **Join on normalized `countryCode`, never on `teamKey`.** See [02-data-model.md](02-data-model.md). |
| 3 | **Schema drift is severe.** The `details` scoring vocabulary is entirely different each year (13 keys in 2023, 37 in 2024, 20 in 2025). `eventKey` has two coexisting formats, and differs between `rankings` and `awards` within the same year. `countryCode` is uppercase in 2017–2022 and lowercase in 2023–2025. | Requires a per-season adapter layer. Do not build a single universal parser. |
| 4 | **Coverage gaps.** 2017–2019 have rankings + awards only (**no match data**). 2022 has round-robin/finals rankings and alliances but **no `matches` array**. 2020 and 2021 have no competition at all. There is no 2016 data. | Career win/loss stats cannot cover 2017, 2018 or 2022 (**2019's is complete in the rankings**). Every aggregate must state its denominator. See the recovery plan in [10](10-historical-reconstruction.md). |
| 5 | **Scores are not comparable across years.** Each game has a different point scale; there is also **no autonomous/teleop/endgame phase split** anywhere in the data. | OPR/EPA are meaningful **within a season only**. Lifetime metrics must be result-based (wins, rank, awards), not point-based. |
| 6 | **Latency target is easily met.** We would consume the same API the official platform consumes. | The 15–30 min lag requirement is trivially satisfiable; the real engineering problem is API politeness, redundancy, and derived-metric computation — not freshness. |
| 7 | **Official VODs are unlisted and per-field.** Since 2022 there are 5 fields × 3 days = **15 unlisted YouTube VODs per year**, with **no match→timestamp mapping published anywhere**. | The timecode problem is genuinely unsolved upstream and is the most expensive feature in this project. See [07-user-content-and-moderation.md](07-user-content-and-moderation.md). |

### Notable opportunity

FIRST Global **already has an internal statistics engine** (in a non-public `project-ems` codebase) with ~212 stat definitions including OPR, DPR, CCWM, EPA, TrueSkill/Bradley-Terry, Brier score, strength of schedule, and luck rating. **None of it is exposed through the API.**

The official results site itself renders only Rank, Ranking Score, Highest Score, Matches Played, Next Match, and Awards. **It publishes no computed analytics.**

→ Any OPR/EPA-style analytics for FGC would be **first-of-its-kind**. This is the strongest differentiator available to this project.

---

## 3. Documents in this directory

Two workstreams:

- **§1 — Platform & data foundation (`01`–`09`).** What the official API offers, the canonical data model, the metrics, and the architecture for serving an archive plus live events.
- **§2 — Historical recovery (`10`–`12`).** The four seasons the API never recorded, how to reconstruct them from broadcast video, and the normalization layer that merges everything into one shape.

| Doc | Contents |
|---|---|
| [01-data-sources.md](01-data-sources.md) | Full inventory of every data source: the API, the WordPress site, YouTube, flags. Verified endpoint behaviour, per-year coverage matrix, and an explicit "not available" list. |
| [02-data-model.md](02-data-model.md) | Proposed canonical model. The `teamKey` trap, key normalization, schema drift matrix, and the per-season adapter strategy. |
| [03-metrics-catalog.md](03-metrics-catalog.md) | TBA/Statbotics metric definitions, which are computable for FGC, why the phase model doesn't transfer, and the lifetime-page design. |
| [04-live-event-architecture.md](04-live-event-architecture.md) | Latency requirement, three candidate topologies, and the recommendation for live events. |
| [05-storage-and-distribution.md](05-storage-and-distribution.md) | Static JSON vs Supabase, file layout, bandwidth math, GitHub Pages limits, cost analysis. |
| [06-extraction-pipeline.md](06-extraction-pipeline.md) | Poller design, live/backfill/freeze modes, idempotency, scheduling, error handling. |
| [07-user-content-and-moderation.md](07-user-content-and-moderation.md) | User submissions (videos, robot photos, corrections), moderation, auth, and the video-timecode problem. |
| [08-feature-list-and-roadmap.md](08-feature-list-and-roadmap.md) | **Prioritized feature list with difficulty ratings** and suggested build order. |
| [09-annual-runbook-and-risks.md](09-annual-runbook-and-risks.md) | Year-over-year operating procedure, risks, open questions. |
| [10-historical-reconstruction.md](10-historical-reconstruction.md) | **Second workstream.** The four seasons with no API match data; validation oracles per season; the 2019 target (284 matches) derived exactly; the 2017 format anomaly; participant identification as the critical path. |
| [11-video-extraction-pipeline.md](11-video-extraction-pipeline.md) | The technical pipeline: yt-dlp constraints in 2026, audio boundary detection, targeted frame bursts, OCR and glyph templating, voting, oracle validation, measured compute budget, Docker packaging, prior art with licences. |
| [12-normalization-layer.md](12-normalization-layer.md) | The `raw/ → normalized/ → derived/` layer: lookup tables, normalization rules, **data-quality reporting** for upstream defects, byte-level determinism, internal provenance, and how video-sourced matches merge with API data. |

---

## 4. Glossary

| Term | Meaning |
|---|---|
| **FGC** | FIRST Global Challenge — an annual international robotics olympiad, one national team per country. |
| **Season / Year** | One annual event. The unit of archival. |
| **`tournamentKey`** | Stage within a season: `t2` = Ranking Matches, `t3` = Round Robin, `t4` = Finals. |
| **Global Alliance / Regional Alliance** | Within a single match, all 6 teams cooperate as the *Global Alliance* early on, then split into two 3-team *Regional Alliances* (red vs blue). |
| **`details`** | Per-match scoring breakdown. Its key vocabulary is **game-specific and changes every season**. |
| **Ranking Score** | The official season ranking metric (RP-style). Renamed each year (see §5). |
| **IAC code** | The internal country code system. Not ISO 3166 — continental teams use numeric codes (`10`–`14`). |
| **`teamKey`** | Per-season team identifier. **Not stable across years.** |
| **OPR / EPA** | Offensive Power Rating / Expected Points Added — predictive team strength ratings from FRC analytics. |

---

## 5. Per-season reference

| Year | Host | Game | Ranking stat name | `customRankingKey` | Match data? |
|---|---|---|---|---|---|
| 2017 | Washington, D.C., USA | (inaugural) | Cumulative Points | — | ✗ |
| 2018 | Mexico City, Mexico | (Energy Impact) | Parking Points | `parkingPoints` | ✗ |
| 2019 | Dubai, UAE | (Ocean Opportunity) | — | — | ✗ |
| 2020 | *(no competition)* | — | — | — | ✗ |
| 2021 | *(no competition)* | — | — | — | ✗ |
| 2022 | Geneva, Switzerland | (Carbon Capture) | Carbon Points | `carbonPoints` | partial¹ |
| 2023 | Singapore | (Hydrogen Horizons) | OxyHydro Points | `oxyHydroPoints` | ✓ |
| 2024 | Athens, Greece | (Feeding the Future) | Food Secured Points | `foodSecuredPoints` | ✓ |
| 2025 | Panama City, Panama | Eco Equilibrium | Protection Points | `protectionPoints` | ✓ |
| 2026 | Incheon, South Korea | Igniting Innovation | Climb Points | `climbPoints` | *(event 7–10 Oct 2026)* |

¹ 2022 has round-robin/finals rankings and alliance data but **no `matches` array**.

Sources: [`lib/data.ts`](https://github.com/the-orange-alliance/first-global-results/blob/main/lib/data.ts) in the official frontend, plus live API responses.

---

## 6. Decisions — resolved 2026-10-03

All five decisions below were open during research and are now **closed**. The full log, with rationale, is in [`../plan/README.md §2`](../plan/README.md#2-decisions-log). Do not reopen without adding a new entry there.

| # | Was open | Now |
|---|---|---|
| 1 | **UGC scope** → [07](07-user-content-and-moderation.md) | **None in the MVP.** No submissions, auth or moderation. Video links and image URLs are maintained by the owner directly in JSON. Deferred, not rejected. |
| 2 | **Live store** → [05](05-storage-and-distribution.md) | **Cloudflare R2**, a public object bucket. Not Supabase, not a relational DB, **not a Pages deploy** — a 60 s cadence is ~2,400 updates per event against a 500/month deploy limit. A DB becomes relevant only when UGC arrives. |
| 3 | **Video timecode strategy** → [07](07-user-content-and-moderation.md) | **Owner-maintained overlay now** (`data/videos/<year>.json`); crowdsourcing and OCR deferred. Field-level links ship from the start. |
| 4 | **Seek permission from FIRST Global** → [09](09-annual-runbook-and-risks.md) | **Still open, and should be done.** Outbound courtesy costs nothing and the risk register rates the alternatives highly. |
| 5 | **Hosting** → [05](05-storage-and-distribution.md) | **Cloudflare Pages.** Unlimited bandwidth and, decisively, real `_headers` support — GitHub Pages cannot set the immutable caching this archive depends on. |

### Decisions the research did not anticipate

| Decision | Resolution | Why it changed |
|---|---|---|
| **Season coverage** | Season summary + awards for **all** seasons 2017–2026; competition data for **2023–2025** only | Awards and season metadata are complete upstream for every year and cost almost nothing; match data is genuinely absent for four seasons. This keeps the medal table complete from 2017 while avoiding reconstruction. |
| **Live topology** | The live system is **a second origin serving the same artifact paths**, not a second site | Reuses the pipeline, the shapes and the page code. Only the destination and cadence change. |
| **Render model** | **Pre-rendered HTML at build time + client hydration for the active season** | A template is a pure string function, so the same module runs in Node and the browser — one implementation, real SEO, one request per page. |
| **Statistics** | Out of the MVP | ~12 matches per team per season; a point estimate without an uncertainty interval is misleading. |
| **Images** | Download, resize, commit. **No hotlinking, no third-party image host** | Hotlinking WordPress media is fragile; Imgur has no SLA and an anti-automation posture. |
