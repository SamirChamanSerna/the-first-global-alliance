# 12 — Normalization Layer

> ✅ **BINDING — the MVP implements this document directly.** Unlike `10` and `11`, this is not deferred work. The file layout, the identity registry, the key-derivation rules, the null and type discipline, the provenance fields and the determinism rules are all prerequisites for the MVP.
>
> [`../plan/02-data-contract.md`](../plan/02-data-contract.md) is the MVP's restatement of this document. Where the two disagree on a detail, the plan wins for what to build — but the reasoning here explains why each rule exists, and the video-facing lifecycle hooks (`source`, `confidence`, the shared match shape) must be implemented **now**, even though nothing populates them yet, so that docs `10` and `11` can be added later without a migration.

> A deterministic, fully rebuildable layer that turns inconsistent upstream data (and raw OCR output) into one clean, canonical shape — so the frontend and every calculation downstream can stop worrying about per-season quirks.

---

## 1. Why this layer exists

The upstream API is **internally inconsistent across seasons** ([02](02-data-model.md)). Everything downstream currently has to know that:

- `teamKey` is reassigned every season and is useless as an identity.
- `countryCode` is uppercase in 2017–2022, lowercase in 2023–2025, and uses numeric codes for continental teams.
- `eventKey` has two coexisting formats, and differs between `rankings` and `awards` within the same season.
- `details` has a completely different key vocabulary every year.
- `/v1` and `/v1/matches` return **different shapes for the same match** (`field` vs `fieldNumber`).
- Some seasons have no match data at all; one has corrupt aggregates.

If each page and each statistic handles those cases itself, the inconsistency spreads into every file and every bug is fixed in five places. **This layer isolates all of it in one place, applied once, deterministically.**

Two additional jobs it takes on:

1. **Merge video-reconstructed matches** ([10](10-historical-reconstruction.md), [11](11-video-extraction-pipeline.md)) into the same shape as API matches, so nothing downstream knows or cares where a record came from.
2. **Make data-quality problems visible.** The upstream data contains real defects — most notably the 2022 win/loss imbalance. The layer's job is to *surface* these in a report, never to silently smooth them over.

---

## 2. Architecture

Three layers, strictly one-directional. **`raw/` is immutable and is the only source of truth; everything above it is disposable and rebuildable.**

```
  ┌──────────────────────────────────────────────────────────────┐
  │  raw/            IMMUTABLE — never edited by hand            │
  │  verbatim API responses · verbatim OCR output                │
  └───────────────────────────┬──────────────────────────────────┘
                              │  + lookups/ (hand-curated)
                              ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  normalized/     CANONICAL — one shape for all seasons       │
  │  stable keys · consistent types · provenance tags            │
  └───────────────────────────┬──────────────────────────────────┘
                              ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  derived/        COMPUTED — what the frontend actually reads │
  │  lifetime aggregates · medal table · ratings · quality report│
  └──────────────────────────────────────────────────────────────┘
```

**The governing rule:** changing any normalization rule means **deleting `normalized/` and `derived/` and regenerating from `raw/`**. Nothing is ever hand-patched in the upper layers. This is what makes the pipeline auditable and keeps the correction process ([07 §7](07-user-content-and-moderation.md#7-correction-submission-flow)) honest.

### 2.1 Layout

```
raw/
  api/
    2025/season.json              # verbatim /v1?year=2025 response
    2025/matches/t2-1.json        # verbatim /v1/matches response
    teams.json                    # verbatim /v1/teams
    _fetch-log.json               # what was fetched, when, byte size, sha256
  video/
    2019/day2-field1/
      boundaries.json             # raw boundary detections
      ocr/*.json                  # raw OCR output per candidate frame
      _extract-log.json           # model/params versions used
  lookups/
    team-identity.json            # raw identifier -> stable team_id
    season.json                   # year -> metadata
    stage.json                    # tournamentKey -> stage
    award-class.json
    components/2025.json          # raw detail key -> normalized component
    components/legacy.json
    _schema-version.json

normalized/
  teams.json
  seasons/2025/{meta,matches,rankings,alliances,awards}.json
  seasons/2019/{...}.json         # same shape, sourced from video
  matches/2025/t2-1.json

derived/
  teams/<team_id>.json            # lifetime aggregates
  medal-table.json
  standings/<year>.json
  ratings/<year>.json
  quality-report.json             # ← the anomaly surface
  manifest.json                   # data_version, counts, hashes
```

---

## 3. Lookup tables

These are the "tablas de consulta": hand-curated, versioned, and the *only* place where mapping knowledge lives.

### 3.1 `team-identity.json` — the critical one

Maps **every raw identifier ever observed** to one stable `team_id`. This is what solves the `teamKey` trap and the registry gap in one move.

```jsonc
{
  "af": {
    "team_id": "af",
    "name": "Afghanistan",
    "display_name": "Team Afghanistan",
    "entity_type": "country",
    "iso2": "af", "iso3": "AFG",
    "aliases": {
      "country_code": ["af", "AF", "AFG"],   // every spelling seen upstream
      "name": ["Team Afghanistan", "Afghanistan"]
    },
    "first_season": 2023,
    "seasons_active": [2023, 2024, 2025],
    "notes": null
  },
  "10_hope": {
    "team_id": "10_hope",
    "name": "Team Hope (Refugees)",
    "entity_type": "refugee",
    "aliases": {
      "country_code": ["10_hope", "10"],       // ← registry vs 2017 season spelling
      "name": ["Team Hope (Refugees)", "Refugees"]
    },
    "first_season": 2017,
    "seasons_active": [2017],
    "notes": "Appears as '10' in 2017 season data but as '10_hope' in the all-time registry."
  },
  "14_europe": {
    "team_id": "14_europe",
    "name": "Team Europe",
    "entity_type": "continental",
    "aliases": { "country_code": ["14"], "name": ["Team Europe"] },
    "first_season": 2017,
    "seasons_active": [2017],
    "notes": "Continental team, 2017 only. Absent from the all-time /v1/teams registry."
  }
}
```

**Rules:**
- `team_id` is **ours** and never changes once assigned, even if the entity renames.
- The registry is the **union** of `/v1/teams` and every `countryCode` observed in any season — it is *not* just the 207 upstream entries ([02 §3.2](02-data-model.md#32-the-continental-team-registry-gap)).
- A raw code that resolves to nothing is a **hard error**, not a skip. It means a new entity appeared and the table needs a new entry.
- `teamKey` is deliberately **absent** from this table. It is a per-season participant number, stored only as `upstream_team_key` on the record for traceability ([02 §1](02-data-model.md#1-the-central-problem)).

### 3.2 Other tables

| Table | Maps | Notes |
|---|---|---|
| `season.json` | `year` → host city/country, dates, theme, game name, `ranking_stat_key`, `data_coverage`, `match_source` (`api` \| `video`) | Hand-maintained; the API has no event endpoint |
| `stage.json` | `t2` → ranking, `t3` → round_robin, `t4` → finals | Stable across seasons |
| `award-class.json` | raw class string → `gold` \| `silver` \| `bronze` \| `honorable_mention` | |
| `components/<year>.json` | that season's raw `details` keys → normalized component vocabulary | One file per game; `legacy.json` for seasons with no matches |

---

## 4. Normalization rules

Applied in order; each is independently testable.

### 4.1 Identity
```
countryCode  → trim → uppercase → team-identity lookup → team_id
matchKey     → `${year}:${tournamentKey}:${id}`          (id alone is per-tournament)
season       → derived from eventKey by extracting the 4-digit year
eventKey     → preserved as an attribute only; NEVER joined on
```

### 4.2 Shape unification
```
/v1 vs /v1/matches → both normalize to the canonical Match shape
  field | fieldNumber      → field
  played | result          → result enum (red|blue|tie|unplayed) + played bool
  absent details           → details: null  (never omitted, never {} )
```

### 4.3 Component mapping
Per-season adapters map raw `details` into the small normalized vocabulary ([02 §4](02-data-model.md#normalized-component-vocabulary)), with the untouched raw keys retained under `season_specific`. Per-robot values are attached to the correct team via `station → slot` ([01 §3.3](01-data-sources.md#33-participant)).

### 4.4 Types
```
counts    → integers
scores    → numbers, rounded to 6 decimal places
times     → { utc: ISO-8601Z, offset: "+05:00", local: ISO-8601 }
booleans  → true/false   (upstream mixes 0/1 and false/true)
nullables → explicit null, never missing keys
```

### 4.5 Merging video-sourced matches

For 2017, 2018, 2019 and 2022 the match array comes entirely from video ([10](10-historical-reconstruction.md)). The rules:

- Video matches take the **identical canonical shape** as API matches. Downstream code cannot tell them apart — which is the intended behaviour ([decision: merged without distinction](#8-decisions)).
- `source: "video"` and an `extraction` block (stream, VOD offset, frame refs, per-field confidence) **are** stored, for auditability. They are **not** rendered in the UI.
- Matches are emitted in a **deterministic order** (by stage, then `id`), regardless of the order OCR produced them.
- Where the API has an aggregate for a video-sourced season (2019's W-L-T, 2017/2022's `highestScore`), that value is **used as a validation oracle, never as input** — see [11 §6](11-video-extraction-pipeline.md).

---

## 5. The data-quality report

`derived/quality-report.json` is the layer's most valuable output. Its purpose is to make defects **impossible to overlook** rather than to hide them.

### 5.1 Structural checks (every season)

| Check | Severity |
|---|---|
| Every participant resolves to a `team_id` | error |
| Every match has exactly 6 participants | error |
| `sum(wins) == sum(losses)` across a season | error |
| `wins + losses + ties == played` per row | warn |
| No duplicate `(season, stage, team_id)` in standings | error |
| `max(match score)` per team ≤ that team's `highestScore` (where present) | warn |

### 5.2 Known defects it must report

These are **real, verified upstream defects**. The report exists to document them, not to fix them silently:

| Season | Defect | Detail |
|---|---|---|
| **2022** | **W/L imbalanced** | `sum(wins)=835` vs `sum(losses)=1109` — arithmetically impossible. Also `W+L+T != played` in **135 of 162** rows. |
| 2019 | 3 anomalous rows | `AND`, `YEM`, `SKN` report `played=9` but `W+L+T=10`. These 3 explain the entire 1701-vs-1704 slot discrepancy. |
| 2017 | Slot count not divisible by 6 | 1 304 slots ÷ 6 = 217.33 → the season cannot have used 6-team matches consistently. Format unconfirmed. |
| 2017 | `wins`/`losses`/`ties` all zero | Only 2019 and 2022 populate them. |
| 2018 | `highestScore` all zero | Also zero in 2019. |
| 2017–2019, 2022 | No `matches` from API | By design; supplied by video. |

### 5.3 Example output

```jsonc
{
  "generated_from": "raw@sha256:…",
  "seasons": {
    "2022": {
      "status": "defective",
      "issues": [
        { "severity": "error", "code": "WINS_LOSSES_IMBALANCE",
          "detail": "sum(wins)=835 sum(losses)=1109 delta=-274",
          "action": "API win/loss discarded for this season; using video extraction." },
        { "severity": "error", "code": "WLTT_NE_PLAYED",
          "detail": "135/162 rows", "action": "reported, not corrected" }
      ]
    },
    "2019": {
      "status": "ok_with_notes",
      "issues": [
        { "severity": "warn", "code": "ANOMALOUS_ROWS", "detail": "AND, YEM, SKN",
          "action": "retained as-is; used as soft oracle only" }
      ]
    }
  }
}
```

**The report is generated, never hand-written**, and a regression (a new error appearing on a season that was previously clean) should **fail the build**.

---

## 6. Determinism

For git diffs to be meaningful and for rebuilds to be verifiable, output must be **byte-identical for identical input**:

- JSON keys sorted alphabetically (except where array order is semantic).
- Arrays sorted by an explicit key — never by insertion or dict order.
- Numbers rounded to a fixed precision before serialization.
- No wall-clock timestamps inside records; a single `generated_at` lives in `manifest.json` only.
- UTF-8, LF line endings, 2-space indent, trailing newline.
- No floating-point accumulation drift — aggregate in a fixed order.

**Verification:** run the pipeline twice from the same `raw/`; the output must hash identically. This is a required test.

---

## 7. Provenance

Stored per record, never rendered ([decision below](#8-decisions)).

| Field | Values |
|---|---|
| `source` | `"api"` \| `"video"` |
| `source_ref` | For API: the fetch id. For video: `{ stream, vod_offset_s, frames: [...] }` |
| `confidence` | For video only: `0.0–1.0` (see [11 §6](11-video-extraction-pipeline.md)) |
| `rule_version` | Which normalization ruleset produced this record |
| `schema_version` | Shape version |

This makes it possible to answer "where did this number come from?" for any value on the site — the question that must be answerable when a user reports a discrepancy ([09 §7](09-annual-runbook-and-risks.md#7-failure-playbooks)).

---

## 8. Decisions

| Question | Decision |
|---|---|
| Source of truth | **`raw/` is immutable; `normalized/` and `derived/` are fully rebuildable.** No hand-patching above `raw/`. |
| Display of reconstructed data | **Merged without distinction** in the UI. Provenance is stored for audit but not shown. |
| Upstream defects | **Reported, never silently corrected.** The quality report is the mitigation for the "merged without distinction" decision. |
| Teams registry | Union of API registry and all observed season codes — not the 207 upstream entries alone. |

> ⚠️ **Tension worth naming.** "Merged without distinction" means a visitor cannot tell an OCR-reconstructed 2019 score from an authoritative 2023 one. That is an accepted trade-off, and the quality report plus the validation gate in [11 §6](11-video-extraction-pipeline.md) are what make it defensible. If extraction accuracy on the 2019 pilot turns out to be poor, this decision is the first thing that should be revisited.

---

## 9. Open questions

1. **Where does the `raw/` for video live?** OCR output can be large (thousands of crop images). Recommend: retain only the winning frames plus the JSON, not every sampled frame.
2. **Should `raw/` be committed to git?** The API raw is ~1.5 MB (fine). OCR raw is larger. Probably keep API raw in-repo and video raw in object storage.
3. **Does the quality report gate publishing, or just warn?** Leaning: errors gate, warnings do not.
4. **How are hand-curated lookups reviewed?** They encode real judgment (which entity is which). They deserve review like code.
5. **Should there be a `data_version` per season or globally?** Per season allows a single-season correction without invalidating every cached file; global is simpler. Leaning per season ([05 §2.3](05-storage-and-distribution.md#23-immutability)).
