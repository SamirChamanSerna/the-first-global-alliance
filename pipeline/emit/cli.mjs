#!/usr/bin/env node
/**
 * Write the published archive to data/v<N>/.
 *
 * This file only decides WHICH payloads to write and WHERE. What each payload
 * contains is defined once, in payloads.mjs, and shared with the site build —
 * so a season page is described in exactly one place whether it is being
 * written to disk or inlined into HTML.
 *
 * The tree is the RUNTIME surface: what a browser fetches, and what the live
 * origin mirrors. The build does not read it.
 *
 * Usage: node pipeline/emit/cli.mjs
 */

import { writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContext } from './context.mjs';
import { json, href } from './lib.mjs';
import {
  seasonsIndexPayload,
  seasonPayload,
  seasonMatchesPayload,
  seasonStandingsPayload,
  teamHistoryPayload,
  teamSeasonPayload,
  medalTablePayload,
  insightsAllPayload,
  insightsYearPayload,
  searchIndexPayload,
  publishesCompetition,
} from './payloads.mjs';
import { runChecks } from '../quality/checks.mjs';

const ROOT = path.resolve(path.dirname(import.meta.url.replace('file:///', '')), '..', '..');

/** Write a file, creating its directory. Paths are relative to the output root. */
async function write(outDir, relPath, payload) {
  const abs = path.join(outDir, relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, json(payload), 'utf8');
}

async function main() {
  // ── the gate ──────────────────────────────────────────────────────────────
  // Nothing is removed or written if the data has a defect. Publishing a wrong
  // number is worse than publishing nothing new, and the previous deploy stays
  // live when this exits non-zero.
  const { findings } = await runChecks();
  if (findings.errors.length) {
    console.error(`${findings.errors.length} data-quality error(s) — refusing to emit.\n`);
    for (const e of findings.errors.slice(0, 10)) console.error(`  [${e.check}] ${e.message}`);
    if (findings.errors.length > 10) console.error(`  … and ${findings.errors.length - 10} more`);
    console.error('\nRun `npm run quality` for the full report.');
    process.exit(1);
  }

  const ctx = await loadContext();
  const version = ctx.config.data_version;
  const DATA = path.join(ctx.root, 'data');
  const OUT = path.join(DATA, `v${version}`);

  // Rebuild from scratch so a removed season cannot linger.
  await rm(DATA, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const published = [];

  for (const y of ctx.perYear) {
    const year = y.year;
    const season = seasonPayload(ctx, year);
    if (!season) continue;

    const matches = seasonMatchesPayload(ctx, year);
    const standings = seasonStandingsPayload(ctx, year);

    if (matches) await write(OUT, path.join('seasons', String(year), 'matches.json'), matches);
    if (standings) await write(OUT, path.join('seasons', String(year), 'standings.json'), standings);
    await write(OUT, path.join('seasons', String(year), 'index.json'), season);

    published.push({
      year,
      coverage: season.coverage,
      matches: season.counts.matches,
      standings: season.standings_available ? season.counts.teams : 0,
      awards: season.counts.awards,
    });
  }

  for (const team of ctx.identity.teams) {
    await write(OUT, path.join('teams', team.team_id, 'index.json'), teamHistoryPayload(ctx, team.team_id));
  }

  let seasonFiles = 0;
  for (const [teamId, years] of ctx.teamYears) {
    for (const year of years.keys()) {
      const payload = teamSeasonPayload(ctx, teamId, year);
      if (!payload) continue;
      await write(OUT, path.join('teams', teamId, `${year}.json`), payload);
      seasonFiles++;
    }
  }

  await write(OUT, 'seasons.json', seasonsIndexPayload(ctx));
  await write(OUT, 'teams.json', { teams: ctx.identity.teams });

  const medals = medalTablePayload(ctx);
  await write(OUT, 'medals.json', medals);

  // Insights: one all-time file plus one per season that publishes competition
  // data. The season files are shaped by insights.mjs, not by a template.
  const insightsAll = insightsAllPayload(ctx);
  await write(OUT, path.join('insights', 'index.json'), insightsAll);
  const insightYears = [];
  for (const y of ctx.perYear) {
    const payload = insightsYearPayload(ctx, y.year);
    if (!payload) continue;
    await write(OUT, path.join('insights', `${y.year}.json`), payload);
    insightYears.push(y.year);
  }

  const searchIndex = searchIndexPayload(ctx);
  await write(OUT, 'search-index.json', searchIndex);

  await write(DATA, 'manifest.json', {
    data_version: version,
    active_season: ctx.config.active_season,
    live_years: ctx.config.live_years,
    seasons: ctx.seasons.map((s) => s.year),
    match_seasons: published.filter((p) => publishesCompetition(ctx.metaByYear.get(p.year))).map((p) => p.year),
    team_count: ctx.identity.teams.length,
    counts: {
      seasons_published: published.length,
      matches_total: published.reduce((n, p) => n + p.matches, 0),
      teams_with_history: ctx.identity.teams.length,
      team_season_pages: seasonFiles,
      medal_rows: medals.row_count,
      insight_seasons: insightYears.length,
      search_teams: searchIndex.count,
    },
    links: {
      seasons: href.seasons(),
      teams: '/teams/',
      medals: href.medals(),
      insights: href.insights(),
      search: '/search/',
    },
  });

  // ── report ────────────────────────────────────────────────────────────────
  console.log(`data/v${version}/  —  ${published.length} seasons published\n`);
  console.log('year  coverage      matches  standings  awards');
  console.log('-'.repeat(48));
  for (const p of published) {
    console.log(
      String(p.year).padEnd(6) + String(p.coverage).padEnd(14) +
      String(p.matches || '—').padEnd(9) + String(p.standings || '—').padEnd(11) + String(p.awards || '—'),
    );
  }
  console.log(`\nteams: ${ctx.identity.teams.length} history pages, ${seasonFiles} team-season pages`);
  console.log(`medals: ${medals.row_count} teams with at least one award`);
  console.log(`insights: all-time + ${insightYears.length} season file(s); search index: ${searchIndex.count} teams`);
  console.log(`\nwrote data/v${version}/ and data/manifest.json`);
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
