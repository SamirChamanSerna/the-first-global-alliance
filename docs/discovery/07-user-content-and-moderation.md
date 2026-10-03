# 07 — User Content & Moderation

> 🕓 **DEFERRED — not in the MVP.** Decision D6: the MVP ships **zero user interaction** — no submissions, no auth, no moderation queue. Video links and image URLs are maintained by the owner directly in JSON files.
>
> The design below remains the plan for when this is built. Two things keep it cheap to add later: the video overlay file (`data/videos/<year>.json`) already exists and is already the authority for timestamps, and every record already carries provenance fields.
>
> **The §5.4 recommended sequence still holds** and is worth acting on early: check whether the field VODs carry chapter markers in their descriptions *before* designing anything around timecodes.

> User-submitted videos, robot photos, and data corrections — plus the hardest open problem in the project: **match-level video timestamps**.

---

## 1. Scope decision

Three candidate UGC surfaces. Recommended: **ship only one of them initially.**

| Surface | Value | Cost | Verdict |
|---|---|---|---|
| **Video links for matches** | **High** — the single biggest gap in FGC data. There is no match-level video anywhere. | Low — text rows, one moderation table | ✅ **Ship first** |
| **Data corrections / discrepancy reports** | High — protects data quality; users will spot errors we don't | Very low — reuse the same table | ✅ **Ship first** |
| **Robot photos** | Medium — TBA-style robot galleries | **High** — file storage, image pipeline, bandwidth, moderation of binary content | ⏸ **Defer** |

### Why photos are deferred

- `first.global/<year>-nations/<country>-<year>/` **already hosts team photos**, and the WordPress REST API exposes them ([01 §5.1](01-data-sources.md#51-per-nation-team-pages)). We should **check coverage and link to what exists** before building a competing photo system.
- Photos are the only asset class that meaningfully threatens the $0 budget ([05 §4.4](05-storage-and-distribution.md#44-image-bandwidth-math-the-real-risk)).
- Text submissions deliver most of the value for a fraction of the engineering and moderation burden.

> **Recommendation: Phase 1 ships video links + corrections only (text). Photos are revisited once the platform is stable and photo coverage from `first.global` has been assessed.**

---

## 2. Moderation model

Mirrors The Blue Alliance: **anyone can submit, nothing is public until an admin approves.**

```
submit (public)  →  pending  →  ┌── approve ──→  published
                                └── reject  ──→  rejected (reason recorded)
```

Design rules:

1. **Moderation is mandatory, not optional.** Nothing a user submits reaches the public site unreviewed.
2. **Every submission records provenance**: who submitted, when, from where, and which admin acted on it.
3. **Rejections carry a reason** so submitters can improve.
4. **Rate-limit submissions per user** to make spam uneconomic.
5. **Never delete** — mark as rejected. Audit trail matters if a dispute arises.

---

## 3. Proposed schema (Supabase)

```
profiles            id, display_name, role ('user'|'moderator'|'admin'), created_at
submissions         id, kind ('video'|'correction'|'photo'), status, submitted_by,
                    created_at, reviewed_by, reviewed_at, review_note
video_links         submission_id → match_id, youtube_url, youtube_id,
                    start_seconds, end_seconds, source ('user'|'admin'|'auto')
corrections         submission_id → entity_type, entity_id, field, current_value,
                    proposed_value, evidence_url
audit_log           id, actor, action, target, before, after, at
```

**Row-Level Security policy:**

| Table | Anonymous | Authenticated | Moderator/Admin |
|---|---|---|---|
| `profiles` | read own only | read own | read all |
| `submissions` | insert only | insert + read own | read + update all |
| `video_links` (published) | read | read | read + write |
| `video_links` (pending) | ✗ | read own | read all |
| `audit_log` | ✗ | ✗ | read |

The `pending`/`published` split is enforced by RLS, not by application code — so even a compromised client cannot publish its own submission.

---

## 4. Authentication

Supabase Auth provides email/password and OAuth out of the box, with 50k MAU on the free tier.

**Recommendation: allow anonymous *reading* of everything, require login only to submit.** Most visitors are browsing; forcing auth to view a team page would be a self-inflicted wound.

For submissions, social OAuth (Google/GitHub) reduces friction and gives a durable identity to rate-limit against.

---

## 5. The video timecode problem

**This is the most expensive feature in the project.** It is worth being explicit about why.

### 5.1 The situation

- FGC publishes **no match-level video**. Not now, and not historically.
- Since 2022 the event is streamed as **5 fields × 3 days = 15 VODs per year**, titled `<YEAR> FIRST Global Challenge - Day N, Field M`.
- **Every field VOD is unlisted** — invisible to search, the channel tab, and RSS. Links must be captured manually ([01 §7](01-data-sources.md#7-video-sources)).
- **No match → timestamp mapping exists anywhere**, upstream or otherwise.
- The only official linkage is `match.field` (1–5) → the day's field VOD.

So: for a given match we can identify **which 10-hour video contains it**, but not **where in that video it is**.

### 5.2 Candidate approaches

| Approach | Accuracy | Effort | Notes |
|---|---|---|---|
| **A. YouTube chapters** (parse VOD description) | Exact if present | **Trivial** | ⚡ **Check this first.** If uploaders add chapter markers, the problem is solved for free. Unknown whether FGC VODs have them. |
| **B. Schedule-derived offset** | ±5–30 min | Low | `offset ≈ match.scheduledTime − vod.recordingStart`. Requires knowing the recording start, which is not published; late starts and delays accumulate through the day. |
| **C. OCR overlay detection** | ±2–10 s | **High** | The proven technique. Detect the match number in the broadcast overlay and segment on change. |
| **D. Crowdsourced timestamps** | ±5–30 s | Medium | Users scrub and submit `(match, mm:ss)`; admin approves. Zero compute, but needs an engaged audience. |
| **E. Hybrid** | — | Medium | B as an approximate baseline, refined by D, optionally bootstrapped by C. |

### 5.3 The OCR path is computationally viable

Worth quantifying, because "it's too heavy to run locally" is a reasonable assumption that turns out to be false:

```
Per VOD:  10 hours = 36,000 s
Sample 1 frame / 10 s             →  3,600 frames
OCR each (grayscale + crop + tesseract)  ≈ 100 ms
                                  →  ~6 min per VOD
15 VODs per event                 →  ~90 min total CPU
```

**≈ 1.5 hours of CPU for a complete event.** That is a single overnight job on a personal server — comfortably within the "all processing happens locally" constraint.

The real cost is not compute, it is **engineering and tuning**:

- The overlay layout changes between years (and possibly between fields), so the crop region must be re-tuned each season.
- Match numbers appear in several places on screen; false positives are the main failure mode.
- Streams have intermissions, replays, and ceremonies that must be filtered out.
- VOD start offsets may differ from broadcast start (trimming), requiring an anchor point.

Prior art to study: [`CutToTheBotVods`](https://github.com/ZachMckennedyFWig/CutToTheBotVods) (VEX — OCR + ffmpeg + tesseract), and FRC Video Splitter / Matchinator (FIRST — OpenCV + OCR + heuristics).

### 5.4 Recommended sequence

1. **Immediately (cheap):** check whether the per-field VODs carry **chapter markers** in their descriptions. If yes, adopt approach A and the problem is solved.
2. **Phase 1:** publish **field-level links with an explicit "approximate" label**, derived from approach B. This is honest, costs almost nothing, and is already far better than the status quo (which is nothing at all).
3. **Phase 2:** open **crowdsourced timestamp submissions** (approach D) with admin approval. The community has the incentive — this is exactly what TBA users do.
4. **Phase 3 (optional):** build the OCR pipeline (approach C) to bootstrap and cross-check the crowdsourced data, and to pre-fill timestamps for years where nobody is motivated to scrub manually.

> **Do not start with OCR.** It is the most impressive option and the worst first move: high engineering cost, fragile across years, and it delivers a worse experience than one engaged user with a keyboard. Earn the complexity first.

---

## 6. Video submission flow

```
User finds a match page
  → clicks "Add Video"
  → pastes a YouTube URL
  → (optional) scrubs to the match start and submits the timestamp
  → submission enters `pending`
Moderator opens the queue
  → plays the video at the submitted timestamp
  → approves / rejects with a note
  → published; match page now shows the video at that offset
```

**Validation on submit (client + server):**

- URL must be a YouTube domain; extract and store the 11-character video ID.
- **Verify the video exists and is embeddable** via YouTube's oEmbed endpoint (`https://www.youtube.com/oembed?url=...&format=json`) — this also catches private/deleted videos at submission time rather than at review time.
- Reject duplicates (same `youtube_id` + `start_seconds` for the same match).
- Warn if the submitted video's ID is not one of the known season field VODs — legitimate (a team may upload its own clip) but worth flagging to the moderator.

---

## 7. Correction submission flow

```
User viewing any data point
  → clicks "Report an issue"
  → prefilled with entity + field + current value
  → describes the correct value + optional evidence link
  → enters `pending`
Moderator reviews
  → approves → correction applied to the archive → data_version bumped
  → rejects with a note
```

**Critical constraint:** corrections modify the **frozen archive**, which is designed to be immutable ([05 §2.3](05-storage-and-distribution.md#23-immutability)). The process must therefore be:

1. Corrections accumulate during the year in Supabase.
2. They are **applied in batches** — periodically, not instantly, as the project brief specifies.
3. Applying a batch regenerates the archive and bumps `data_version`, so the change is atomic and cacheable.

This is why corrections are *not* applied live: a single edit would otherwise invalidate every cached file.

---

## 8. Anti-abuse

| Risk | Mitigation |
|---|---|
| Spam submissions | Rate limit per account; require auth |
| Malicious video links | Mandatory moderation; oEmbed pre-check; never auto-publish |
| Link rot | Periodic re-check via oEmbed; mark dead links rather than deleting |
| Moderation backlog | Batch review UI; queued corrections apply on a schedule |
| Defacement | RLS enforces that only moderators can publish; audit log on every action |

---

## 9. Open questions

1. **Do the field VODs have chapter markers?** Determines whether the timecode problem is trivial or expensive. **Highest-priority unknown in this document.**
2. **Do `first.global` per-nation pages have adequate photo coverage?** Determines whether a photo system is needed at all.
3. **How many moderators are realistic?** One admin may be enough at first; the queue design should still support more.
4. **Should corrections be able to modify upstream-sourced values**, or only add annotations? The former risks diverging from the official record; the latter keeps provenance clean. Leaning toward: store *both* the official value and our correction, and display both when they differ.
