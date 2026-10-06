#!/usr/bin/env node
/**
 * Build the static site.
 *
 * For every route, load its payload, call its template once, and write
 * dist/<route>/index.html. The payload is inlined into the document, so a page
 * renders in one request with no JavaScript and no runtime fetch.
 *
 * This does NOT read `data/`. That tree is the runtime surface for browsers; the
 * build shares its payload builders directly (`pipeline/emit/payloads.mjs`), so
 * there is exactly one definition of what a page contains.
 *
 * The stylesheet is assembled from the style guide's own files — see
 * `scripts/sync-style-guide.mjs` — plus the guide-defined additions in
 * site/css/guide.css. One request, no preprocessor, no dependency.
 *
 * Usage: node site/build.mjs [--only teams] [--limit 20]
 */

import { mkdir, writeFile, rm, cp, readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadContext } from '../pipeline/emit/context.mjs';
import * as payloads from '../pipeline/emit/payloads.mjs';
import { href, groupByStage } from '../pipeline/emit/lib.mjs';

import * as home from './templates/pages/home.js';
import * as seasons from './templates/pages/seasons.js';
import * as season from './templates/pages/season.js';
import * as seasonMatches from './templates/pages/season-matches.js';
import * as teams from './templates/pages/teams.js';
import * as teamHistory from './templates/pages/team-history.js';
import * as teamSeason from './templates/pages/team-season.js';
import * as match from './templates/pages/match.js';
import * as medals from './templates/pages/medals.js';
import * as insightsAll from './templates/pages/insights-all.js';
import * as insightsYear from './templates/pages/insights-year.js';
import * as search from './templates/pages/search.js';
import * as notFound from './templates/pages/not-found.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

/** The shared stylesheet budget. docs/web-style-guide §8. */
const CSS_BUDGET = 15 * 1024;

const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const limit = argv.includes('--limit') ? Number(argv[argv.indexOf('--limit') + 1]) : null;

/** tokens.css and components.css are copies of the guide's own files. */
const CSS_SOURCES = ['site/brand/tokens.css', 'site/css/components.css', 'site/css/guide.css'];

async function buildCss() {
  const parts = [];
  for (const rel of CSS_SOURCES) parts.push(await readFile(path.join(ROOT, rel), 'utf8'));
  return parts.join('\n');
}

/** Content hash for cache-busting the shared assets. */
function hashOf(...texts) {
  const h = createHash('sha256');
  for (const t of texts) h.update(t);
  return `?v=${h.digest('hex').slice(0, 8)}`;
}

async function main() {
  const ctx = await loadContext();

  const flagDir = path.join(ROOT, 'site', 'assets', 'flags');
  let flags = new Set();
  try {
    flags = new Set((await readdir(flagDir)).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)));
  } catch {
    console.warn('! no flags vendored — every team will render a code cell. Run `npm run flags`.');
  }

  const css = await buildCss();
  const js = await readFile(path.join(ROOT, 'site', 'assets', 'app.js'), 'utf8').catch(() => '');
  const assetHash = hashOf(css, js);

  // Plain data plus the two shared functions from lib.mjs, so a template has one
  // definition of a URL shape and one of the stage order — never its own copy.
  const tplCtx = {
    teamById: new Map(ctx.identity.teams.map((t) => [t.team_id, t])),
    flags,
    href,
    groupByStage,
    assetHash,
  };

  const routes = [];
  const add = (routePath, render) => routes.push({ path: routePath, render });

  // ── top level ─────────────────────────────────────────────────────────────
  add('/', () => home.render(payloads.homePayload(ctx), tplCtx));
  add('/seasons/', () => seasons.render(payloads.seasonsIndexPayload(ctx), tplCtx));
  add('/medals/', () => medals.render(payloads.medalTablePayload(ctx), tplCtx));
  add('/teams/', () => teams.render(payloads.teamsIndexPayload(ctx), tplCtx));
  add('/insights/', () => insightsAll.render(payloads.insightsAllPayload(ctx), tplCtx));
  add('/search/', () => search.render(payloads.searchIndexPayload(ctx), tplCtx));

  // ── seasons ───────────────────────────────────────────────────────────────
  for (const y of ctx.perYear) {
    const seasonPayload = payloads.seasonPayload(ctx, y.year);
    if (seasonPayload) add(`/seasons/${y.year}/`, () => season.render(seasonPayload, tplCtx));

    const matchesPayload = payloads.seasonMatchesPayload(ctx, y.year);
    if (matchesPayload) {
      add(`/seasons/${y.year}/matches/`, () => seasonMatches.render(matchesPayload, tplCtx));
    }

    const insightPayload = payloads.insightsYearPayload(ctx, y.year);
    if (insightPayload) add(`/insights/${y.year}/`, () => insightsYear.render(insightPayload, tplCtx));
  }

  // ── teams ─────────────────────────────────────────────────────────────────
  for (const team of ctx.identity.teams) {
    const historyPayload = payloads.teamHistoryPayload(ctx, team.team_id);
    add(`/teams/${team.team_id}/`, () => teamHistory.render(historyPayload, tplCtx));
  }

  for (const [teamId, years] of ctx.teamYears) {
    for (const year of years.keys()) {
      const p = payloads.teamSeasonPayload(ctx, teamId, year);
      if (!p) continue;
      add(`/teams/${teamId}/${year}/`, () => teamSeason.render(p, tplCtx));
    }
  }

  // ── matches ───────────────────────────────────────────────────────────────
  for (const matchId of ctx.matchById.keys()) {
    const p = payloads.matchPayload(ctx, matchId);
    if (!p) continue;
    // The route uses the STAGE name, never the raw tournamentKey. `match_id` is
    // "2025:t2:10"; the URL is /matches/2025/ranking/10/.
    add(`/matches/${p.year}/${p.stage}/${p.id}/`, () => match.render(p, tplCtx));
  }

  // ── render ────────────────────────────────────────────────────────────────
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  let written = 0;
  let bytes = 0;
  let failed = 0;

  for (const route of routes) {
    if (only && !route.path.split('/').filter(Boolean).includes(only)) continue;
    if (limit && written >= limit) break;

    try {
      const html = route.render();
      const out = path.join(DIST, route.path, 'index.html');
      await mkdir(path.dirname(out), { recursive: true });
      await writeFile(out, html, 'utf8');
      written++;
      bytes += Buffer.byteLength(html);
    } catch (err) {
      failed++;
      if (failed <= 5) console.error(`  FAIL ${route.path} — ${err.message}`);
    }
  }

  // ── assets ────────────────────────────────────────────────────────────────
  await cp(path.join(ROOT, 'site', 'assets'), path.join(DIST, 'assets'), { recursive: true });
  await writeFile(path.join(DIST, 'assets', 'app.css'), css, 'utf8');
  // Templates are published so live hydration can import the same modules the
  // build used — one renderer, not two.
  await cp(path.join(ROOT, 'site', 'templates'), path.join(DIST, 'tpl'), { recursive: true });

  const sampleTeams = ctx.identity.teams.filter((t) => t.seasons_active.length).slice(0, 8).map((t) => t.team_id);
  const notFoundHtml = notFound.render({ sample: sampleTeams }, tplCtx);
  await writeFile(path.join(DIST, '404.html'), notFoundHtml, 'utf8');

  // ── sitemap ───────────────────────────────────────────────────────────────
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...routes.map((r) => `  <url><loc>${r.path}</loc></url>`),
    '</urlset>',
  ].join('\n');
  await writeFile(path.join(DIST, 'sitemap.xml'), sitemap, 'utf8');

  // ── report ────────────────────────────────────────────────────────────────
  const cssBytes = Buffer.byteLength(css);
  console.log(`\n${written} pages  ·  ${(bytes / 1024 / 1024).toFixed(1)} MB  ·  ${routes.length} routes`);
  console.log(`css ${(cssBytes / 1024).toFixed(1)} KB of ${CSS_BUDGET / 1024} KB budget`);
  if (cssBytes > CSS_BUDGET) console.warn(`! shared CSS is over budget (§8)`);
  if (failed) console.error(`${failed} page(s) failed to render`);
  if (only) console.log(`(--only ${only}: ${written} of ${routes.length} routes)`);
  console.log(`asset hash ${assetHash}`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}\n${err.stack}`);
  process.exit(1);
});
