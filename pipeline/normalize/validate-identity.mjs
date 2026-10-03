#!/usr/bin/env node
/**
 * Validate every countryCode in the raw archive against the identity registry.
 *
 * The registry was built from `rankings`, `round_robin` and `finals`. Match
 * participants are a different code path — six per match, roughly 6,800 records
 * across 2023–2025 — and nothing has yet proved they use the same code space. A
 * single code that appears only in participants would be attributed silently
 * until someone noticed a wrong win rate.
 *
 * This is the check that closes that gap. It exits non-zero on any problem, so
 * it can gate the pipeline.
 *
 * Usage: node pipeline/normalize/validate-identity.mjs
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIdentity, tryResolveTeamId, assertNoSeasonCollisions, normalizeCode } from './identity.mjs';
import { readMatchDetails } from '../raw/match-details.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = path.join(ROOT, 'pipeline', 'raw', 'api');

const MATCH_YEARS = [2023, 2024, 2025, 2026];
const ALL_SEASONS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

const readJson = async (p, fallback = null) => {
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return fallback;
  }
};

/** year -> Map(code -> { sources:Set, names:Set, count }) */
async function collectObservations() {
  const byYear = new Map();
  const note = (year, code, source, name) => {
    if (!code) return;
    const key = normalizeCode(code);
    if (!byYear.has(year)) byYear.set(year, new Map());
    const perCode = byYear.get(year);
    if (!perCode.has(key)) perCode.set(key, { sources: new Set(), names: new Set(), count: 0 });
    const rec = perCode.get(key);
    rec.sources.add(source);
    if (name) rec.names.add(String(name).trim());
    rec.count++;
  };

  for (const year of ALL_SEASONS) {
    const bundle = await readJson(path.join(RAW, String(year), 'season.json'));
    if (!bundle) continue;

    for (const key of ['rankings', 'round_robin', 'finals']) {
      for (const row of bundle[key] ?? []) note(year, row.team?.countryCode, key, row.team?.name);
    }
    for (const key of ['alliances_round_robin', 'alliances_finals']) {
      for (const alliance of bundle[key] ?? []) {
        for (const slot of ['captain', 'pick1', 'pick2', 'pick3']) {
          note(year, alliance[slot]?.team?.countryCode, key, alliance[slot]?.team?.name);
        }
      }
    }
    for (const match of bundle.matches ?? []) {
      for (const p of match.participants ?? []) {
        note(year, p.countryCode, 'matches[].participants', p.country);
      }
    }
  }

  // Per-match details: a separate payload shape reached by a separate code path,
  // so it is checked separately. If a season's store is missing, say so — a
  // silent skip here would quietly stop validating participants, which is the
  // one thing this script exists to do.
  for (const year of MATCH_YEARS) {
    const store = await readMatchDetails(year);
    const matches = Object.values(store.responses ?? {});
    if (!matches.length) {
      console.warn(`  !  ${year}  no match-details store — participants NOT validated for this season`);
      continue;
    }
    for (const match of matches) {
      for (const p of match?.participants ?? []) {
        note(year, p.countryCode, 'match-detail.participants', p.country);
      }
    }
    console.log(`     ${year}  ${matches.length} stored matches checked`);
  }

  return byYear;
}

async function main() {
  const identity = await loadIdentity();
  const byYear = await collectObservations();

  console.log(`identity registry : ${identity.teams.length} teams`);
  console.log(`override seasons  : ${[...identity.seasonOverrides.keys()].sort().join(', ')}`);

  let totalObservations = 0;
  const unresolved = [];
  const resolutionCounts = new Map();

  console.log('\n--- resolution by season ---');
  for (const [year, perCode] of [...byYear].sort((a, b) => a[0] - b[0])) {
    let resolved = 0;
    for (const [code, rec] of perCode) {
      totalObservations += rec.count;
      const r = tryResolveTeamId(identity, year, code);
      if (r.ok) {
        resolved += rec.count;
        resolutionCounts.set(r.teamId, (resolutionCounts.get(r.teamId) ?? 0) + rec.count);
      } else {
        unresolved.push({ year, code, names: [...rec.names], sources: [...rec.sources], error: r.error });
      }
    }
    const teams = new Set();
    for (const code of perCode.keys()) {
      const r = tryResolveTeamId(identity, year, code);
      if (r.ok) teams.add(r.teamId);
    }
    console.log(
      `  ${year}  ${String(perCode.size).padStart(3)} codes  ${String(teams.size).padStart(3)} teams  ` +
      `${String(resolved).padStart(5)}/${String([...perCode.values()].reduce((s, r) => s + r.count, 0)).padEnd(5)} observations resolved`,
    );
  }

  // The assertion the registry exists for.
  const observations = new Map([...byYear].map(([y, m]) => [y, [...m.keys()]]));
  const collisions = assertNoSeasonCollisions(identity, observations);

  console.log(`\ntotal observations: ${totalObservations}`);

  if (unresolved.length) {
    console.log(`\n!! ${unresolved.length} UNRESOLVED CODE(S) — these would be dropped or misattributed:`);
    for (const u of unresolved) {
      console.log(`   ${u.year}  "${u.code}"  seen in ${u.sources.join(', ')}  (${u.names.join(' | ')})`);
      console.log(`        ${u.error}`);
    }
  }
  if (collisions.length) {
    console.log(`\n!! ${collisions.length} SEASON COLLISION(S):`);
    for (const c of collisions) console.log(`   ${c}`);
  }

  if (!unresolved.length && !collisions.length) {
    console.log('\nOK — every observed code resolves to exactly one team per season.');
    process.exit(0);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
