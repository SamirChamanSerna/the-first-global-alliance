# 09 — Annual Runbook & Risks

> How to operate this project year after year, and what could go wrong.

---

## 1. The annual cycle

The project's defining requirement is that it must be **resumable every year** without redesign. The cycle:

```
   ┌─────────────────────────────────────────────────────────────┐
   │                                                             │
   ▼                                                             │
 DORMANT ──► PREPARE ──► LIVE ──► FREEZE ──► ARCHIVED ───────────┘
 nothing     T−14→T−1   event    T+1         static, forever
 runs        days       3–4 days  day        no services running
```

**Key property: between events, nothing runs.** No always-on service, no database dependency, no cost. The archive is static files that serve themselves.

---

## 2. Pre-event checklist (T−14 → T−1)

| When | Task | Verify |
|---|---|---|
| T−14 | Confirm the API returns the new season | `GET /v1?year=<new>` → 200, empty arrays is expected pre-event |
| T−14 | Update `seasons.json` from `first.global/archive/fgc-<year>/` | Host city, dates, theme, game name |
| T−14 | Identify the season's ranking stat name | Check the official frontend's `lib/data.ts` and the archive page |
| T−14 | Write or update the season adapter | Inspect the new `details` vocabulary — it is new every year |
| **T−10** | ⚡ **Capture the stream playlists** | `<YEAR> FGC \| Individual Field Streams` — **unlisted, must capture before the event** |
| T−7 | Verify field count (main + fields 1–5) and `watchLinks` | |
| T−3 | Deploy the frontend with the new season scaffolded | Empty state renders correctly |
| T−1 | Confirm Supabase project is awake (not paused) | Cold start is 10–30 s |
| T−1 | **Start the poller in `live` mode** | Confirm it idles cleanly on an empty season |
| T−1 | Confirm alerting works | Send a test alert |
| T−1 | Dry-run the degradation path | Simulate upstream failure; verify the stale banner appears |

> ⚠️ The T−10 stream capture is easy to forget and **impossible to recover** if missed — unlisted VODs are not discoverable by browsing, and if the playlist link is lost, the video URLs must be recovered by hand.

---

## 3. During the event

| Cadence | Check |
|---|---|
| Start of each day | Poller alive; poll success rate ≥ 99%; last publish < 2 min old |
| Every few hours | Spot-check one match score against `results.first.global` |
| On alert | Investigate; if the shape changed, the poller has **stopped publishing** by design — see §7 |
| End of each day | Confirm all played matches have `details` backfilled |

**Success criteria:** end-to-end lag ≤ 60 s (target), ≤ 15 min (hard requirement). Zero wrong scores published. Zero blank pages.

**If something breaks:** the static archive keeps serving all historical pages throughout. Degradation is graceful by construction ([04 §5](04-live-event-architecture.md#5-failure-and-degradation)). A broken live overlay is an inconvenience, not an outage.

---

## 4. Post-event freeze (T+1 → T+3)

1. **Verify completeness** — all matches `played`, all `details` backfilled, awards present.
2. **Run `freeze --year=<new>`** → generates the full static archive and a validation report ([06 §5](06-extraction-pipeline.md#5-validation-report)).
3. **Read the validation report.** Do not skip this. Investigate every warning; check the diff against the previous year for implausible changes.
4. **Review the diff** — it should be additive only. Unexpected modifications to prior seasons indicate a normalization regression.
5. **Commit and open a PR.** Rebuild the site.
6. **Verify the static site** with the poller **stopped** — proving no runtime dependency remains.
7. **Stop the poller.** Clear the live store.
8. **Update the changelog** if any corrections were applied.

**Definition of done:** the site serves the complete new season with **zero services running**.

---

## 5. Adding a new season (the recurring work)

Per year, expect roughly:

| Work | Effort |
|---|---|
| `seasons.json` metadata | ~15 min |
| New season adapter (map the new `details` vocabulary) | ~2–4 h |
| Stream playlist capture | ~15 min |
| Pre-event verification | ~1 h |
| Event-day monitoring | ~30 min/day |
| Freeze + review | ~2 h |
| **Total** | **~1–2 days per year** |

This is the payoff of the static-first design: the recurring cost is a data-mapping exercise, not an infrastructure exercise.

---

## 6. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | **Upstream API shape changes without notice** | **High** | **High** | `/v1` is the only version marker; there is no changelog, no docs, and no deprecation policy. Mitigation: strict shape validation that **refuses to publish** on mismatch ([06 §3.2](06-extraction-pipeline.md#32-validate)); keep serving last-good; alert immediately. This is the #1 risk. |
| **R2** | Upstream API becomes unavailable or access-restricted | Medium | High | No ToS exists today, so access could change without warning. Mitigation: the frozen archive is **local and complete** — the site keeps working forever without upstream. Only live coverage and new seasons need the API. |
| **R3** | No permission to republish data | Medium | Medium–High | Nothing is licensed explicitly. Mitigation: attribute FIRST Global prominently, link to official sources, never imply endorsement, and **seek written permission** (§8). |
| R4 | Unlisted VODs removed or made private | Medium | Medium | Capture playlist URLs early and mirror our own index. Mark dead links rather than deleting. |
| R5 | Upstream data contains errors we faithfully propagate | Medium | Medium | We cannot fix upstream, but we can (a) validate aggressively, (b) let users report discrepancies ([07](07-user-content-and-moderation.md)), (c) always cite the official source so users can verify. |
| R6 | Supabase free tier pauses or exceeds quota | Low–Medium | Medium | Live/UGC only; archive unaffected. Weekly keepalive ping; image bandwidth strategy ([05 §4.4](05-storage-and-distribution.md#44-image-bandwidth-math-the-real-risk)). R2 as a fallback for images. |
| R7 | GitHub Pages bandwidth soft limit | Low | Low | Only reachable if images are served from Pages and traffic spikes. Cloudflare Pages has unlimited bandwidth — a one-line migration. |
| R8 | Schema drift requires a new adapter every year | **Certain** | Low | Not really a risk — a known recurring cost, budgeted in §5. |
| R9 | Solo-maintainer bus factor | Medium | High | **Mitigation: thorough documentation.** This directory is that mitigation. Keep it current; a well-documented archive is maintainable by someone else. |
| R10 | Timezone / date handling errors | Low | Low | Store UTC + original offset ([02 §3.5](02-data-model.md#35-scheduledtime)); display venue-local and viewer-local. |
| R11 | Score contamination in ratings produces misleading analytics | **Certain** if unaddressed | Medium | Do not ship naive OPR. Prefer outcome-based ratings; label approximations ([03 §2.4](03-metrics-catalog.md#24-recommended-response)). |
| R12 | Small-sample ratings presented as precise | High | Medium | **Mandatory uncertainty intervals** on every rating. n≈12 ([03 §2.5](03-metrics-catalog.md#25-sample-size-reality-check)). |

### The top three, in one line each

1. **R1 — silent schema change.** The single most likely way this project publishes wrong data. Validation that refuses to publish is the fix.
2. **R9 — maintainer continuity.** Documentation is the only real mitigation for a solo project.
3. **R3 — permission.** Cheap to ask, expensive to discover is a problem.

---

## 7. Failure playbooks

### The poller stopped publishing mid-event

1. Check the alert reason — **shape validation failure is the most likely cause**.
2. If validation failed: compare the payload against the expected schema. Upstream has probably changed.
3. **Do not disable validation.** It is what prevents wrong data from publishing.
4. If the change is small and understood, patch the adapter, test against the live payload, restart.
5. If it is not understood, leave the poller **off**. The site serves last-good with a stale banner. A visibly stale site is acceptable; a wrong one is not.

### A user reports a wrong value

1. Verify against `results.first.global` — is it us or upstream?
2. **If upstream:** log it as a known discrepancy; display our correction alongside the official value ([07 §9](07-user-content-and-moderation.md#9-open-questions)). Never silently diverge from the official record.
3. **If us:** it is a normalization bug. Fix, regenerate, bump `data_version`, and check whether the same bug affects other seasons.

### The event finishes and the archive looks incomplete

Run `freeze` again — it is idempotent and will backfill any missing match details. Then re-read the validation report. If matches are missing upstream, they are missing upstream; document the gap in the coverage notice rather than inventing data.

---

## 8. Open questions for the owner

Decisions that need a human, not more research:

1. **Ask FIRST Global for permission?** Recommended yes — a short, polite email to the results team explaining the project, offering attribution and a link to the official site. Costs nothing; removes the largest non-technical risk (R3).
2. **How much of the 2026 event should be attempted?** The event is **7–10 October 2026**; the platform does not exist yet. Realistic options: (a) ship the archive afterwards, (b) fast-track Phase 0+1+2 to attempt live coverage, (c) ship the archive for 2017–2025 now and treat 2026 as the first archived season. See [08's build order](08-feature-list-and-roadmap.md#suggested-build-order).
3. **GitHub Pages or Cloudflare Pages?** ([05 §3](05-storage-and-distribution.md#3-hosting))
4. **Do the field VODs have chapter markers?** Determines whether the timecode problem is cheap or expensive. **Check before building anything for it.** ([07 §5.2](07-user-content-and-moderation.md#52-candidate-approaches))
5. **Is a photo system needed at all?** Depends on `first.global` photo coverage — assess before building.
6. **Who moderates?** Assume the owner initially; design the queue to scale.

---

## 9. Legal & ethical posture

The project republishes data created by FIRST Global, a nonprofit, from an undocumented public API.

**Recommended posture:**

- **Attribute prominently.** "Data sourced from FIRST Global" with a link, on every page that shows their data.
- **Never imply endorsement or official status.** The name "The First Global Alliance" must not read as an official FIRST Global property — consider a clearer disclaimer in the footer.
- **Link upstream, don't replace it.** Every match and season should link to the corresponding `results.first.global` page.
- **Be a good citizen of the API.** One poller, 60 s cadence, descriptive `User-Agent`, no scraping ([01 §10](01-data-sources.md#10-access-etiquette)).
- **Respect the unlicensed codebase.** The official frontend is unlicensed — its *code* must not be copied. Its *data source* is fair game to consume, and the API behaviour documented here is observable fact.
- **Take corrections seriously.** If FIRST Global asks for a change, comply promptly.
- **The flag set** (`lipis/flag-icons`) is MIT-licensed and requires attribution.

---

## 10. State of this discovery phase

| Area | Status |
|---|---|
| Data sources | ✅ Fully mapped and live-verified |
| Data model | ✅ Designed, with hazards identified |
| Metrics | ✅ Catalogued, with feasibility assessed |
| Live architecture | ✅ Designed |
| Storage & distribution | ✅ Designed, with cost analysis |
| Extraction pipeline | ✅ Designed |
| UGC & moderation | ✅ Designed; timecode problem scoped |
| Feature list | ✅ Prioritized with difficulty |
| **Implementation** | ❌ **Not started — by design** |

**The next action is a decision, not more research:** choose which phase to build first ([08](08-feature-list-and-roadmap.md#suggested-build-order)) and answer the open questions in §8.
