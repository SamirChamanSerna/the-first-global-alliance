# 03 — Metrics Catalog

> 🕓 **Computed analytics are DEFERRED — not in the MVP.** The MVP renders only what the upstream data states: rank, record, medals, scores and awards. §7's priority table describes a later phase.
>
> **§5.3 (the lifetime page layout) is current** — it is the specification for the Team History page in [`../plan/03-pages.md §3.4`](../plan/03-pages.md). **§6 (cross-season comparability) is a binding rule now**, not later: no arithmetic may cross a season boundary.
>
> **§2.5 is the reason analytics are deferred, and it is not a scheduling decision:** ~12 matches per team per season means every rating — Elo, EPA, Bradley-Terry — is highly uncertain, and publishing a point estimate without an interval would be misleading. When this phase is built, note that the owner proposes normalizing on **"first N matches played"** rather than Statbotics' week 1, since FGC has no weeks; that is a better fit and should be used.

> What The Blue Alliance and Statbotics compute, which of it transfers to the FIRST Global Challenge, and what the "lifetime" team page should show.

---

## 1. Reference metric sets

### 1.1 The Blue Alliance

| Metric | Definition | Method |
|---|---|---|
| **OPR** (Offensive Power Rating) | Each team's average point contribution to its alliance's score | Least-squares: solve `A·x = b` where `A` is the match×team incidence matrix and `b` are alliance scores |
| **DPR** (Defensive Power Rating) | Each team's average contribution to *opponent* score | Same, with opponent scores as `b` |
| **CCWM** (Calculated Contribution to Winning Margin) | Contribution to the score margin | Least-squares on `(own score − opponent score)` |
| **COPRs** | Component OPRs, one per scoring element in the year's `score_breakdown` | OPR applied per component |
| **Insights v1 / v2** | Human-readable "what makes this team good" summaries | Heuristic over breakdowns |
| **Match prediction** | Win probability + predicted score | Bayesian MMSE ridge regression |
| **Ranking prediction** | Simulated final standings | 1000× Monte Carlo |

OPR's known weakness: it is a **pure average** that weights every match equally regardless of opponent strength or recency, and it absorbs schedule strength into the rating.

### 1.2 Statbotics — EPA

EPA is an **Elo-style recursive estimator expressed in points**, designed to fix OPR's inability to predict:

- Team starts at a prior rating; the alliance's rating is the sum of its teams'.
- Predicted margin `= 0.004 × (rating difference)`.
- After each match, ratings are corrected proportionally to the prediction error.
- `K = 12` for qualification matches, `K = 3` for playoffs — playoffs move the rating less.
- Ratings are **standardized by dividing by the standard deviation of week-1 scores**, since each year is a new game.
- A **unitless EPA** (Elo-like, ~1500 average) is maintained separately for cross-season comparison.

Statbotics additionally computes **component EPAs**, **RP EPAs**, and **Strength of Schedule** (as ΔRank / ΔEPA / ΔRP percentiles), plus event simulation.

**Neither platform's metrics exist for FGC today.** `results.first.global` renders only Rank, Ranking Score, Highest Score, Matches Played, Next Match, and Awards — **no analytics at all**. FIRST Global has an internal stats engine (see [01 §9](01-data-sources.md#9-the-unexposed-internal-stats-engine)), but it is not published.

---

## 2. Why the FRC model does NOT transfer directly

Three structural differences make blind porting wrong.

### 2.1 No phase decomposition

FRC and FTC score in **autonomous / teleop / endgame** periods, and `score_breakdown` reflects that. **FGC has no such split in any season** — verified across 2023, 2024, 2025. Component metrics must therefore be built from **season-specific scoring elements**, one model per game. There is no universal component taxonomy, and cross-season component charts are impossible.

### 2.2 Six teams per match, in two phases

An FGC match has **six teams**, not four or six in two fixed alliances:

- **Global Alliance phase** — all six teams cooperate toward a shared objective.
- **Regional Alliance phase** — the six split into **two 3-team alliances** (red and blue) that compete.

The published `redScore` / `blueScore` are **final combined scores spanning both phases**.

### 2.3 The score-contamination problem

This is the most important modeling issue in the project and it has no clean upstream solution.

Because `redScore` includes points earned during the **cooperative** Global Alliance phase, team ratings computed on raw scores are contaminated: they partly measure *"how good were my five co-participants"* rather than *"how good is this team."*

In FRC, OPR's linearity assumption holds because an alliance's score is the sum of its own three teams' contributions. Here it does not hold, because part of the score was produced jointly by all six teams.

Worse, the cooperative contribution does **not** simply cancel between red and blue. In the 2025 formula:

```
final = ((WaterConserved + EnergyConserved + FoodProduced) * BalanceMultiplier)
      + FoodSecured + Coopertition
```

The cooperative terms are scaled by a per-alliance `BalanceMultiplier` — and those multipliers differ (observed: `redProtectionMultiplier = 1.5`, `blueProtectionMultiplier = 2.125` in the same match). So identical cooperative play yields **different** point contributions on each side.

> **Consequence: neither raw-score OPR nor margin-based CCWM is theoretically clean for FGC.**

### 2.4 Recommended response

Ranked by robustness, not by ambition:

| Approach | Robustness | Rationale |
|---|---|---|
| **1. Outcome-based ratings** (Bradley-Terry / TrueSkill / Elo on win-loss only) | ★★★ | Immune to score contamination entirely. Uses only `result`, which is unambiguous. Best first metric. |
| **2. CCWM on score margin** | ★★ | The cooperative terms partially cancel in `redScore − blueScore`; the differing multipliers leave a residual bias, so treat as approximate. |
| **3. OPR on raw alliance score** | ★ | Most contaminated. Publish only alongside a clear caveat, if at all. |
| **4. Component OPR on `per_team` detail fields** | ★★ | Cleanest *per-team* signal where it exists (e.g. parking is attributed to a specific robot), but the vocabulary changes every season, so it is not comparable year to year. |

Note that FIRST Global's own internal engine carries **both** OPR (A1) and TrueSkill/Bradley-Terry (A15) — consistent with their analysts having hit the same wall.

> **Recommendation for v1:** ship **win-rate**, **rank**, and a **Bradley-Terry strength rating** computed per season. Add margin-based CCWM as a secondary, clearly-labelled approximate metric. Defer OPR to a "raw, interpret with care" section, or omit it.

### 2.5 Sample-size reality check

Each team plays roughly **12 ranking matches per season**. That is a very small sample. Any rating — Elo, EPA, Bradley-Terry — will be **highly uncertain**, and a season is essentially one weekend of data.

**Every rating must be published with an explicit uncertainty interval** (e.g. bootstrap confidence bounds), or it will mislead. This is not optional; with n≈12, point estimates alone are irresponsible.

Statbotics' `K=12`/`K=3` cadence and its week-1 standard-deviation normalization assume a multi-week season. FGC has **no weeks** — the entire season is ~3 days. The EPA update schedule should be re-derived, not copied.

---

## 3. Match and stage model for statistics

| Stage | `tournamentKey` | 2025 count | Used for |
|---|---|---|---|
| Ranking Matches | `t2` | 362 | Primary ratings input; the ranking standings |
| Round Robin | `t3` | 16 | Playoffs stage 1 |
| Finals | `t4` | 3 | Championship matches |

Every team plays ~12 ranking matches. Playoff participation is limited to the top teams, so playoff matches are **strongly selection-biased** — a team's playoff record is not a random sample of its strength.

> Include playoff matches with a **separate** rating or an explicit flag; do not pool them naively with ranking matches.

---

## 4. Component model

Since there is no phase concept, the component model is **per-season**. Adapters emit the normalized shape from [02 §4](02-data-model.md#normalized-component-vocabulary).

What generalizes across 2023–2026:

| Component | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|
| Per-robot positioning/endgame | `red{One,Two,Three}Proficiency` | `redRobot{One,Two,Three}Parked` | `redRobot{One,Two,Three}Parking` | `red/blueRobot{One,Two,Three}BraceState` |
| Coopertition | `coopertitionBonus` | `coopertition` | `coopertition` | `coopertition` |
| Alliance-level scoring | `redHydrogenPoints`, `redOxygenPoints`, `redAlignment` | `redResevoirConserved`, `redFoodProduced`, `redCw1–6`, `redEc1–6`, `fieldBalanced`, `foodSecured` | `barriersInRedMitigator`, `biodiversityUnits*`, `biodiversityDistributionFactor`, `*ProtectionMultiplier`, `allBarriersCleared` | `wildfireIn*`, `*ClimbMultiplier`, `*PartnerClimbPoints` |

**Only the per-robot positioning value generalizes** — and even that has been renamed three times. Everything else is season-scoped and should be rendered only on that season's pages, never charted across years.

---

## 5. The lifetime team page

Reference: [frc.agameserver.org/team/4400/lifetime](https://frc.agameserver.org/team/4400/lifetime).

### 5.1 Reference structure

| Section | Reference content |
|---|---|
| **Career Record** | All-time W-L-T and win rate |
| **Streaks & Highlights** | Consecutive wins, best season, longest playoff run |
| **Performance Trends** | Rates, Average Rank, Alliance Selections, EPA/OPR/DPR over time |
| **Historical Timeline** | Chronological markers: Event, Win, Finals, Award, Playoffs |
| **Year-by-Year Breakdown** | Table with columns: Year, Events, Playoffs, Finals, Event Wins, Playoff %, Record, Win Rate, Avg Rank, Alliance Selection, Awards |
| Filter | "Exclude offseason" toggle |
| Asynchronous load | Sections populate independently, with progress indicators and a cached-fallback banner |

### 5.2 FGC mapping — what is actually computable

FGC has **one event per year**, so the reference's Events/Playoffs/Finals/Wins columns collapse into per-season flags.

| Lifetime stat | Computable? | Source | Notes |
|---|---|---|---|
| Seasons participated | ✅ | rankings presence | |
| Matches played | ⚠️ | matches | 2023–2025 only. Recoverable for 2017–2019/2022 by video ([10](10-historical-reconstruction.md)) |
| Career W-L-T | ⚠️ | rankings, then matches | **2019 from rankings** (complete, consistent); **2023–2025 from matches**; **2017/2018 zeroed**; **2022 corrupt** |
| Career win rate | ⚠️ | derived | Same coverage; must state its denominator |
| Best / average rank | ✅ | rankings | **Available all years 2017–2025** |
| Ranking-score history | ✅ | rankings | Per-season axis only; scores not comparable across years |
| Playoff appearances | ✅ | `alliances_*` | 2022–2025 |
| Alliance role (captain / pick N) | ✅ | `alliances_*` | 2022–2025 |
| Awards & medals | ✅ | awards | **Available all years** — the richest complete history |
| Award counts by class | ✅ | awards | gold / silver / bronze / honorable mention |
| Head-to-head vs another team | ⚠️ | matches | 2022–2025 only |
| Longest win streak | ⚠️ | matches | ditto |
| Host/venue history | ✅ | our `seasons.json` | |
| Strength rating (BT) | ⚠️ | computed | Per-season only; ~12 matches each |
| OPR / EPA | ⚠️ | computed | Per-season only, with the §2.3 caveat |

### 5.3 Proposed lifetime page layout

```
┌─ Team header: flag, name, country, first season, seasons active
├─ Career Snapshot (tiles)
│    Seasons 9 · Matches 48 · W-L-T 27-21-0 · Win rate .563 · Medals 3
│    ⓘ "Match data available from 2022 onward"
├─ Medal Cabinet
│    Gold 2 · Silver 1 · Bronze 0 · Honorable 4   (2017–2025 complete)
├─ Performance Trend
│    Rank by season (line, 2017→2025)
│    Ranking-score by season (small multiples — separate axis per season)
├─ Historical Timeline
│    Markers per season: ▣ event · 🏆 win · ⚑ finals · ★ award · ◈ playoffs
├─ Year-by-Year Breakdown (table)
│    Year | Host | Matches | Record | Win% | Rank | Playoff | Role | Medals
└─ Season detail (expandable per row)
```

**Design rule:** sections whose data is incomplete must render a coverage notice rather than silently omitting seasons. A team page that shows "Win rate 56%" without saying it excludes 2017–2019 is misleading.

### 5.4 Cross-team ranking pages

Once lifetime aggregates exist, these become cheap and are high-value:

- All-time medal table (by country) — **complete 2017–2025 coverage**
- All-time win-rate leaders — 2022–2025 only, with a minimum-matches threshold
- Best single-season rank / highest score (per season)
- Most seasons participated
- Head-to-head matrix

The **medal table is the single best all-time view** because awards are the only statistic with uninterrupted coverage from 2017.

---

## 6. Cross-season comparability

**Rule: points never cross a season boundary.**

Every season introduces a new game with a new scale (2025 scores are on the order of 12–80; 2017 ranking scores were in the hundreds). Concrete guidance:

1. **Never aggregate raw scores across seasons.** No "total career points."
2. **Per-season normalization only.** If a cross-season chart is needed, normalize within season (z-score, or percentile within that season's field) and label the axis as a percentile.
3. **Rank is naturally comparable** — it is already normalized to field size. Plot rank, or rank percentile, for cross-season trends.
4. **Win rate is comparable** — but only across the seasons that have match data.
5. **Medals are comparable** — and complete.

> The safest cross-season visual is **rank percentile per season**, because it is scale-free, available for every year 2017–2025, and immune to the point-scale problem.

---

## 7. What v1 should ship

Prioritized by value ÷ effort:

| Priority | Metric | Effort | Notes |
|---|---|---|---|
| P0 | Career medal/award counts | Low | Complete 2017–2025 coverage |
| P0 | Per-season rank + rank change | Low | Complete coverage |
| P0 | Season roster, matches, alliances, awards (raw views) | Low | Direct rendering |
| P1 | Career W-L-T and win rate | Low | 2022–2025 only; needs coverage labelling |
| P1 | All-time medal table, head-to-head | Low | Derived from P0 |
| P1 | Year-by-year breakdown table | Low | Aggregation only |
| P2 | Rank-percentile trend chart | Medium | Needs charting layer |
| P2 | Bradley-Terry strength rating | Medium | ~12 matches → must publish intervals |
| P3 | CCWM (margin-based) | Medium | Approximate due to §2.3 |
| P3 | Monte Carlo ranking prediction | High | Fun, but low accuracy at n≈12 |
| P4 | OPR | Medium | Contaminated; publish only with caveats |
| P4 | Component metrics | High | Rebuild per season; not cross-year comparable |
| P4 | Event simulation | High | Requires a solid rating first |

**Deliberately excluded from v1:** EPA. With a single-weekend season and ~12 matches per team, EPA's recursive update has too little data to converge meaningfully, and its week-1 normalization assumes a multi-week structure that does not exist here. Revisit once a rating with proper uncertainty quantification is in place.
