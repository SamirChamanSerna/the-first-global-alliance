/**
 * The loaded archive, in memory.
 *
 * One object holding every season's normalized data plus the hand-maintained
 * lookups, with the team→year indexes prebuilt. Both consumers of this data
 * share it:
 *
 *   pipeline/emit/cli.mjs   writes it out to data/v<N>/
 *   site/build.mjs          inlines it into HTML
 *
 * Neither re-derives anything from the other. The build does NOT read `data/` —
 * that tree is the runtime surface for browsers, not an input for the build.
 * If it did, there would be two implementations of "what a team-season page
 * contains", which is exactly the duplication a shared context exists to avoid.
 */

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownerConfig, loadOverlay } from './inputs.mjs';
import { tallyAwards } from '../normalize/awards.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NORM = path.join(ROOT, 'pipeline', 'normalized');
const LOOKUPS = path.join(ROOT, 'pipeline', 'lookups');

const exists = (p) => access(p).then(() => true, () => false);

async function readJson(p, fallback = null) {
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function loadContext() {
  const config = await ownerConfig();
  const seasons = (await readJson(path.join(LOOKUPS, 'seasons.json'))).seasons;
  const identity = await readJson(path.join(LOOKUPS, 'team-identity.json'));
  const teamById = new Map(identity.teams.map((t) => [t.team_id, t]));

  const perYear = [];
  for (const meta of seasons) {
    const dir = path.join(NORM, String(meta.year));
    if (!(await exists(dir))) continue;
    perYear.push({
      year: meta.year,
      meta,
      standings: (await readJson(path.join(dir, 'standings.json')))?.standings ?? [],
      awards: (await readJson(path.join(dir, 'awards.json')))?.awards ?? [],
      alliances: (await readJson(path.join(dir, 'alliances.json')))?.stages ?? [],
      matches: (await readJson(path.join(dir, 'matches.json')))?.matches ?? [],
      overlay: await loadOverlay(meta.year),
    });
  }

  // ── team → year → slice ───────────────────────────────────────────────────
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

  // ── match lookup by id ────────────────────────────────────────────────────
  const matchById = new Map();
  for (const y of perYear) {
    for (const m of y.matches) matchById.set(m.match_id, { match: m, year: y });
  }

  const awardTally = tallyAwards(perYear.map((y) => ({ year: y.year, awards: y.awards })));

  return {
    config,
    root: ROOT,
    seasons,
    identity,
    teamById,
    perYear,
    teamYears,
    matchById,
    awardTally,
    metaByYear: new Map(seasons.map((s) => [s.year, s])),
    yearData: new Map(perYear.map((y) => [y.year, y])),
  };
}
