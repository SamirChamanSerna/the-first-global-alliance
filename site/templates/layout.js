/**
 * The document shell: nav, section menu, footer, and the head.
 *
 * Two things here are load-bearing beyond markup:
 *
 *  1. **The page is rendered before this runs.** Everything a reader needs is
 *     already in the HTML, so the page works with JavaScript disabled, renders
 *     in one request, and is legible to a crawler.
 *
 *  2. **`page-live-src` is the only thing that makes a page fetch anything.**
 *     Archive pages get no such tag and are inert after load. Only the active
 *     season's pages hydrate.
 *
 * The nav, the mobile menu panel, the section bar and the footer are transcribed
 * from the demo's `<!-- @component:nav -->`, `<!-- @component:section-bar -->`,
 * `<!-- @component:side-menu -->` and `<!-- @component:footer -->` blocks.
 */

import { brand, t } from './brand.js';
import { esc, attr, jsonScript } from './html.js';

/** The nav item a page belongs to, so the current one can be marked. */
const navId = (href) => href.split('/').filter(Boolean)[0] ?? '';

function navLinks(pageId, cls_) {
  return brand.nav
    .map((item) => {
      const current = navId(item.href) === pageId;
      return `<a${attr('class', cls_)} href="${esc(item.href)}"${attr('aria-current', current ? 'page' : null)}>${esc(item.label)}</a>`;
    })
    .join('');
}

function logo() {
  return `<a class="brand" href="/">${brand.logoSvg}<span>${esc(brand.name)}</span></a>`;
}

/**
 * The navbar and its mobile panel. The panel is a `<details>`: it opens with no
 * JavaScript, and there is no opening animation (§3.1, §7).
 */
function nav(pageId) {
  return `<!-- @component:nav -->
<header class="nav">${logo()}
<nav class="links" aria-label="${esc(t('mainNav'))}">${navLinks(pageId)}</nav>
<form action="/search/" method="get"><input type="search" name="q" placeholder="${esc(t('search'))}" aria-label="${esc(t('search'))}"></form>
<details class="menu"><summary>${esc(t('menu'))}</summary><div>${navLinks(pageId)}</div></details>
</header>
<!-- @end:nav -->`;
}

/**
 * A page's section menu. On desktop it is the sticky `.side` column; below the
 * breakpoint `components.css` hides it and the `.subbar` takes over — which is
 * why both are emitted from the same list.
 */
export function sectionMenu({ sections, years = null, currentId = null }) {
  if (!sections?.length) return { side: '', subbar: '' };

  const anchors = (cls_) =>
    sections
      .map((s) => `<a${attr('class', cls_(s))} href="#${esc(s.id)}">${esc(s.label)}</a>`)
      .join('');

  // The year selector is a real `<select>`; app.js makes it navigate, and
  // without JavaScript it is inert while the section anchors still work.
  const select = years?.length
    ? `<select data-year-select aria-label="${esc(t('season'))}">${years
        .map((y) => `<option${attr('value', y.href)}${attr('selected', y.current ? true : null)}>${esc(y.label)}</option>`)
        .join('')}</select>`
    : '';

  const current = sections.find((s) => s.id === currentId) ?? sections[0];

  const side = `<!-- @component:side-menu -->
<aside class="side">${select}${anchors((s) => (s.id === current.id ? 'on' : null))}</aside>
<!-- @end:side-menu -->`;

  const subbar = `<!-- @component:section-bar -->
<div class="subbar"><details><summary>${esc(t('menuGlyph'))} ${esc(current.label)}</summary>${anchors(() => null)}</details>${select}</div>
<!-- @end:section-bar -->`;

  return { side, subbar };
}

/** The two-column shell. A page with no section menu spans the full width. */
export function wrap(inner, { side = null, subbar = '' } = {}) {
  return `${subbar}<div class="wrap">${side ?? ''}<main${side ? '' : ' class="span-all"'}>${inner}</main></div>`;
}

function footer() {
  const links = brand.footerLinks
    .map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('');
  const notes = [brand.attribution, brand.coverageDisclaimer, brand.license].filter(Boolean);

  return `<!-- @component:footer -->
<footer><div class="row"><span>${links}</span>
<span class="seg"><button type="button" data-t="light">${esc(t('light'))}</button><button type="button" data-t="dark">${esc(t('dark'))}</button></span></div>
<p>${notes.map((n) => esc(n)).join(' ')}</p></footer>
<!-- @end:footer -->`;
}

export function layout({
  title,
  description,
  body,
  side = null,
  subbar = '',
  pageId = null,
  pageData = null,
  liveSrc = null,
  assetHash = '',
  canonical = null,
}) {
  const fullTitle = title ? `${title} · ${brand.name}` : brand.name;

  return `<!doctype html>
<html lang="${esc(brand.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description ?? '')}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="${esc(brand.themeColor)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<link rel="stylesheet" href="/assets/app.css${assetHash}">
<link rel="icon" href="${esc(brand.favicon)}" type="image/svg+xml">
<meta property="og:site_name" content="${esc(brand.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description ?? '')}">
<meta property="og:type" content="website">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
<meta name="twitter:card" content="summary">
<script>
// Applied before first paint so a dark-mode reader never sees a white flash.
// The storage key must match the one app.js writes. Wrapped because
// localStorage throws in some private-browsing modes.
try {
  var th = localStorage.getItem('th');
  if (th === 'dark' || th === 'light') document.documentElement.dataset.theme = th;
} catch (e) {}
</script>
</head>
<body>
${nav(pageId)}
${wrap(body, { side, subbar })}
${footer()}
${pageData ? `<script type="application/json" id="page-data">${jsonScript(pageData)}</script>` : ''}
${liveSrc ? `<script type="application/json" id="page-live-src">${jsonScript(liveSrc)}</script>` : ''}
<script type="module" src="/assets/app.js${assetHash}"></script>
</body>
</html>
`;
}
