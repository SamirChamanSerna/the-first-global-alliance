# 06 — Palette

> What FIRST Global's colours actually are, as verified from live CSS — and the one decision still open.
>
> **Status:** research complete · **role assignment PENDING** (see §4)

---

## 1. The finding

**There is no purple in FIRST Global's own brand.** The purple associated with FGC results is the **Material UI v6 default `secondary`**, not a brand colour.

`results.first.global` is a Next.js app built on MUI v6 and uses the framework's stock palette without customisation. Its primary blue and secondary purple are the values MUI ships with. That is the source of the "purple and light blue" impression — and it means adopting those hexes verbatim means adopting *Material Design's* identity, not FGC's.

There is **no published brand or press kit** with a colour specification. `wp-json/wp/v2/global-styles` 404s, the themes endpoint is 401, and Elementor is not in use (the site runs the Bridge/Qode theme with WPBakery), so there is no `--e-global-color-*` palette to read. What follows is read from live CSS and sampled logos.

---

## 2. Verified values

### 2.1 `results.first.global` — the official results site

Read directly from `--mui-palette-*` custom properties in the rendered HTML. **These are MUI v6 defaults**, present in both light and dark schemes.

| Hex | Variable | Use |
|---|---|---|
| `#007FFF` / `#3399FF` | `--mui-palette-primary-main` | blue — light / dark |
| `#0059B2` | `--mui-palette-primary-dark` | blue pressed |
| `#66B2FF` | `--mui-palette-primary-light` | blue light |
| `#9C27B0` / `#CE93D8` | `--mui-palette-secondary-main` | **purple** — light / dark |
| `#7B1FA2` / `#AB47BC` | `--mui-palette-secondary-{dark,light}` | purple states |
| `#F3F6F9` / `#0A1929` | `--mui-palette-background-default` | app background (light / dark) |
| `#FFFFFF` / `#001E3C` | `--mui-palette-background-paper` | cards (light / dark) |
| `#1A2027` / `#E7EBF0` | `--mui-palette-text-primary` | body text (light / dark) |
| `#3E5060` / `#B2BAC2` | `--mui-palette-text-secondary` | muted text (light / dark) |
| `#E0E3E7` / `#2D3843` | grey scale | borders (light / dark) |
| `#DEA500` / `#FFDC48` | `--mui-palette-warning-main` | yellow accent |

Full verified scales:
- **Blue 50→900:** `#F0F7FF #C2E0FF #99CCF3 #66B2FF #3399FF #007FFF #0072E5 #0059B2 #004C99 #003A75`
- **Grey 50→900:** `#F3F6F9 #E7EBF0 #E0E3E7 #CDD2D7 #B2BAC2 #A0AAB4 #6F7E8C #3E5060 #2D3843 #1A2027`

### 2.2 `first.global` — the brand site

From the theme's dynamic stylesheet (`bridge/css/style_dynamic_callback.php`).

| Hex | Use | Occurrences |
|---|---|---|
| `#3498db` | **the actual brand accent** — buttons, links, backgrounds | 86 |
| `#143852` | navy — language switcher, dark borders | — |
| `#334d5c` | slate — button hover, dark sections, gradient end | — |
| `#0f2a3d` | darker navy | — |
| `#00cadb` | cyan accent, borders | — |
| `#57a6db` / `#4cb4ff` | light blues | — |

### 2.3 Logos

| Asset | Colours |
|---|---|
| FIRST Global wordmark | **Monochrome** — `#231F20` black or white. No purple. |
| Globe icon (2021) | Teal `#48c0c0` — the only chromatic brand mark |
| FGC 2024 logo | Blue gradient `#0070b0 → #30b0e0` |
| FGC 2023 Singapore | Red `#e02030` |
| FGC 2022 Geneva | Red `#b02010` + cyan `#00c0d0` |
| FGC 2018 | Light blue `#3090d0` + green + yellow |

**Season logos change colour every year.** That is an opportunity, not a footnote: the season page could take its accent from that season's mark, giving each edition its own identity without ever committing the site to a dominant hue.

### 2.4 Do not use

The `--wp--preset--color--*` values on `first.global` (`#9b51e0`, `#0693e3`, `#fcb900`, …) are **stock Gutenberg defaults**, and the purples `#ab1dfe` / `#330968` / `#4721fb` are WordPress core **gradient presets**. Neither is FIRST Global branding.

### 2.5 Reference

The Blue Alliance's `theme-color` is `#3F51B5` — a dark indigo, visibly darker and duller than any FGC blue. This confirms the brief's "lighter than TAB".

---

## 3. Contrast — verified

Computed against white unless stated. These hold regardless of which role assignment is chosen.

| Colour | Ratio on white | Verdict |
|---|---|---|
| `#007FFF` blue | **3.83:1** | ❌ fails AA for normal text. Fill, border, icon, large text only. |
| `#0059B2` blue-dark | **6.80:1** | ✅ the blue to use for links and body-sized text |
| `#9C27B0` purple | **6.31:1** | ✅ passes AA as text and as a fill with white text |
| `#DEA500` yellow | **2.21:1** | ❌ never for text on light. Fill with near-black text only. |

On dark backgrounds the MUI dark values (`#CE93D8`, `#3399FF`, `#FFDC48` on `#001E3C` / `#0A1929`) are already contrast-appropriate — MUI selected them for exactly that.

---

## 4. The open decision

Only the **role assignment** is undecided; the values themselves are settled. Three coherent options:

| | Primary | Secondary | Character |
|---|---|---|---|
| **A** | Blue `#007FFF` | Purple `#9C27B0` | **What the official results site actually looks like today.** Immediate familiarity for FGC users. |
| **B** | Purple `#9C27B0` | Blue `#0059B2` / `#007FFF` | The brief's reading, with the roles swapped from the source. |
| **C** | Blue `#3498db` | Navy `#143852`, cyan `#00cadb` | Anchored to the *brand* site rather than the results site. No dominant purple. |

**Recommendation: A.** It is what a FIRST Global audience already recognises, it needs no invented justification, and purple stays available as an accent for the things that should stand out — medals, records, live state. Option B is defensible if brand distinctiveness matters more than familiarity; option C if fidelity to `first.global` matters more than to the results product.

**Objection to record:** option A and B both inherit a Material Design default palette. That is the single most common colour scheme on the web, and it sits awkwardly against the brief's "modern, deliberately not AI-looking". Whichever is chosen, the neutral scale, density and typography are what will make the site look deliberate — the hue alone will not.

The decision lives in exactly one place — the token block in `site/assets/app.css` ([01 §6.1](01-architecture.md)) — so switching later is a one-file change. Issue **F4.4** is where it lands.

---

## 5. Sources

- `https://results.first.global/` — `--mui-palette-*` custom properties in the rendered HTML
- `https://first.global/wp-content/themes/bridge/css/style_dynamic_callback.php` — theme option output
- `https://first.global/` and `https://first.global/archive/fgc-2025/` — inline `vc_custom_*` rules
- `https://first.global/wp-json/wp/v2/media` — logo enumeration and pixel sampling
- `https://www.thebluealliance.com/` — `theme-color` for reference
