#!/usr/bin/env node
/**
 * Normalize the raw archive into the canonical shape.
 *
 * Reads pipeline/raw/, writes pipeline/normalized/. Nothing is published from
 * here — this layer exists so the shape can be inspected and tested on its own,
 * and so the published tree can be rebuilt without re-parsing raw payloads.
 *
 * Standings are normalized for EVERY season that has rankings; matches only for
 * seasons that have them. Which seasons are actually published is an emit-layer
 * decision (plan D1), not a normalization one.
 *
 * Usage: node pipeline/normalize/cli.mjs [--years 2023,2024,2025]
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIdentity } from './identity.mjs';
import { normalizeSeason } from './match.mjs';
import { normalizeStandings } from './standings.mjs';
import { normalizeAwards } from './awards.mjs';
import { normalizeAlliances } from './alliances.mjs';
import { SCHEMA_VERSION, RULE_VERSION } from './values.mjs';
import { readMatchDetails } from '../raw/match-details.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = path.join(ROOT, 'pipeline', 'raw', 'api');
const OUT = path.join(ROOT, 'pipeline', 'normalized');

const ALL_SEASONS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

function parseYears(argv) {
  const i = argv.indexOf('--years');
  if (i === -1) return ALL_SEASONS;
  return argv[i + 1].split(',').map(Number).filter((y) => ALL_SEASONS.includes(y));
}

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

/** Deterministic write: fixed indentation, trailing newline. */
async function writeJson(relPath, payload) {
  const abs = path.join(OUT, relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

async function main(argv) {
  const years = parseYears(argv);
  const identity = await loadIdentity();
  const seasonMeta = new Map(
    ((await readJson(path.join(ROOT, 'pipeline', 'lookups', 'seasons.json'))).seasons ?? [])
      .map((s) => [s.year, s]),
  );

  let problems = 0;

  for (const year of years) {
    let bundle;
    try {
      bundle = await readJson(path.join(RAW, String(year), 'season.json'));
    } catch {
      console.log(`\n${year}  no season bundle — run \`npm run fetch\` first, skipping`);
      continue;
    }

    const meta = seasonMeta.get(year);
    const hasMatches = (bundle.matches ?? []).length > 0;
    const hasRankings = (bundle.rankings ?? []).length > 0;

    if (!hasMatches && !hasRankings) {
      console.log(`\n${year}  empty upstream (coverage: ${meta?.data_coverage ?? 'none'}) — nothing to normalize`);
      continue;
    }

    const issues = [];

    // ---- matches (2023 onward) --------------------------------------------
    let matches = [];
    if (hasMatches) {
      const store = await readMatchDetails(year);
      const result = normalizeSeason(bundle, store.responses, identity, year);
      matches = result.matches;
      issues.push(...result.issues);

      await writeJson(path.join(String(year), 'matches.json'), {
        meta: {
          year,
          schema_version: SCHEMA_VERSION,
          rule_version: RULE_VERSION,
          match_count: matches.length,
          source: 'api.first.global',
        },
        matches,
      });

      const played = matches.filter((m) => m.played).length;
      const stages = {};
      for (const m of matches) stages[m.stage] = (stages[m.stage] ?? 0) + 1;

      console.log(
        `\n${year}  ${matches.length} matches  (${played} played, ${matches.length - played} unplayed)  ` +
          `·  ${Object.entries(stages).map(([k, v]) => `${k}=${v}`).join(' ')}`,
      );

      if (result.resultDisagreements.length) {
        console.log(
          `      upstream \`result\` disagrees with the score on ${result.resultDisagreements.length} match(es) — ` +
            `derived kept, upstream preserved`,
        );
      }
    } else {
      console.log(`\n${year}  rankings/awards only (coverage: ${meta?.data_coverage ?? '?'}) — no matches`);
    }

    // ---- playoff alliances (2022 onward, where the standings exist) --------
    if ((bundle.alliances_round_robin ?? []).length || (bundle.alliances_finals ?? []).length) {
      const { byStage, issues: allianceIssues } = normalizeAlliances(bundle, identity, year);
      issues.push(...allianceIssues);

      await writeJson(path.join(String(year), 'alliances.json'), {
        meta: {
          year,
          schema_version: SCHEMA_VERSION,
          rule_version: RULE_VERSION,
          stage_count: byStage.length,
          alliance_count: byStage.reduce((n, s) => n + s.count, 0),
          source: 'api.first.global',
        },
        stages: byStage,
      });

      console.log(
        `      alliances: ${byStage.map((s) => `${s.stage}=${s.count}`).join(' ')}`,
      );
    }

    // ---- awards (every season — the only uninterrupted series) -------------
    if ((bundle.awards ?? []).length) {
      const { awards, issues: awardIssues } = normalizeAwards(bundle, identity, year);
      issues.push(...awardIssues);

      await writeJson(path.join(String(year), 'awards.json'), {
        meta: {
          year,
          schema_version: SCHEMA_VERSION,
          rule_version: RULE_VERSION,
          award_count: awards.length,
          recipient_count: awards.reduce((n, a) => n + a.recipients.length, 0),
          source: 'api.first.global',
        },
        awards,
      });

      const classed = awards.reduce((n, a) => n + a.counts.classed, 0);
      const unclassed = awards.reduce((n, a) => n + a.counts.unclassed, 0);
      console.log(
        `      awards: ${awards.length}  ·  ${classed} classed recipients, ${unclassed} unclassed (no medal tier)`,
      );
    }

    // ---- standings (every season that has rankings) ------------------------
    if (hasRankings) {
      const standings = normalizeStandings(bundle, matches, identity, year, meta);
      issues.push(...standings.issues);

      await writeJson(path.join(String(year), 'standings.json'), {
        meta: {
          year,
          schema_version: SCHEMA_VERSION,
          rule_version: RULE_VERSION,
          row_count: standings.standings.length,
          record_source: matches.length ? 'matches' : (standings.standings[0]?.record_source ?? null),
          source: 'api.first.global',
        },
        standings: standings.standings,
      });

      const source = standings.standings[0]?.record_source ?? 'none';
      console.log(
        `      standings: ${standings.standings.length} rows  ·  record from: ${source}` +
          (source === 'none' ? ' (upstream record is unusable for this season)' : ''),
      );
    }

    if (issues.length) {
      problems += issues.length;
      for (const i of issues) console.log(`      !! [${i.kind}] ${i.message}`);
    }
  }

  if (problems) {
    // Reported, not fatal: these are upstream defects the pipeline is designed
    // to surface, and the emit layer decides what to withhold.
    console.log(`\n${problems} upstream data issue(s) reported — see above.`);
  }
  console.log('\nOK — normalized output written to pipeline/normalized/');
}

main(process.argv.slice(2)).catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
