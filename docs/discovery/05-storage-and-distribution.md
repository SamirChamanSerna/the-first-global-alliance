# 05 — Storage & Distribution

> ⚠️ **Partially superseded.** The sizing analysis below is still the reference. §3 (hosting) and §4.2–4.3 (live store) are **decided**: **Cloudflare Pages** + a **Cloudflare R2** public bucket (see [`../plan/README.md §2`](../plan/README.md#2-decisions-log), D3/D4). The decisive factor §3 lists as an open trade-off — `_headers` support — is what settled it. Supabase is deferred until user submissions exist.

> Where bytes live, what they cost, and how they reach a phone on a slow connection.

---

## 1. The size budget

Everything below follows from one number: **the entire FGC historical record 2017–2025 is ≈ 1.5 MB of JSON.**

| Asset | Size | Notes |
|---|---|---|
| Season bundles 2017–2025 (raw upstream) | ~1.5 MB | Before normalization |
| Team registry (union, ~215 entities) | ~30 KB | |
| Season metadata (hand-maintained) | ~5 KB | 8 seasons |
| Normalized archive (all seasons) | ~2 MB est. | Similar order to raw |
| Per-team lifetime aggregates (~215 files × ~3 KB) | ~650 KB | The distribution optimization |
| Frontend code (HTML/CSS/JS, no framework) | ~200 KB est. | |
| Flags (278 SVGs, optimizable) | ~1–2 MB | Can be subset to ~215 used |
| **Total site, excluding photos** | **≈ 5 MB** | |

For comparison, GitHub Pages allows **1 GB** per published site. We would use **0.5%** of it.

> **This is the single most important architectural fact:** there is no scale problem. A database, a search index, and a CDN are all optional. Files are sufficient.

---

## 2. The archive layer (immutable, static)

### 2.1 File layout

```
data/
  manifest.json                    # index: seasons, teams, data versions
  teams.json                       # full team registry
  seasons.json                     # season metadata (dates, host, theme, game)
  seasons/
    2025/
      meta.json                    # rankings, alliances, awards (small)
      matches.json                 # normalized matches
      details.json                 # raw per-match details, keyed by match_id
      teams.json                   # that season's roster
    2024/ …
  teams/
    af.json                        # lifetime aggregate for one team (~3 KB)
    mx.json
    …
  live/
    2026.json                      # live overlay (only during events)
```

### 2.2 Why per-team files matter

A naive design serves the 620 KB season bundle to every page. A team page for Afghanistan needs ~2 KB of it.

```
Before:  1 page view  = 620 KB
After:   1 page view  =  ~3 KB   (200× reduction)
```

With 215 teams, the full per-team split costs ~650 KB of repository space and eliminates almost all page weight. This is what makes the "works on any device, any connection" requirement achievable without clever engineering.

### 2.3 Immutability

Historical seasons **never change**. This permits the strongest possible caching:

```
Cache-Control: public, max-age=31536000, immutable
```

Encode a `data_version` in `manifest.json` and use versioned paths (`/data/v3/seasons/2025/matches.json`) so a correction can be shipped without invalidating everything, and without ever serving a mixed-generation read.

> ⚠️ **GitHub Pages does not support custom response headers** — no `_headers` file, no header configuration. You get GitHub's defaults (typically ~10 minutes for assets). Cloudflare Pages *does* support a `_headers` file. This is the main practical difference between the two hosts and is discussed in §5.

---

## 3. Hosting

| | GitHub Pages | Cloudflare Pages |
|---|---|---|
| Cost | Free | Free |
| Bandwidth | **100 GB/month soft limit** | **Unlimited** |
| Site size | 1 GB | 20,000 files / 25 MB per file |
| Custom headers | ❌ Not supported | ✅ `_headers` file |
| Builds | 10/hour soft (waived with Actions) | 500/month |
| Custom domain | ✅ | ✅ |
| Deploy source | GitHub repo | GitHub repo |
| Commercial use | Prohibited | Allowed |

### Bandwidth estimate

Optimistic-to-pessimistic, for a 4-day event:

| Scenario | Views/day | Avg page weight | 4-day total |
|---|---|---|---|
| Quiet | 500 | 150 KB | 300 MB |
| Busy | 5,000 | 150 KB | 3 GB |
| Viral | 50,000 | 150 KB | 30 GB |

Even the viral case fits within GitHub Pages' 100 GB/month soft limit — **provided images are not served from Pages**. Images are the bandwidth risk, not data (see §4.3).

> **Recommendation:** start on **GitHub Pages** as originally planned — it is sufficient and familiar. Switch to **Cloudflare Pages** if either (a) custom caching headers become necessary for the live overlay, or (b) traffic approaches the soft limit. The migration is a one-line deploy-target change since both build from the same repo.

---

## 4. The live layer (mutable)

### 4.1 What actually needs to be mutable

Only two things:

1. **Live event state** — standings and recent matches during an event (ephemeral, ~1 week/year).
2. **User submissions** — video links, robot photos, corrections (persistent, low volume, needs moderation).

Everything else is immutable and static. This dramatically narrows the backend requirement.

### 4.2 Live store options

| Option | Free tier | Fit |
|---|---|---|
| **Supabase** (Postgres + Auth + Storage + RLS) | 500 MB DB, ~5 GB egress/mo, 1 GB storage, 50k MAU, 2 active projects; **pauses after ~1 week of inactivity** | Best fit *if* UGC is in scope — auth, RLS, and moderation are bundled. The pause is acceptable because we only need it during events. |
| **Cloudflare R2** (object storage) | 10 GB storage, 10M ops/mo, **zero egress fees** | Best for *images* specifically. Zero egress is decisive if robot photos are hosted. |
| **Cloudflare D1** (SQLite) | 5 GB, 5M reads/day, 100k writes/day | Viable, but ties us to the Workers ecosystem and provides no auth. |
| **Git commits** | unlimited | A poller *could* commit `live.json` to the repo. Rejected: commit churn is ugly, deploys are slow, and it pollutes history. |

### 4.3 Recommendation

**Supabase as the single mutable backend**, because it is the only option that bundles database + auth + file storage + row-level security, which is exactly the shape the UGC requirements need ([07](07-user-content-and-moderation.md)).

Serving the live overlay from a **public Supabase Storage bucket** (a plain CDN GET of `live/2026.json`) keeps client reads simple, cacheable, and cheap — and avoids the Supabase Realtime connection limits entirely ([04 §6](04-live-event-architecture.md#6-why-not-supabase-realtime--websockets)).

**Add Cloudflare R2 only if robot photos become a real bandwidth consumer**, since its zero egress is strictly better than Supabase Storage's metered egress. This is a deliberate "add later if needed" decision, not a day-one requirement.

### 4.4 Image bandwidth math (the real risk)

This is the one place where the $0 budget could actually be threatened.

| Assumption | Value |
|---|---|
| Teams | 192 |
| Photos per team per year | 1–3 |
| Source photo size | ~2 MB (phone camera) |
| **Served as-is** | 192 × 3 × 2 MB = **1.15 GB per full gallery traversal** |
| Served as 1600px WebP (~150 KB) | ~86 MB per traversal |
| Served as 400px thumbnail (~15 KB) | ~8.6 MB per traversal |

**Mitigations, all mandatory:**

1. **Resize on upload** — never store or serve the original. Cap at ~1600 px, convert to WebP.
2. **Serve thumbnails in lists**, full-size only on click.
3. **`loading="lazy"`** on every image, always.
4. **`srcset`** so phones never download desktop-sized images.
5. **Set an upload cap** (e.g. 5 MB) and reject anything larger client-side before it ever reaches storage.

With these, a gallery-heavy page stays under ~150 KB and the $0 budget holds.

---

## 5. Caching strategy

| Content | Change frequency | Header |
|---|---|---|
| `/data/v<N>/seasons/**` | never | `public, max-age=31536000, immutable` |
| `/data/v<N>/teams/**` | only on correction | `public, max-age=31536000, immutable` |
| `/data/manifest.json` | per correction | `public, max-age=300` |
| `/data/live/<year>.json` | every 60 s during events | `public, max-age=30, stale-while-revalidate=60` |
| Images | never | `public, max-age=31536000, immutable` |
| HTML/CSS/JS | per deploy | `public, max-age=600` (cache-bust via query hash) |

`live.json`'s `stale-while-revalidate` is what keeps the site responsive during an event: clients instantly get the last cached copy while refreshing in the background.

---

## 6. Cost analysis

| Component | Cost |
|---|---|
| Hosting (GitHub Pages or Cloudflare Pages) | $0 |
| Live + UGC backend (Supabase free tier) | $0 |
| Poller (existing personal Docker host) | $0 marginal |
| Domain (optional) | ~$10–15/year |
| **Total** | **$0** (or domain cost only) |

**Known $0-risk points:**

1. **Supabase free-tier pause** — projects pause after ~1 week of inactivity. Acceptable because live/UGC use is concentrated around events; the archive does not depend on it. Mitigation: a scheduled weekly ping, or accept the 10–30 s cold start.
2. **Supabase egress (~5 GB/mo)** — the tightest real constraint. Mitigated by the image strategy in §4.4 and by serving the archive from Pages, not Supabase.
3. **GitHub Pages 100 GB/mo soft limit** — only reachable in a viral scenario, and only if images are served from Pages.
4. **Upstream API changes** — not a cost risk, but the biggest availability risk. See [09](09-annual-runbook-and-risks.md).

---

## 7. Multi-language storage

The UI is English-first but must support multiple languages. Two layers, deliberately separated:

1. **UI strings** — `i18n/en.json`, `i18n/es.json`, … Small, static, lazily loaded per locale. A locale is one file.
2. **Content** — team names come from the data and are **not** translated; they are proper nouns. Season themes and award names are English-authored upstream and displayed as-is, optionally with our own translation table layered on top.

i18n costs roughly nothing in bytes and can be added after the archive works. Design the JSON key structure for it from day one, but do not build the switcher until there is content worth switching.

---

## 8. Open questions

1. **GitHub Pages vs Cloudflare Pages** — leaning GitHub Pages first, with the live overlay's caching handled client-side if headers are unavailable.
2. **Whether `live.json` should be one file or split per stage** (`t2`/`t3`/`t4`) to keep it small late in an event.
3. **Whether to subset the flag set** to only the ~215 entities we actually use, cutting ~1.5 MB from the deploy.
4. **Supabase vs also-R2 for photos** — decide when photo volume is known.
