# 01 — Architecture

> The whole system is: **JSON files → templates → HTML files → a CDN.** Everything else is an implementation detail of that sentence.

---

## 1. The one idea

There are two ways to serve a page: from a **file that was generated once**, or from a **file that is regenerated continuously**. They differ only in *where the file lives and how fresh it is*.

So the architecture is built on a single contract:

> **A page is given the absolute URL of the data it needs. It fetches that URL. It does not know or care whether the URL points at a frozen archive file or at a live file that changed 40 seconds ago.**

That is what makes "develop the page once, plug the live infrastructure in later" true rather than aspirational. The MVP ships with only the archive origin. The live origin is added later, with **zero changes to page code and zero changes to the data shapes**.

```
                    build.config.json
                    ┌──────────────────────────────┐
                    │ origins.archive = "…/data"    │
                    │ origins.live    = "…/data"    │
                    │ live_years      = [2026]      │
                    └──────────────┬───────────────┘
                                   │ resolved at BUILD time
                                   ▼
   ┌────────────────────────────────────────────────────────────┐
   │  build.mjs                                                 │
   │  for each route: load data → template(data) → index.html   │
   │  the HTML carries:  data-src="<resolved absolute URL>"     │
   └────────────────────────────────────────────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   ┌──────────────────────┐                ┌──────────────────────────┐
   │  ARCHIVE ORIGIN      │                │  LIVE ORIGIN (later)     │
   │  Cloudflare Pages    │                │  Cloudflare R2 bucket    │
   │  immutable, frozen   │                │  same paths, rewritten   │
   │  seasons 2017–2025   │                │  every 60 s during event │
   └──────────────────────┘                └──────────────────────────┘
```

### 1.1 Why not just put live data in a deploy

Because publishing is not free:

| Channel | Limit | Live need (4 days × 10 h × 1/min) |
|---|---|---|
| Cloudflare Pages deploys | 500 / month | ~2,400 |
| GitHub Pages builds | ~10 / hour (soft) | ~2,400 |

A deploy is a *release*; a live overlay is a *data write*. Conflating them is the mistake this design avoids.

### 1.2 Why an object store and not a database

The page wants a **document**, not a query. `GET /data/live/2026.json` is one cacheable request with no connection, no SDK, no auth and no cold start. A database becomes the right answer only when we add writes *from users* (submissions, moderation) — deferred, and it would sit alongside the object store rather than replacing it.

---

## 2. Repository layout

```
/
├─ data/                      # generated. The archive. Committed.
│   ├─ manifest.json
│   ├─ teams.json
│   ├─ seasons.json
│   ├─ media/                 # team images (WebP)
│   ├─ videos/                # video link + timestamp overlay (hand-edited)
│   └─ <artifacts>            # see 02-data-contract.md
│
├─ pipeline/                  # Node. Fetches, normalizes, emits. Runs rarely.
│   ├─ fetch/
│   ├─ normalize/
│   ├─ adapters/              # one per season: fgc2023 … fgc2026, legacy
│   ├─ emit/
│   └─ lookups/               # hand-curated: team-identity.json, season.json, …
│
├─ site/
│   ├─ templates/             # pure functions: (data, ctx) => html string
│   ├─ assets/
│   │   ├─ app.css            # design tokens + layout primitives
│   │   ├─ app.js             # hydration only
│   │   ├─ flags/             # vendored SVG flags (MIT, flag-icons)
│   │   └─ icons/
│   └─ build.mjs              # route table → dist/
│
├─ live/                      # later. Docker poller. Not in the MVP.
├─ dist/                      # build output. Deployed to Cloudflare Pages.
└─ docs/
```

`data/` and `dist/` are generated; `pipeline/lookups/` and `pipeline/overlays/` are hand-edited and are the only things a human maintains year to year. Nothing mutable is ever published.

---

## 3. Render model

### 3.1 Templates are string functions

```js
// site/templates/team-season.js
export function teamSeason(data, ctx) { return `<!doctype html>…`; }
```

Pure, no DOM, no framework, no dependencies. Because they return **strings** rather than DOM nodes, the *same module* runs in Node at build time and in the browser at hydration time. That is the entire trick that removes the duplicate-implementation problem.

### 3.2 What the build emits

For each route, `build.mjs`:

1. Loads the data artifacts that page needs.
2. Calls the template once.
3. Writes `dist/<route>/index.html`.

The generated HTML contains, in order:

```html
<link rel="stylesheet" href="/assets/app.css?v=<hash>">

<!-- the page, fully rendered, no JS required -->
<main data-page="team-season"> …rendered HTML… </main>

<!-- what the page needs to re-render itself, and where to re-read it from -->
<script type="application/json" id="page-data">{"team_id":"af","year":2025,…}</script>
<script type="application/json" id="page-live-src">"https://live.example.com/data/teams/af/2025.json"</script>
<script type="module" src="/assets/app.js?v=<hash>"></script>
```

Two consequences worth stating:

- **The page works with JavaScript disabled.** The data is in the HTML. Hydration is an enhancement, not a requirement.
- **The page works when the live origin is down.** It shows the last frozen state and adds a banner. It never shows a blank page ([discovery 04 §5](../discovery/04-live-event-architecture.md)).

### 3.3 Hydration

`app.js` is small and does one thing:

```
on load:
  if page-live-src is present:
     every 60 s: fetch(src, {cache:'no-store'})
                 → if the payload's version changed: re-render(replace main's innerHTML)
  else: nothing (archive pages are inert)
```

No router, no virtual DOM, no client-side fetch for archived content. Estimated budget: **≤ 12 KB minified**, `app.css` **≤ 25 KB**.

> **Only pages for `live_years` get a `page-live-src`.** Everything else is a static document that will never make a network request after load. This is what keeps historical pages as cheap as they can possibly be on a slow connection.

---

## 4. Data origins

### 4.1 Configuration

```jsonc
// build.config.json — hand-edited, one file, no build system needed to change it
{
  "active_season": 2026,
  "origins": {
    "archive": "/data",
    "live":    "https://live.fgcalliance.example/data"
  },
  "live_years": [2026]
}
```

### 4.2 Resolution rule

```
originFor(artifact):
    if artifact.season ∈ live_years  → origins.live
    else                              → origins.archive
```

Resolved **once, at build time**, and written into the HTML as an absolute URL. Page code contains no origin logic, no feature flags, no `if (isLive)`.

### 4.3 What the live origin contains

It is **not** a different schema. It is a continuously-regenerated **mirror of a subset of the same paths**:

```
live/<origin>/data/v<N>/teams/<id>/<active_year>.json
live/<origin>/data/v<N>/seasons/<active_year>/matches.json
live/<origin>/data/v<N>/seasons/<active_year>/index.json
live/<origin>/data/v<N>/matches/<active_year>/<stage>/<id>.json
live/<origin>/data/v<N>/live/<active_year>.json      ← the only new artifact
```

**`N` is global to the data generation, and both origins use it.** The live origin is a *mirror of the current version*, not a version of its own — so the artifacts above are simply **absent** from the archive's `/data/v<N>/` and **present** in the live origin's. When `freeze` folds the season in and bumps `N`, both origins move together.

The server writes the first four by running the **same emit code** as the archive; it just writes to R2 instead of the repo, more often. `live/<year>.json` is the one genuinely new artifact — the small polling document described in [discovery 04 §4.4](../discovery/04-live-event-architecture.md).

> **This is the payoff of D2:** the live system reuses the pipeline, the shapes and the pages. Only the *destination* and the *cadence* change.

### 4.4 Failure and degradation

| Failure | Behaviour |
|---|---|
| Live origin unreachable | Page keeps its pre-rendered content, shows a "live updates paused" banner after 5 min. **Never blank.** |
| Live payload older than N minutes | Same banner, with the timestamp of the last successful update. |
| Payload fails shape validation | The server does not publish; the last good file stays. Page is unaffected. |
| Archive origin unreachable | Nothing to do — it is the same CDN serving the page. |

---

## 5. Caching

Cloudflare Pages supports `_headers`, which GitHub Pages does not — this is the concrete reason for D4.

### 5.1 First, the fact that makes this simple

**Archive pages do not fetch `/data/`.** Their data is inlined into the HTML at build time ([§3.2](#32-what-the-build-emits)). So `/data/**` is not a page dependency — it is a **public API surface** that happens to live on the same host.

That matters because it removes the trap this section used to contain. The classic failure is: declare `/data/*` immutable for a year, then ship a correction, and no cache anywhere will ever pick it up. It only bites if something fetches those paths on a normal page view. Nothing does.

### 5.2 Versioned data paths

Immutable is still only *honest* if the URL changes when the content changes, so the archive lives under a version segment:

```
/data/v3/teams/af/2025.json
/data/v3/seasons/2025/matches.json
/data/manifest.json            ← unversioned on purpose: it is how you discover N
```

`N` is `data_version` from `manifest.json`, bumped by `freeze` or by a correction batch. The build writes the version into every precomputed URL — and since every URL is already precomputed into the data ([02 §3.4](02-data-contract.md)), this costs one integer and no template changes.

A correction is then: bump `N`, rebuild, deploy. Old URLs are never requested again by anything current, so pre-existing cache entries are harmless. A mixed-generation read is impossible by construction.

### 5.3 The headers

```nginx
# public/_headers
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/data/v*/*
  Cache-Control: public, max-age=31536000, immutable

/data/manifest.json
  Cache-Control: public, max-age=300

/*.html
  Cache-Control: public, max-age=300
```

**Nothing mutable is published under `/data/`.** The video overlay is a build input, not an artifact (see [02 §6](02-data-contract.md)), so it lives in `pipeline/overlays/` and never reaches `dist/`. That removes the one path that would have needed a short cache inside an immutable tree.

On the R2 side there is no `_headers` file: `Cache-Control` is set as **object metadata on upload**, per object — which is strictly more precise, because the live origin can give the active season a short cache while the archive gets a year:

```
live /data/v3/seasons/2026/matches.json  →  public, max-age=30, stale-while-revalidate=60
live /data/v3/live/2026.json             →  public, max-age=30, stale-while-revalidate=60
```

`stale-while-revalidate` is what keeps the site feeling instant during an event: the client immediately gets the last copy while refreshing in the background.

> ⚠️ **Verify the glob semantics before trusting these rules.** Cloudflare Pages `_headers` matching is easy to get subtly wrong — `v*` matches `videos`, `/assets/*` may or may not cross path separators, and wildcard precedence is not something to assume. The point of `curl -I` in issue F0.2 is to *prove* each rule fires, not to spot-check it. If precedence proves awkward, fall back to one non-overlapping rule per directory.

### 5.4 HTML freshness

`max-age=300` on HTML means a correction — which for archive pages arrives *via the HTML*, since the data is inlined — reaches every visitor within five minutes, at the cost of one revalidation per visitor per five minutes.

If instant propagation ever matters more than that round trip, the alternative is `max-age=0, must-revalidate`: every navigation costs a conditional request, but Pages answers it with a small `304`. Do not reach for `stale-while-revalidate` on HTML — it makes correction latency unpredictable, which is the opposite of what a corrections workflow needs.

---

## 6. Design system

### 6.1 Tokens

Defined once in `app.css`, redefined for dark mode. Every component uses tokens, never raw hex.

**The values are researched, not invented:** [06-palette.md](06-palette.md) has the verified FGC colours read from live CSS, their measured contrast ratios, and the one role-assignment decision still open. Note in particular that FGC's blue `#007FFF` **fails AA as text on white (3.83:1)** — text-sized blue must be `#0059B2`.

```css
:root {
  /* brand */
  --brand:        <FGC purple>;
  --brand-ink:    <readable text on brand>;
  --accent:       <FGC light blue>;

  /* surfaces */
  --bg:           #ffffff;
  --surface:      #f7f7f9;
  --surface-2:    #eef0f4;
  --border:       #d9dce3;

  /* text */
  --fg:           #16121c;
  --fg-muted:     #5c5766;

  /* semantic — medal classes, match results, coverage notices */
  --gold:  …; --silver:  …; --bronze:  …;
  --red-alliance: …; --blue-alliance: …;
  --warn-bg: …; --warn-fg: …;

  /* type */
  --font-ui:   system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-num:  ui-monospace, "SF Mono", "Cascadia Mono", monospace;
  --radius: 6px;
  --gutter: 16px;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* dark overrides */ }
}
:root[data-theme="dark"] { /* same overrides, explicit toggle */ }
```

The explicit `:root[data-theme="dark"]` block mirrors the media-query block so the manual toggle and the OS preference produce identical output. The toggle writes `data-theme` to `<html>` and to `localStorage` (wrapped in `try/catch` — it can throw in private mode).

### 6.2 Rules that carry the TBA-adjacent look

| Do | Don't |
|---|---|
| Dense, information-first tables | Hero sections with one number and a lot of whitespace |
| Tabular numerals for every statistic (`font-variant-numeric: tabular-nums`) | Proportional digits in tables |
| One brand color plus one accent, used sparingly | Purple→blue gradients |
| Flags as the primary team mark | Generic avatar circles |
| Medal colors for awards (gold/silver/bronze), not "blue banners" | Reusing TBA's award iconography verbatim |
| Direct labels on charts, no legend hunting | 3D, drop shadows on data marks |
| Light **and** dark checked at every step | Building light first and "adding dark later" |

### 6.3 Accessibility floor

WCAG AA contrast on all text, visible focus rings, semantic table markup with `<caption>` and `scope`, `loading="lazy"` on every image, and no meaning carried by color alone (a medal is a color **and** a label; a win is a color **and** a "W").

---

## 7. Open questions

1. **Custom domain.** `live.<domain>` vs a Pages route — affects CORS config on R2 and nothing else.
2. **R2 CORS.** Public buckets still need an explicit CORS policy for `fetch()` from the Pages origin. Must be configured before the first live event, not during it.
3. **`app.css` delivery.** One file is the plan; split only if it exceeds the budget.
4. **Search.** A pre-built JSON index (~30 KB) filtered client-side is the plan; a search service is not warranted for ~215 teams.
