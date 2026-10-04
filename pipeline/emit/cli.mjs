#!/usr/bin/env node
/**
 * Emit the published archive from the normalized layer.
 *
 * Reads pipeline/normalized/ and pipeline/lookups/, writes data/v<N>/.
 * Everything here is page-shaped: each file holds what one page renders, so no
 * template ever joins or filters across datasets.
 *
 *   data/manifest.json                      unversioned — how a client finds N
 *   data/v<N>/seasons.json                  seasons index
 *   data/v<N>/teams.json                    the team registry
 *   data/v<N>/seasons/<year>/index.json     the Season page
 *   data/v<N>/seasons/<year>/matches.json   the season match list
 *   data/v<N>/seasons/<year>/standings.json the standings table
 *   data/v<N>/teams/<id>/index.json         the Team History page
 *   data/v<N>/teams/<id>/<year>.json        the Team/Season page
 *   data/v<N>/medals.json                   the all-time medal table
 *
 * Usage: node pipeline/emit/cli.mjs
 */

import { readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownerConfig, loadOverlay } from './inputs.mjs';
import { href, json, compactMatchRow, byStageThenId, groupByStage } from './lib.mjs';
import { buildTeamHistory, buildTeamSeason } from './teams.mjs';
import { buildMedalTable } from './medals.mjs';
import { tallyAwards } from '../normalize/awards.mjs';
import { runChecks } from '../quality/checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NORM = path.join(ROOT, 'pipeline', 'normalized');
const LOOKUPS = path.join(ROOT, 'pipeline', 'lookups');

const TOP_N_STANDINGS = 10;

const exists = (p) => access(p).then(() => true, () => false);
const readJson = async (p, fallback = null) => {
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return fallback;
  }
};

/** Write a file, creating its directory. Paths are relative to data/v<N>/. */
async function write(outDir, relPath, payload) {
  const abs = path.join(outDir, relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, json(payload), 'utf8');
}

async function main() {
  const config = await ownerConfig();

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

  const version = config.data_version;
  const DATA = path.join(ROOT, 'data');
  const OUT = path.join(DATA, `v${version}`);

  const seasons = (await readJson(path.join(LOOKUPS, 'seasons.json'))).seasons;
  const identity = await readJson(path.join(LOOKUPS, 'team-identity.json'));
  const teamById = new Map(identity.teams.map((t) => [t.team_id, t]));

  // Rebuild from scratch so a removed season cannot linger.
  await rm(DATA, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // ── load every season once ────────────────────────────────────────────────
  const perYear = [];
  for (const meta of seasons) {
    const year = meta.year;
    const dir = path.join(NORM, String(year));
    if (!(await exists(dir))) continue;

    const overlay = await loadOverlay(year);
    perYear.push({
      year,
      meta,
      standings: (await readJson(path.join(dir, 'standings.json')))?.standings ?? [],
      awards: (await readJson(path.join(dir, 'awards.json')))?.awards ?? [],
      alliances: (await readJson(path.join(dir, 'alliances.json')))?.stages ?? [],
      matches: (await readJson(path.join(dir, 'matches.json')))?.matches ?? [],
      overlay,
    });
  }

  // ── indexes: team -> year -> slice ────────────────────────────────────────
  /** teamId -> Map(year -> { standing, awards, alliance, matches }) */
  const teamYears = new Map();
  const touch = (teamId, year) => {
    if (!teamYears.has(teamId)) teamYears.set(teamId, new Map());
    const m = teamYears.get(teamId);
    if (!m.has(year)) m.set(year, { standing: null, awards: [], alliance: null, matches: [] });
    return m.get(year);
  };

  for (const y of perYear) {
    for (const standing of y.standings) touch(standing.team_id, y.year).standing = standing;

    for (const award of y.awards) {
      for (const r of award.recipients) {
        if (r.kind !== 'team') continue; // a person's award is not a country's
        touch(r.team_id, y.year).awards.push({
          name: award.name,
          class: r.class,
          sort_order: award.sort_order,
        });
      }
    }

    for (const { stage, alliances } of y.alliances) {
      for (const alliance of alliances) {
        for (const m of alliance.members) {
          // Finals supersede the round robin for a team that reached both.
          const slot = touch(m.team_id, y.year);
          if (stage === 'finals' || !slot.alliance) {
            slot.alliance = {
              stage,
              alliance_name: alliance.name,
              alliance_rank: alliance.rank,
              role: m.role,
              is_captain: m.is_captain,
              pick_order: m.pick_order,
            };
          }
        }
      }
    }

    for (const match of y.matches) {
      for (const p of [...match.alliances.red, ...match.alliances.blue]) {
        touch(p.team_id, y.year).matches.push(match);
      }
    }
  }

  // ── season artifacts ──────────────────────────────────────────────────────
  const published = [];
  for (const y of perYear) {
    const { year, meta } = y;

    // `data_coverage` is the switch, not the year. Plan D1 publishes competition
    // data only where the record is trustworthy; templates branch on this value
    // and never on `year === 2025`.
    const publishCompetition = meta.data_coverage === 'full';
    const standings = publishCompetition ? y.standings : [];
    const matches = publishCompetition ? y.matches : [];

    const rows = matches.slice().sort(byStageThenId)
      .map((m) => compactMatchRow(m, { overlay: y.overlay, seasonMeta: meta }));

    if (rows.length) {
      await write(OUT, path.join('seasons', String(year), 'matches.json'), {
        year,
        stages: groupByStage(matches.slice().sort(byStageThenId)
          .map((m) => compactMatchRow(m, { overlay: y.overlay, seasonMeta: meta }))),
      });
    }

    if (standings.length) {
      await write(OUT, path.join('seasons', String(year), 'standings.json'), {
        year,
        record_source: standings[0]?.record_source ?? null,
        row_count: standings.length,
        standings,
      });
    }

    await write(OUT, path.join('seasons', String(year), 'index.json'), {
      year,
      meta: {
        host_city: meta.host_city,
        host_country: meta.host_country,
        start_date: meta.start_date,
        end_date: meta.end_date,
        theme: meta.theme,
        game_name: meta.game_name,
        ranking_stat_name: meta.ranking_stat_name,
        ranking_stat_key: meta.ranking_stat_key,
        synopsis: meta.synopsis,
        score_formula: meta.score_formula,
      },
      coverage: meta.data_coverage,
      upstream_coverage: meta.upstream_coverage ?? null,
      standings_top: standings.slice(0, TOP_N_STANDINGS),
      standings_available: standings.length > 0,
      awards: y.awards,
      counts: { teams: standings.length, matches: rows.length, awards: y.awards.length },
      links: {
        matches: rows.length ? href.seasonMatches(year) : null,
        standings: standings.length ? href.seasonStandings(year) : null,
        calculator: meta.ranking_stat_key ? href.calculator(year) : null,
        insights: href.insightsYear(year),
        self: href.season(year),
      },
    });

    published.push({ year, coverage: meta.data_coverage, matches: rows.length, standings: standings.length, awards: y.awards.length });
  }

  // ── team artifacts ────────────────────────────────────────────────────────
  const awardTally = tallyAwards(perYear.map((y) => ({ year: y.year, awards: y.awards })));
  let teamFiles = 0;
  let seasonFiles = 0;

  for (const team of identity.teams) {
    const years = teamYears.get(team.team_id);

    const history = buildTeamHistory(
      team,
      perYear.map((y) => {
        const slice = years?.get(y.year);
        return {
          year: y.year,
          meta: y.meta,
          standing: slice?.standing ?? null,
          awards: slice?.awards ?? [],
          alliance: slice?.alliance ?? null,
        };
      }),
      awardTally.get(team.team_id) ?? null,
    );

    // Every registry team gets a history page — including the 44 that have never
    // competed. A team the registry knows about must not 404.
    await write(OUT, path.join('teams', team.team_id, 'index.json'), history ?? {
      team_id: team.team_id,
      team,
      career: null,
      timeline: [],
      awards: [],
      never_competed: true,
    });
    teamFiles++;

    for (const y of perYear) {
      const slice = years?.get(y.year);
      if (!slice) continue;
      const payload = buildTeamSeason(team, {
        year: y.year,
        meta: y.meta,
        standing: slice.standing,
        awards: slice.awards,
        alliance: slice.alliance,
        matches: slice.matches,
        videoOpts: { overlay: y.overlay, seasonMeta: y.meta },
      });
      if (!payload) continue;
      await write(OUT, path.join('teams', team.team_id, `${y.year}.json`), payload);
      seasonFiles++;
    }
  }

  // ── registries and aggregate views ────────────────────────────────────────
  await write(OUT, 'seasons.json', {
    seasons: seasons.map((s) => ({
      year: s.year,
      host_city: s.host_city,
      host_country: s.host_country,
      start_date: s.start_date,
      end_date: s.end_date,
      theme: s.theme,
      game_name: s.game_name,
      ranking_stat_name: s.ranking_stat_name,
      data_coverage: s.data_coverage,
      href: href.season(s.year),
    })),
  });

  await write(OUT, 'teams.json', { teams: identity.teams });

  const medals = buildMedalTable(awardTally);
  await write(OUT, 'medals.json', {
    generated_for: perYear.map((y) => y.year),
    ...medals,
  });

  await write(
    path.join(DATA),
    'manifest.json',
    {
      data_version: version,
      active_season: config.active_season,
      live_years: config.live_years,
      seasons: seasons.map((s) => s.year),
      match_seasons: published.filter((p) => p.matches).map((p) => p.year),
      team_count: identity.teams.length,
      counts: {
        seasons_published: published.length,
        matches_total: published.reduce((n, p) => n + p.matches, 0),
        teams_with_history: teamFiles,
        team_season_pages: seasonFiles,
        medal_rows: medals.row_count,
      },
      links: {
        seasons: '/seasons/',
        teams: '/teams/',
        medals: href.medals(),
        insights: href.insights(),
      },
    },
  );

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
  console.log(`\nteams: ${teamFiles} history pages, ${seasonFiles} team-season pages`);
  console.log(`medals: ${medals.row_count} teams with at least one award`);
  console.log(`\nwrote data/v${version}/ and data/manifest.json`);
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
