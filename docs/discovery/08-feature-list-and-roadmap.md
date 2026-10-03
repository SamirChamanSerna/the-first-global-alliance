# 08 — Feature List & Roadmap

> ⚠️ **SUPERSEDED — 2026-10-03.** The phase ordering below has been re-cut. **Use [`../plan/04-roadmap.md`](../plan/04-roadmap.md) and [`../plan/05-backlog.md`](../plan/05-backlog.md) instead.**
>
> This document remains useful as the **complete feature inventory** — it is the only place every candidate feature, including the ones deliberately deferred, is described with a difficulty rating. Read it to understand the *space of possibilities*; read the plan to know what is actually being built and in what order.
>
> Key differences from the current plan: phases 3 (user content) and most of 4 (analytics) are deferred; the hosting default moved from GitHub Pages to Cloudflare Pages; and a static site generator with generic templates was adopted, which this document does not describe.

> Every candidate feature, with an honest difficulty rating and a suggested build order.
> **Difficulty** measures *apparent effort and risk*, not importance. **★** marks the highest value-per-effort items.

---

## Difficulty scale

| Rating | Meaning |
|---|---|
| 🟢 **Easy** | Hours. Well-understood, no unknowns. |
| 🟡 **Medium** | Days. Some design work, but no research risk. |
| 🔴 **Hard** | Weeks, or a real technical unknown. |
| ⚫ **Very Hard** | Research-grade, fragile across years, or depends on external cooperation. |

---

## Phase 0 — Data foundation

*Prerequisite for everything. Nothing user-facing ships until this is solid.*

| # | Feature | Difficulty | Notes |
|---|---|---|---|
| 0.1 | API client for `api.first.global` (rate-limited, retrying, descriptive UA) | 🟢 | [06](06-extraction-pipeline.md) |
| 0.2 | Backfill historical seasons 2017–2025 | 🟢 | ~1,100 requests, once |
| 0.3 | Normalization layer (countryCode, teamKey→team_id, eventKey→season) | 🟡 | **The `teamKey` trap** — [02 §1](02-data-model.md#1-the-central-problem) |
| 0.4 | Team registry as union (fixes the continental-team gap) | 🟡 | [02 §3.2](02-data-model.md#32-the-continental-team-registry-gap) |
| 0.5 | Per-season adapters (`fgc2023/24/25/26`, `legacy`) | 🟡 | One per game; unavoidable |
| 0.6 | Deterministic emit (byte-stable output → clean diffs) | 🟢 | Enables idempotency |
| 0.7 | Validation + freeze report | 🟡 | Highest-value safety net |
| 0.8 | `seasons.json` metadata (hand-maintained from archive pages) | 🟢 | 8 rows |
| 0.9 | Docker packaging + three run modes | 🟢 | |

**Phase 0 total: ~1–2 weeks.** Highest risk item is 0.3–0.5 (normalization + adapters); everything else is mechanical.

---

## Phase 1 — Static archive site

*The core product. Fully static, works forever with no services running.*

| # | Feature | Difficulty | Notes |
|---|---|---|---|
| 1.1 | Home — seasons index, event cards | 🟢 | |
| 1.2 | Season page — standings, matches, alliances, awards | 🟡 | |
| 1.3 | Match page — teams, scores, normalized breakdown | 🟡 | |
| 1.4 | Team page — profile + per-season history | 🟡 | |
| 1.5 | ★ **Team lifetime page** | 🟡 | The differentiator. [03 §5](03-metrics-catalog.md#5-the-lifetime-team-page) |
| 1.6 | Search (team, season) | 🟢 | 215 teams — a static index is enough |
| 1.7 | ★ **All-time medal table** | 🟢 | Complete 2017–2025 coverage; cheap and compelling |
| 1.8 | Head-to-head team comparison | 🟡 | 2022–2025 only |
| 1.9 | Coverage/limitation notices on every affected view | 🟢 | **Non-negotiable** — see [02 §5](02-data-model.md#5-data-quality-rules) |
| 1.10 | Design system (colors, type, spacing, dark mode) | 🟡 | Must not look AI-generated — see §Design below |
| 1.11 | Charts (rank trend, distributions) | 🟡 | Lightweight, inline SVG or a small lib |
| 1.12 | Responsive layout, ≤16 px gutters, no horizontal scroll | 🟢 | |
| 1.13 | SEO: static pages, OpenGraph cards | 🟡 | Static hosting-friendly |
| 1.14 | Deploy pipeline → GitHub Pages | 🟢 | |

**Phase 1 total: ~2–3 weeks.**

> **1.5 and 1.7 are the flagships.** The medal table is the only all-time-complete view; the lifetime page is what makes a team page worth returning to.

---

## Phase 2 — Live event

*Only needed ~1 week per year.*

| # | Feature | Difficulty | Notes |
|---|---|---|---|
| 2.1 | Live poller (schedule-driven cadence) | 🟡 | [04 §4.1](04-live-event-architecture.md#41-polling-schedule) |
| 2.2 | Two-tier fetch (bundle + per-match details) | 🟡 | The efficiency win |
| 2.3 | Change detection / content hashing | 🟢 | |
| 2.4 | Live overlay publish (`live.json`) | 🟡 | Target < 40 KB |
| 2.5 | Live standings + recent matches UI | 🟡 | |
| 2.6 | Derived "is live" indicator (±3.5 min heuristic) | 🟢 | Mirror upstream |
| 2.7 | Stream links per field (main + fields 1–5) | 🟢 | Capture playlists early — unlisted |
| 2.8 | Stale-data banner + graceful degradation | 🟢 | [04 §5](04-live-event-architecture.md#5-failure-and-degradation) |
| 2.9 | Upcoming-match schedule per team | 🟢 | |
| 2.10 | Alerting on poll failure / shape change | 🟢 | |
| 2.11 | `freeze` mode → static archive | 🟡 | The annual handoff |

**Phase 2 total: ~1–2 weeks.** Low technical risk; the operational discipline matters more than the code.

---

## Phase 3 — User content

| # | Feature | Difficulty | Notes |
|---|---|---|---|
| 3.1 | Supabase project + schema + RLS | 🟡 | [07 §3](07-user-content-and-moderation.md#3-proposed-schema-supabase) |
| 3.2 | Auth (OAuth, anonymous read) | 🟢 | |
| 3.3 | Video link submission + oEmbed validation | 🟡 | |
| 3.4 | Admin moderation queue | 🟡 | |
| 3.5 | Corrections: submit + review + batched apply | 🟡 | Batch apply matters — [07 §7](07-user-content-and-moderation.md#7-correction-submission-flow) |
| 3.6 | Audit log | 🟢 | |
| 3.7 | Rate limiting / anti-abuse | 🟢 | |
| 3.8 | ★ **Video timestamps** — field-level approximate links | 🟢 | Ships value immediately, honestly labelled |
| 3.9 | **Video timestamps** — crowdsourced (match, mm:ss) | 🟡 | Needs an engaged audience |
| 3.10 | **Video timestamps** — OCR auto-segmentation | ⚫ | ~90 min CPU/event, but fragile & per-year tuning. [07 §5.4](07-user-content-and-moderation.md#54-recommended-sequence) |
| 3.11 | Robot photo uploads | 🔴 | Deferred. Check `first.global` coverage first |
| 3.12 | Image pipeline (resize, WebP, thumbnails) | 🔴 | Only if 3.11 happens |

**Phase 3 total: ~2 weeks for 3.1–3.9; 3.10–3.12 are open-ended.**

> Ship **3.8** early. An approximate deep link into the right 10-hour VOD is dramatically better than FGC's current state (nothing), costs almost nothing, and is honest about its precision.

---

## Phase 4 — Analytics

| # | Feature | Difficulty | Notes |
|---|---|---|---|
| 4.1 | Career W-L-T, win rate (with coverage labels) | 🟢 | 2022–2025 |
| 4.2 | Per-season rank & rank-percentile trends | 🟡 | The safest cross-season chart — [03 §6](03-metrics-catalog.md#6-cross-season-comparability) |
| 4.3 | Awards breakdown by class, per team & per country | 🟢 | |
| 4.4 | Bradley-Terry strength rating + uncertainty | 🔴 | ~12 matches/team → intervals mandatory |
| 4.5 | CCWM (margin-based) | 🟡 | Approximate due to coop-phase contamination — [03 §2.3](03-metrics-catalog.md#23-the-score-contamination-problem) |
| 4.6 | Monte Carlo ranking prediction | 🔴 | Fun; low accuracy at this sample size |
| 4.7 | OPR | 🟡 | Contaminated; publish only with heavy caveats, if at all |
| 4.8 | Component metrics from `details` | 🔴 | Per-season only; not cross-year comparable |
| 4.9 | Event simulator | 🔴 | Needs 4.4 solid first |
| 4.10 | Season "wrapped" recap | 🟡 | High shareability, low risk |

**Phase 4 total: ~2 weeks for 4.1–4.5; 4.6–4.9 are optional.**

> ⚠️ **Deliberately excluded: EPA.** A single-weekend season with ~12 matches per team gives EPA's recursive update too little to converge on, and its week-1 normalization assumes a multi-week structure FGC does not have. Revisit only after 4.4 exists with proper uncertainty quantification.

---

## Phase 5 — Platform & polish

| # | Feature | Difficulty | Notes |
|---|---|---|---|
| 5.1 | i18n infrastructure (string files, locale switcher) | 🟡 | Design keys day one, build switcher later |
| 5.2 | Spanish translation (highest-value second locale) | 🟢 | Large FGC audience |
| 5.3 | Additional locales (French, Arabic, Portuguese) | 🟢 | FGC publishes in these; note RTL for Arabic |
| 5.4 | Public read-only JSON API | 🟡 | Cheap once the archive exists |
| 5.5 | OpenAPI spec + docs page | 🟡 | |
| 5.6 | Data versioning + changelog of corrections | 🟡 | |
| 5.7 | Accessibility pass (WCAG AA) | 🟢 | |
| 5.8 | Performance budget enforcement in CI | 🟢 | |
| 5.9 | Dark mode | 🟢 | |

**Phase 5 total: ~1–2 weeks.**

---

## Design direction

The brief is explicit: modern, but **not AI-looking**, visually adjacent to The Blue Alliance.

Concrete guidance:

| Do | Don't |
|---|---|
| Dense, information-first tables — the TBA register | Full-screen hero sections with a single number |
| One restrained accent color; league-appropriate palette | Purple→blue gradients |
| Real data as the visual interest | Decorative illustrations, emoji as iconography |
| Tabular numerals for all statistics | Proportional digits in tables |
| Charts modeled on Statbotics: clean axes, no chartjunk, direct labels | 3D effects, drop shadows on data marks |
| Team identity via flags and country codes | Generic avatar circles |
| Density that respects the power user | Oversized padding everywhere |

**Reference palette** (community-derived, from TBA-adjacent sources — not official): `#3b8bba`, `#4eb3c1`, `#6ae2c2`, `#f5c400`, `#f29a26`; team avatar blue `#4487da` / red `#cd2626`.

The aesthetic target is a serious reference database that happens to look contemporary — not a marketing site.

---

## Suggested build order

```
Phase 0  ──►  Phase 1  ──►  Phase 2  ──►  Phase 3 (3.1–3.9)  ──►  Phase 4  ──►  Phase 5
pipeline      archive       live          UGC                       analytics     polish
1–2 wk        2–3 wk        1–2 wk        2 wk                      2 wk          1–2 wk
```

**Two natural checkpoints:**

1. **After Phase 1** — the historical archive is live and permanently useful. This alone fulfils the core brief and can ship even if nothing else follows.
2. **After Phase 2** — the platform is fully capable of covering an event end-to-end, which is the year-over-year cycle.

**If time is short,** cut in this order: Phase 4 §4.6–4.9 → Phase 3 §3.11–3.12 → Phase 5 → Phase 4 §4.4–4.5. **Never cut Phase 0.7 (validation) or 1.9 (coverage notices)** — those are what keep the published data trustworthy.

---

## Deliberately excluded

| Feature | Why |
|---|---|
| User accounts for browsing | Friction with no benefit; only submission needs auth |
| EPA | Insufficient sample size per season ([03 §2.5](03-metrics-catalog.md#25-sample-size-reality-check)) |
| Real-time websockets | No push upstream; polling is strictly simpler ([04 §6](04-live-event-architecture.md#6-why-not-supabase-realtime--websockets)) |
| Comments / forums | Moderation burden far exceeds value; TBA has none |
| Fantasy / prediction games | Out of scope for the brief |
| Native mobile app | A responsive static site satisfies "any device" |
