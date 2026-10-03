# 11 — Video Extraction Pipeline

> 🕓 **DEFERRED — not in the MVP.** The MVP has no video processing of any kind. Match pages link to the correct field VOD, and deep-link to a timestamp only when the owner has recorded one by hand.
>
> The one thing worth reading now is the constraint this document imposes on the **data model** rather than the pipeline: video-sourced matches must land in the *identical* canonical match shape, carrying `source` and `confidence`. The MVP's data contract already provides both ([`../plan/02-data-contract.md §4`](../plan/02-data-contract.md)), so this phase can be added without migration.

> Recovering match boundaries, participants and final scores from archived FIRST Global Challenge livestreams, for the four seasons where the official API has no match data ([10](10-historical-reconstruction.md)).

---

## 1. Scope and the assumption that does NOT hold

The standard pattern for this class of problem — used by every prior-art tool in §8 — is:

```
read match number from overlay  →  look it up in the official results API  →  done
```

**That pattern is unavailable here.** For 2017, 2018, 2019 and 2022 there is no API record to look up: no match number, no team assignment, no score ([10 §1](10-historical-reconstruction.md#1-the-gap)).

So this pipeline must read **everything** from the video:

1. Where each match starts and ends
2. **Which six teams are playing** — the hardest part
3. The final score for each alliance

What we *do* have is season-level aggregate evidence to validate the result against ([10 §4](10-historical-reconstruction.md#4-validation-oracles)). That is what makes the output trustworthy despite being OCR-derived.

---

## 2. Pipeline architecture

**Cheap passes propose; expensive passes dispose.**

```
  ┌─ Tier 0: ANCHOR & EXTRAPOLATE ────────────────────────────────┐
  │  Operator marks ONE match per VOD; the rest derive from        │
  │  inter-match spacing. Zero CV. Works today.                    │
  └───────────────────────────────┬───────────────────────────────┘
                                  │ provides a prior ±minutes
  ┌─ Tier 1: AUDIO ───────────────▼───────────────────────────────┐
  │  Full-VOD pass, ~1 CPU-min for 10h. High recall, low          │
  │  precision. Emits candidate match windows.                     │
  └───────────────────────────────┬───────────────────────────────┘
                                  │ candidate windows
  ┌─ Tier 2: FRAME BURST ─────────▼───────────────────────────────┐
  │  Targeted sampling (2 fps × ~20 s) around each candidate.     │
  │  Expensive per second, so only in narrow windows.             │
  └───────────────────────────────┬───────────────────────────────┘
                                  │ frames
  ┌─ Tier 3: OCR + VOTE ──────────▼───────────────────────────────┐
  │  Read match timer, team identifiers, final score from the     │
  │  results graphic. Modal result across frames.                  │
  └───────────────────────────────┬───────────────────────────────┘
                                  │ candidate matches
  ┌─ Tier 4: VALIDATE ────────────▼───────────────────────────────┐
  │  Check against the season oracle (§6). Reject or flag.        │
  └───────────────────────────────────────────────────────────────┘
```

**Build Tier 0 first.** It is a guaranteed-working fallback, it produces useful data on its own, and it supplies the prior that makes Tier 1's audio search tractable. (This is the model FRC Video Splitter v3 uses: one manual anchor per stream, everything else extrapolated.)

---

## 3. Download layer

### 3.1 Tool and the 2026 constraint

`yt-dlp`, with one non-obvious requirement:

> **As of yt-dlp ≥ 2025.11.12, a JavaScript runtime is required for full YouTube support.** `yt-dlp-ejs` is "Required for full YouTube support", and it needs a runtime — `deno` (recommended, and **the only one enabled by default**), `node`, `bun`, or `QuickJS`. Verified directly from the yt-dlp README.
>
> Official PyInstaller binaries bundle this. **A plain `pip install` does not.**

### 3.2 Audio-first

```bash
yt-dlp -f bestaudio -x --audio-format opus \
       --sleep-interval 5 --max-sleep-interval 15 \
       --extractor-retries 3 \
       -o "%(id)s.%(ext)s" "<URL>"
```

**Never transcode** — `--audio-format opus` remuxes rather than re-encodes.

Expected size for a 10-hour VOD:

| Selector | Rate | Size |
|---|---|---|
| `bestaudio` (opus) | ~128 kbps | ≈ 576 MB |
| lower opus itag | ~50 kbps | ≈ **225 MB** |

For boundary detection a low-bitrate audio stream is entirely sufficient — take the smallest that is still reliably decodable. **A full event of 15 VODs is ~3–9 GB of audio.** Trivial bandwidth.

### 3.3 Targeted video

Full-video download is unnecessary and expensive (720p ≈ 11 GB per 10-hour VOD). Two working patterns:

```bash
# A. Pull a short section (seek-point aligned, ~1-5 s granularity)
yt-dlp -f "bv*[height<=720]" --download-sections "*1:23:00-1:23:30" -o seg.mp4 "<URL>"

# B. Resolve the stream URL once, then seek repeatedly with ffmpeg (much cheaper for bursts)
URL=$(yt-dlp -f "bv*[height<=720]" -g "<URL>")
ffmpeg -ss 4980 -i "$URL" -frames:v 1 -q:v 2 frame.jpg
```

Pattern B is what the prior-art tools use and is far cheaper for many samples. **Caveat:** under SABR, the `-g` URL is increasingly short-lived — pattern A is the fallback.

`--download-sections` requires ffmpeg and works by having ffmpeg seek in the remote URL; cuts land on seek points, not exact frames. Fine for a 150-second match; add a ±3–5 s pad and use the **on-screen timer** for exactness.

### 3.4 Rate limiting — the real constraint

This is materially worse in 2025–2026 and is the item most likely to break the pipeline:

| Mechanism | Symptom | Mitigation |
|---|---|---|
| SABR replacing DASH | Page parses, but 403 or only low-quality formats | `--extractor-args "youtube:player_client=default,tv,mweb"` |
| Mandatory PO tokens | 403 / "Sign in to confirm you're not a bot" | PO-token provider sidecar |
| TLS-level IP fingerprinting | `SSL: UNEXPECTED_EOF` at handshake | **Residential IP** — datacenter ranges are burned |

Reports suggest roughly **~9 videos before throttling per IP** — directly relevant when the job is 15 VODs. Mitigations: space the downloads across days, use a low `--sleep-interval`, and run from a residential connection (the home server is an advantage here).

**Do not pin a yt-dlp version.** The countermeasures move weekly; auto-updating the image is the safer posture.

### 3.5 Unlisted VODs

Field VODs are **unlisted** ([01 §7](01-data-sources.md#7-video-sources)): downloadable by direct URL, but invisible to search, the channel tab, and RSS (playlist RSS returns 0 entries — a known trap).

**Discovery is the risk, not access.** Capture `first.global/live` continuously and store every URL as it appears.

---

## 4. Boundary detection

### 4.1 Audio

Measured on the target machine: `silencedetect` over 48 kHz stereo runs at **~900× realtime** (600 s in 0.667 s); `ebur128` at ~480×. **A 10-hour VOD costs under 1 CPU-minute for an energy pass.**

Best technique — **normalized cross-correlation against a reference clip** of the match-start cue:

```python
corr = correlate(video_audio, reference, mode='valid')
best = np.argmax(corr)
confidence = np.sqrt(best_value / (ref_energy * vid_energy))
```

This is the approach in FRUIT's `AudioFingerprint.py` (see §8). Notes from that implementation worth keeping:

- Reference audio downsampled to **11.025 kHz mono**.
- Acceptance threshold `confidence > 0.2`.
- Corrections applied as a **half-step** (`delay += error/2`) so one bad detection cannot yank the whole timeline.

Alternative/complementary: **spectral-flux onset detection** (SuperFlux-style, with max-filtering along frequency to suppress spurious peaks). Reported precision ~83.6% / recall ~70.1% on music — **not validated on competition audio**, so treat as a supplement, not a solution.

**Honest assessment:** no source anywhere validates audio cue detection on robotics-competition audio. Commentary is continuous and speech-like; crowd noise is broadband; the arena PA may be mixed low. But the problem is *detection* (find one specific repeated transient at a roughly known time), not open-set recognition — which is what makes correlation viable. **Use audio to shrink the search window, never to declare a boundary on its own.**

### 4.2 Video / overlay

Reading the overlay's match number and timer. The right shape is a two-pass design (from `ftc-matchinator`, MIT):

- **Pass 1** — sample ~1 fps by decoding once (not by spawning ffmpeg per sample); template-match a season logo with `TM_CCOEFF_NORMED` at threshold 0.7 to **locate the overlay anywhere on screen**, then crop ROIs *relative to it*. Reject preview/intermission screens with a second template. OCR the match label and the timer; reject timers outside the plausible range.
- **Pass 2** — group by match label, **discard groups with fewer than 5 observations** (the concrete false-positive defence), take the mode of attributes, then pick the minimum-variance sample for the start estimate.

**Never use absolute pixel coordinates.** Every tool that hardcodes ROIs is brittle across seasons and resolutions; anchor-template matching is the fix.

### 4.3 Never trust frame indices

Measured VFR drift of **up to ~2 s over an 8-hour stream** is documented in the prior art. **Anchor to the on-screen timer** (relative time within the match), never to `frame_index / fps`.

### 4.4 A useful timing fact

A reported detail about FGC broadcasts: on-screen scores appear **about 2 seconds after the match timer ends**, with referees manually verifying automated scoring. So the results graphic is *post-timer* — anchor the sampling window to timer expiry, not match start.

---

## 5. Reading the screen

### 5.1 What must be read

| Target | Type | Difficulty |
|---|---|---|
| Match timer | digits | Easy |
| **Team identifiers** | **text / flags / codes** | **Hard — the critical path** |
| Final scores | digits | Medium |

Team identification is the hard one because there is **no reference set to match against** ([10 §6](10-historical-reconstruction.md#6-the-hard-problem-identifying-participants)). Scores are 2–3 digits; team identifiers are names, 3-letter codes, or flags drawn from a set of ~190.

### 5.2 Engine choice

**Tesseract** (Apache-2.0, ~30 MB) is the right default. A broadcast graphic with a fixed font in a fixed position is its best possible case, and it is 10–20× smaller than the alternatives in a container:

| Engine | License | Weight | Verdict |
|---|---|---|---|
| **Tesseract** | Apache-2.0 | ~30 MB | ✅ **default** |
| RapidOCR | Apache-2.0 | ~100 MB (onnxruntime) | fallback if Tesseract underperforms |
| PaddleOCR | Apache-2.0 | 500 MB–1 GB (`paddlex`) | too heavy for this job |
| EasyOCR | Apache-2.0 | 2 GB+ (torch) | too heavy |

### 5.3 Preprocessing chain

```python
gray   = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
big    = cv2.resize(gray, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
blur   = cv2.GaussianBlur(big, (5, 5), 0)
thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
invert = 255 - thresh        # Tesseract requires black-on-white
text   = pytesseract.image_to_string(
           invert,
           config='--psm 7 --oem 3 -c tessedit_char_whitelist=0123456789')
```

Why each step matters:

- **Crop to a fixed region** — the single biggest win; removes everything Tesseract would otherwise segment.
- **Upscale 2–3×** — Tesseract wants ~30+ px glyph height; broadcast numerals are often 20–30 px at 1080p.
- **Otsu binarize, then invert** — overlays are usually white-on-dark and Tesseract is trained black-on-white.
- **`--psm 7`** for a single line; **`--psm 10`** for an isolated character. The default `--psm 3` often returns nothing on isolated digits.
- **`tessedit_char_whitelist`** kills `O`/`0` and `l`/`I`/`1` confusion.

### 5.4 Templating — the highest-leverage technique

Because the broadcast font and layout are **fixed**, glyph template matching beats general OCR:

1. Extract one clean exemplar of each glyph (digits 0–9, and letters for team codes) from a known-good frame.
2. Match candidate cells with `cv2.matchTemplate(..., TM_CCOEFF_NORMED)`.

Advantages over OCR: near-perfect on a fixed font, no engine needed, and it yields a **per-glyph confidence score** — so low-confidence reads can be rejected instead of silently accepted. Tesseract does not meaningfully provide that.

**Training your own `traineddata`** is the other proven path (frcreplay ships one plus user-pattern regexes). If the overlay uses a known web font, synthetic training data can be rendered at the exact size — no manual labelling.

> **Check for a QR code on the results graphic.** `ftc-matchinator` uses `pyzbar` to decode one, which would be a zero-error match identifier. Cheap to check on the first real frame, and it would remove an entire class of risk.

### 5.5 Team identification strategies

Ranked by expected robustness, to be chosen once the overlay is actually seen:

1. **3-letter country codes in a fixed font** → templating or OCR with a `A–Z` whitelist. Most tractable.
2. **Full country names** → harder; needs a fuzzy match against the ~190 known names.
3. **Flags** → template matching against the bundled flag set ([01 §6](01-data-sources.md#6-flags)). Robust *if* flags are large and undistorted on screen.
4. **Positional inference** — if the overlay shows a match number, and the pairing order is derivable from the season's standings or a published schedule, participants might be inferred rather than read. **Not currently viable**: no pairing schedule exists for these seasons.

---

## 6. Validation

The pipeline must be able to **reject its own output**. Validation is what makes an OCR-derived dataset publishable at all.

### 6.1 Per-frame
- Score sums within the plausible range for that game.
- OCR confidence above threshold.
- Match number/timer stable across the burst.

### 6.2 Per-match (voting)
- Extract at **1–2 fps across the graphic's entire dwell time** (~10–20 s → 10–40 frames). Do not try to pick "the best" frame a priori.
- **Take the modal result and require agreement** — e.g. ≥60% across ≥5 readable frames. Majority voting is standard in the prior art (`Counter.most_common` in frcreplay; the ≥5-observation rule in matchinator).
- Use **variance of Laplacian** (sharpness) to break ties and reject motion-blurred frames.

### 6.3 Per-season — the decisive check

| Season | Check | Tolerance |
|---|---|---|
| **2019** | **284 matches, 189 teams, exactly 1 tie, official W-L-T reproduced** | **exact** |
| 2017 | `highestScore` × 163 reproduced | exact |
| 2022 | `highestScore` × 162 reproduced | exact |
| 2018 | `rs/2 ≈ wins` | ±1 per team |

A season that fails its oracle is **not published**. For 2018 there is no hard oracle, so it must clear a lower bar explicitly ([10 §8](10-historical-reconstruction.md#8-per-season-strategy)).

### 6.4 Confidence model

Every extracted match carries:
```
confidence = w1·frame_agreement + w2·mean_ocr_confidence + w3·sharpness_score
```
Threshold for auto-accept; below that, route to a **human review queue** ([07](07-user-content-and-moderation.md)) rather than dropping the match. A partially-read match (teams resolved, score uncertain) is still valuable to a reviewer.

---

## 7. The first implementation task

**Before building any of the above:** download one 2019 VOD and look at it.

Specifically, a ~30-minute session that answers the three unanswerable-from-text questions:

1. Does the overlay show **team identifiers**, and in what form (name / code / flag)?
2. Is there a **results graphic** after each match, how long does it stay up, and what does it contain?
3. Is there a **distinct audio cue** at match start?

**Everything else in this document is preparation for that session.** No text source describes FGC's early broadcast overlays, and no amount of pipeline design substitutes for looking.

---

## 8. Prior art

| Project | License | Transferable value |
|---|---|---|
| **`ftc-matchinator`** | **MIT** ✅ | **The reference architecture.** Two-pass, logo-anchored relative ROIs, group-and-vote, ≥5-observation rule |
| **`andrewda/frc-livescore`** | **MIT** ✅ | KNN digit classifier bootstrapped from Tesseract — the best "read a scoreboard from an arbitrary frame" reference |
| **FRUIT** (`AudioFingerprint.py`) | **GPL-3.0** ⚠️ | **The only working audio match-start detector in any robotics project** (~130 lines, numpy+scipy). Copyleft — reimplement rather than copy if the pipeline is ever distributed |
| **`frc604/frcreplay`** | **AGPL-3.0** ⚠️ | Custom `traineddata` + majority vote + user-pattern regexes. **Viral licence — reimplement, do not copy** |
| **`CutToTheBotVods`** | **none** ❌ | Technique yes, code no — no licence file means all rights reserved |
| **FRC Video Splitter v3** | MIT *claimed*, no LICENSE file ⚠️ | The **anchor-and-extrapolate** model (Tier 0) |
| `tm-obs-switcher` | MIT ✅ | Architecture only; its VEX dependency is unpublished from npm |

**No FIRST Global stream-splitting project exists.** This is greenfield.

### Cross-cutting lessons from the prior art

1. **VFR drift is real** (~2 s over 8 hours) — anchor to on-screen time, not frame indices.
2. **Absolute pixel ROIs are brittle** — anchor templates + relative ROIs.
3. **Re-encode only the short results segment**, then concat with `-c copy`.
4. **Nobody has used audio for this.** The audio tier is unexplored and, per FRUIT, demonstrably workable.

---

## 9. Compute budget

Measured on the target machine (i9-13900HX, 32 GB, ffmpeg 8.1.1):

| Benchmark | Measured | Extrapolated to 10 h |
|---|---|---|
| `silencedetect`, 48 kHz stereo | 600 s in 0.667 s (**~900× RT**) | ~40 s |
| `ebur128` | 600 s in 1.245 s (~480× RT) | ~75 s |
| 1080p30 encode → decode → `fps=1` | 300 s in 16.7 s (**≥18× RT**) | ≤33 min (lower bound; encode-bound) |
| Single frame through a pipe | **116 ms/frame** | worst case, unindexed |

| Per 10-hour VOD | Targeted (recommended) | Full 1 fps scan |
|---|---|---|
| Audio download | 225–576 MB | same |
| Audio analysis | ~2–5 CPU-min | same |
| Frames OCR'd | ~1,000 | 18,000 |
| OCR time | ~10–30 s | ~3–9 min |
| **Total** | **~10–20 min** | ~30–60 min |

**Full event (4 seasons ≈ 40–60 hours of video): ~3–5 hours wall clock.** Storage ~0.5 GB per VOD if only audio + crops are kept.

> **Compute is not the constraint.** YouTube rate-limiting and unlisted-URL capture are.

---

## 10. Docker packaging

```dockerfile
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg tesseract-ocr tesseract-ocr-eng \
      libsm6 libxext6 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
      "yt-dlp[default]" \
      opencv-python-headless \      # NOT opencv-python — headless, no libGL/X11
      pytesseract numpy scipy pyzbar

# + a JavaScript runtime (deno) — required for yt-dlp's YouTube support
```

Expected image ~1.0–1.5 GB, dominated by ffmpeg and Python.

**Pitfalls:**

1. **Deno is not optional** (§3.1). Install it, or run the official yt-dlp binary which bundles EJS.
2. `opencv-python-headless`, never `opencv-python`.
3. **Avoid heavy stacks**: `easyocr`→torch, `paddleocr`→paddlex, `librosa`→numba+scikit-learn. numpy+scipy is sufficient for the audio work.
4. **Missing fonts** make ffmpeg's `drawtext`/`subtitles` fail *silently* — only matters if burning in debug overlays.
5. **Licences**: `aubio` is GPL-3.0, Essentia is AGPL-3.0. Fine for a self-hosted service; avoid AGPL outright if the image is ever distributed.
6. **Architecture**: build for the target architecture — do not assume an x86 image runs on ARM.
7. **POT provider sidecar** needs its own healthcheck and update cadence; a dead sidecar looks exactly like a YouTube change.

---

## 11. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **V1** | **Overlay shows no legible team identifiers** | **Unknown** | **Fatal** | §7 — look at a real VOD first. Fallback: partial reconstruction against known aggregates, plus human review |
| **V2** | YouTube/yt-dlp stops working | **High** | **High** | Deno + EJS, PO-token sidecar, `tv`/`mweb` clients, residential IP, auto-updating image, retry with backoff. **None guarantees success — design for intermittent failure** |
| **V3** | Unlisted URLs not captured in time | High | High | Poll `first.global/live` continuously; store every URL seen |
| **V4** | No distinct audio cue | Unknown | Medium | Fall back to video-only boundary detection; Tier 0 still works |
| **V5** | Overlay layout unknown | Medium | Medium | Anchor-template matching avoids hardcoded pixels; one calibration session |
| **V6** | OCR misreads a score | **Certain** at some rate | Medium | Voting + oracle validation + human review queue |
| **V7** | VFR drift | Medium | Low | Anchor to on-screen timer |
| **V8** | 2018 cannot be certified (soft oracle only) | High | Low | Lower confidence bar, or deprioritize the season |

---

## 12. Open questions

1. **What does the overlay actually show?** (§7) — the one question that determines everything.
2. **Is there a QR code on the results graphic?** Would eliminate a whole risk class.
3. **Are the 2017–2019 VODs still available at all?** A dead VOD cannot be retried ([§3.5](#35-unlisted-vods)).
4. **Single stream or multiple fields for 2017–2019?** Affects how many VODs the job actually is.
5. **Anchor points for Tier 0** — how many manual marks are acceptable? One per VOD is the target.
6. **Where does raw video-derived data live?** ([12 §9](12-normalization-layer.md#9-open-questions))
