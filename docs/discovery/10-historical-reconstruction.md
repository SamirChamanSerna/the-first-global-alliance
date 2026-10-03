# 10 — Historical Reconstruction

> 🕓 **DEFERRED — not in the MVP.** The MVP archives 2023–2025 competition data, all of which is complete upstream and needs no reconstruction. This document covers **2017, 2018, 2019 and 2022**, which the MVP includes for **awards and season summary only**, with no match data.
>
> Nothing here needs to be read to build the MVP. It becomes relevant when the owner obtains a dataset for the missing seasons, or decides to pursue video reconstruction.

> Four seasons of the FIRST Global Challenge have **no match-level data in the official API**. This document defines the gap precisely, establishes what can still be verified, and sets the strategy for recovering the missing matches.

---

## 1. The gap

| Season | `matches` from API | Rankings | Awards | What is missing |
|---|---|---|---|---|
| 2017 | **0** | 163 rows (W/L zeroed) | 10 | Every match |
| 2018 | **0** | 161 rows (W/L zeroed) | 21 | Every match |
| 2019 | **0** | 189 rows (**W/L complete**) | 18 | Every match |
| 2020 / 2021 | — | — | — | No competition was held |
| 2022 | **0** | 162 rows (**W/L corrupt**) | 19 | Every match + playoffs |
| 2023–2025 | full | full | full | — |

### The API is exhausted

This was verified directly, not assumed. Every plausible route returns nothing:

```
/v1/matches?year=2022&tournamentKey=t2&id=1   → 200, 0 rows
/v1/matches?year=2022&tournamentKey=t3&id=1   → 200, 0 rows
/v1/matches?year=2022&tournamentKey=t4&id=1   → 200, 0 rows
/v1/matches?year=2022                          → 200, 0 rows
/v1/matches?year=2022&id=1                     → 200, 0 rows
(same for 2017, 2018, 2019)

Searching the entire 2022 payload for the string "redScore" → NOT FOUND
```

There is also no `/v1/stats`, `/v1/events`, `/v1/schedule` (all 404). **No API route reconstructs these seasons.**

> A separate investigation into non-API archives (Wayback Machine, The Orange Alliance, PDFs, press coverage, community datasets) is reported in §3. If it surfaces a viable source, it takes precedence over video and this document's strategy changes accordingly.

---

## 2. What the official rankings DO give us

The gap is narrower than it first appears. The `rankings` arrays contain far more than standings:

| Season | `wins`/`losses`/`ties` | `highestScore` | `rankingScore` | Derivable |
|---|---|---|---|---|
| 2017 | **all zero** (0/163) | ✅ 163/163, range **56–155** | cumulative points, 237–716 | per-team max score |
| 2018 | **all zero** (0/161) | ❌ all zero | 0–16 | ≈ **2 × wins** (see §4.3) |
| 2019 | ✅ **complete** (189/189) | ❌ all zero | 0–18, `2·W + T` | **full W-L-T** |
| 2022 | ⚠️ **present but corrupt** | ✅ 162/162, range **137–549** | up to 23 346 | per-team max score |

**This is the key reframing:** only **2017 and 2018** are truly missing win/loss information. And each season carries at least a *partial* check on any reconstruction — except that 2018's is soft.

---

## 3. Cheaper sources — checked and pending

The governing principle: **never spend a week of video processing on data that exists in a spreadsheet.**

| Source | Status | Result |
|---|---|---|
| `api.first.global` — all routes | ✅ **Checked exhaustively** | Nothing for the four seasons |
| The Orange Alliance repo history (`first-global-results`) | ✅ Checked | No committed data files; the repo is a pure API frontend |
| Wayback Machine snapshots of prior results platforms | ⏳ Pending | |
| PDFs / press kits / event programs | ⏳ Pending | |
| National-team press coverage (multi-language) | ⏳ Pending | |
| Community datasets (GitHub, Kaggle, Zenodo) | ⏳ Pending | |
| Scoring-system vendor / EMS historical database | ⏳ Pending | |

> This section is completed with the outcome of that investigation. Findings are reported honestly whether or not they help — a negative result is still a result, and it is what justifies the video approach.

---

## 4. Validation oracles

Because the reconstruction is OCR-based and therefore fallible, every season needs an independent check. Three of the four have one.

### 4.1 2019 — hard oracle ✅

The only season with complete, internally consistent W-L-T. **849 W = 849 L, 6 T** — perfectly balanced. This makes 2019 the calibration target for the whole extractor.

### 4.2 Deriving the exact 2019 target

```
189 teams × 9 matches            = 1,701 team-slots
but  sum(W + L + T)              = 1,704     ← 3 rows disagree with `played`
    (AND, YEM, SKN each report played=9 but W+L+T=10)

1,704 slots ÷ 6 teams per match  =   284 matches exactly

  · 283 decided matches  → 849 W + 849 L = 1,698 slots
  ·   1 tied match       →                 6 T =     6 slots
                                          ─────────────
                                            1,704     ✓
```

**The extraction must produce: 284 matches, 189 teams, exactly 1 tied match, and a per-team W-L-T reproducing the official table.**

This is an end-to-end test, not a spot check. It simultaneously validates boundary detection (match count), participant identification (team coverage), and score reading (win/loss assignment).

### 4.3 2018 — soft oracle

2018's `rankingScore` follows the same rule that is **exact** in 2019 (`rs = 2·W + T`, verified 0/189 discrepancies). Applied to 2018 it yields a bounded, plausible distribution:

```
top of the table    8W-0L  (rs = 16)
bottom of the table 0W-8L  (rs = 0)
no derived win count exceeds `played`   ✓
```

**But it does not fully reconcile:** `sum(W) = 644` vs `sum(L) = 646` — a 2-unit imbalance that ties cannot explain (a tie shifts W and L equally). So 2018's rule is *approximately* right.

**Verdict: a soft oracle.** Good enough to catch a broken extraction (a random result would not land within ±1 win per team), **not** good enough to certify a good one. Flag any team whose extracted wins differ from `rs/2` by more than 1.

### 4.4 2017 and 2022 — `highestScore` oracle ✅

Both seasons publish a per-team maximum score, and neither has any match data to have derived it from:

```
2017: 163 teams, range  56–155
2022: 162 teams, range 137–549
```

**A correct extraction must reproduce every one of these maxima exactly.** This is a strong, per-team, independent check — and it validates the *score reading* specifically, which the 2019 W-L-T check does not (a wrong score can still yield the right winner).

### 4.5 Oracle summary

| Season | Oracle | Strength | What it validates |
|---|---|---|---|
| 2019 | W-L-T, 284 matches | **Hard** | boundaries + participants + winners |
| 2018 | `rs/2 ≈ wins` | Soft (±1) | winners, loosely |
| 2017 | `highestScore` × 163 | **Hard** | scores |
| 2022 | `highestScore` × 162 | **Hard** | scores |

---

## 5. The 2017 format anomaly

Slot arithmetic exposes something important:

| Season | Teams | Slots | ÷ 6 | Matches |
|---|---|---|---|---|
| 2017 | 163 | 1,304 | ❌ **217.33** | unknown |
| 2018 | 161 | 1,290 | ✅ 215.00 | **215** |
| 2019 | 189 | 1,704 | ✅ 284.00 | **284** |
| 2022 | 162 | 1,944 | ✅ 324.00 | **324** |

2018, 2019 and 2022 divide exactly by 6 — consistent with the six-team format FGC still uses today. **2017 does not.**

1,304 is divisible by 4 (326 matches) and by 8 (163). Two hypotheses:

1. **2017 used a different alliance size** (e.g. 4 teams per match).
2. **`played` is a nominal value** and some teams actually played 7 or 9 matches.

Either way: **do not assume six teams per match for 2017.** Its extraction model must confirm the format from the video before its validation arithmetic can be fixed. This is a concrete reason to treat 2017 as the last season, not the first.

---

## 6. The hard problem: identifying participants

This is the finding that most changes the design, and it is worth stating plainly.

In 2023–2025 the pattern is easy: read the **match number** off the overlay → look it up in `api.first.global` → get the teams and the score. The API holds the answer.

**In 2017, 2018, 2019 and 2022 there is nothing to look up.** No match number, no team assignment, no score. So the extraction must read from the video:

| What | Difficulty | Why |
|---|---|---|
| Match boundaries | Medium | Audio cues + overlay timer |
| **Which teams played** | **Hard** | Team names, codes, or flags — **and no reference to match against** |
| Final scores | Medium | Digits from a results graphic |

Audio can reliably tell you *that* a match started. **Audio can never tell you *which* match it is.** Identification requires reading on-screen identifiers, which is text or image recognition — a fundamentally harder problem than digit OCR.

> **The central risk of this project:** if the 2017–2019 broadcast does not show legible team identifiers, the video approach cannot produce a usable dataset. No amount of pipeline engineering works around it.
>
> **Mitigation:** since `highestScore` and (for 2019) W-L-T are known, a partial reconstruction is still possible even without perfect identification — but only if a meaningful fraction of matches can be tied to teams. The first implementation task is to confirm what the overlay actually shows ([11 §7](11-video-extraction-pipeline.md)).

---

## 7. Sizing

| Season | Matches | Teams | Priority | Notes |
|---|---|---|---|---|
| **2019** | **284** | 189 | **1 — pilot** | Hard oracle; per-field-free single-stream era |
| 2022 | 324 | 162 | 2 | Recovers matches **and** replaces corrupt W/L; `highestScore` oracle; modern per-field stream layout |
| 2017 | ~217 | 163 | 3 | `highestScore` oracle; **format unconfirmed** |
| 2018 | 215 | 161 | 4 | Soft oracle only — hardest to certify |
| **Total** | **~1,040** | | | |

**Compute is not the constraint.** At the measured rate of ~10–20 min per 10-hour VOD ([11 §5](11-video-extraction-pipeline.md)), the whole job is on the order of **3–5 hours of wall clock** on a personal server. **The constraints are YouTube rate-limiting and capturing the unlisted VOD URLs.**

---

## 8. Per-season strategy

### 2019 — calibrate

1. Acquire the day streams; confirm the video layout and overlay content.
2. Run the full pipeline; produce 284 matches.
3. **Compare against the hard oracle**: match count, team coverage, W-L-T per team, exactly 1 tie.
4. Use the result to tune OCR thresholds and the voting rules.
5. Publish only if it passes.

### 2022 — recover and replace

The API's W/L for 2022 is arithmetically impossible (835 vs 1109). Per the project decision, **that data is discarded and everything comes from video.** `rank` and `rankingScore` are *not* affected — they are derived from the season's own point system and are not corrupt — so standings still come from the API ([§9](#9-open-questions)).

Validate against `highestScore` (162 teams). Note this season has playoff stages (`round_robin`, `finals`) whose matches also need extraction.

### 2017 — confirm the format first

Determine the actual alliance size from the video before writing any validation arithmetic. Then validate against `highestScore` (163 teams, 56–155).

### 2018 — last, and least certain

No hard oracle. Validate with the soft `rs/2 ≈ wins` check (±1 tolerance) and accept a lower confidence bar, or deprioritize. Its marginal value is real (zero W/L today) but it is the one season that cannot be certified.

---

## 9. Open questions

1. **External archives** (§3) — pending. Could displace the video approach entirely.
2. **What does the 2017–2022 overlay actually show?** Determines feasibility of participant identification. Unresolvable from text sources; requires watching a VOD.
3. **Does 2022's playoff stage need extracting too?** `round_robin` (32 rows) and `finals` (12 rows) exist as standings with zeroed W/L. Their matches are part of the same streams.
4. **Should reconstructed standings replace the official `rank`?** Leaning no — `rank` and `rankingScore` are not corrupt and are not reliably derivable from video. Only *match-level* data is replaced.
5. **How is a partially-identified match handled?** If teams are readable but the score is not (or vice versa). Leaning: emit the match with a confidence below the publish threshold and hold it in a review queue rather than dropping it.
