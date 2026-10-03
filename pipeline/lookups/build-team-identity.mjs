#!/usr/bin/env node
/**
 * Build / refresh pipeline/lookups/team-identity.json.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE IS GENERATED BUT NOT "DERIVED AT BUILD TIME"
 *
 * The committed team-identity.json is AUTHORITATIVE. The site build reads it and
 * never regenerates it. This script only proposes an updated version for a human
 * to review in a diff and commit. A derived identity map changes silently when
 * upstream data changes, and "silently" is exactly how identity bugs fail.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE CENTRAL PROBLEM, RESTATED CORRECTLY
 *
 * docs/discovery/02-data-model.md says: "the cross-season join key is the
 * normalized countryCode. Never teamKey."
 *
 * That is true for almost every code and false for at least one — the worst
 * property a join key can have. Verified against the live archive 2017–2025:
 *
 *   countryCode "15"  →  "Team Asia"       in 2017        (a continental team)
 *                         "Chinese Taipei" in 2024, 2025
 *
 *   Chinese Taipei also appears as "TW" in 2017–2018, and the all-time registry
 *   spells it "tw". So not only was a code reused — one entity also moved
 *   between codes.
 *
 *   countryCode "10"  →  "Refugees" (2017), then "Team Hope" (2018+). Same
 *   entity, renamed; the registry confirms it as "Team Hope (Refugees)".
 *
 * The 2017 season assigned 10–16 to continental and refugee teams, and those
 * numbers sit inside the space later used for other purposes. Only "15" collides
 * in the data we hold; 11, 12, 13, 14 and 16 are latent collisions that would
 * appear without warning in a future season.
 *
 * THE RULE THAT FOLLOWS
 *
 *   countryCode is unique WITHIN a season, not ACROSS seasons.
 *
 *   Resolution is therefore resolve(year, countryCode) -> team_id: a global
 *   alias table as the default, plus a tiny per-season override table (7 entries
 *   today) for the exceptions. That override table is the reason this registry
 *   exists at all.
 *
 * Usage:
 *   node pipeline/lookups/build-team-identity.mjs --report   # propose, write nothing
 *   node pipeline/lookups/build-team-identity.mjs           # write the file
 *   node pipeline/lookups/build-team-identity.mjs --no-seed # skip the ISO country seed
 */

import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = path.join(ROOT, 'pipeline', 'raw', 'api');
const OUT = path.join(ROOT, 'pipeline', 'lookups', 'team-identity.json');

const ALL_SEASONS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const REPORT_ONLY = process.argv.includes('--report');
const NO_SEED = process.argv.includes('--no-seed');

const FLAG_ICONS_COUNTRIES =
  'https://raw.githubusercontent.com/lipis/flag-icons/main/country.json';

const upper = (s) => String(s ?? '').trim().toUpperCase();
const exists = (p) => access(p).then(() => true, () => false);

// ---------------------------------------------------------------------------
// The exception tables. Everything here is a deliberate, reviewed decision.

/**
 * Codes 11–16 were assigned to continental teams in 2017 and are never valid
 * outside the seasons listed in SEASON_OVERRIDES. If one appears anywhere else,
 * that is a signal to stop and look, not to guess.
 */
const CONTESTED_CODES = new Set(['11', '12', '13', '14', '15', '16']);

const CONTINENTAL_TEAMS = {
  'south-america': { name: 'South America', display_name: 'Team South America' },
  'oceania': { name: 'Oceania', display_name: 'Team Oceania' },
  'north-america': { name: 'North America', display_name: 'Team North America' },
  'europe': { name: 'Europe', display_name: 'Team Europe' },
  'asia': { name: 'Asia', display_name: 'Team Asia' },
  'africa': { name: 'Africa', display_name: 'Team Africa' },
};

/**
 * Non-country entities the registry lists, but whose entity_type a name alone
 * cannot infer: `hope` arrives from the registry as if it were a country.
 */
const ENTITY_OVERRIDES = {
  hope: { entity_type: 'refugee', name: 'Hope', display_name: 'Team Hope (Refugees)' },
};

/**
 * season -> code -> team_id. The exceptions to the alias table.
 *
 * The continental teams ran in 2017 AND 2018 — not 2017 only, as
 * docs/discovery/02-data-model.md §3.2 states. Team Asia is the exception: code
 * 15 was Asia in 2017 and did not appear in 2018 at all, then the same number was
 * reassigned to Chinese Taipei in 2024.
 */
const SEASON_OVERRIDES = {
  2017: {
    '11': 'south-america',
    '12': 'oceania',
    '13': 'north-america',
    '14': 'europe',
    '15': 'asia',
    '16': 'africa',
  },
  2018: {
    '11': 'south-america',
    '12': 'oceania',
    '13': 'north-america',
    '14': 'europe',
    '16': 'africa',
  },
  2024: { '15': 'tw' },
  2025: { '15': 'tw' },
};

/**
 * Codes whose upstream spelling is not a usable slug.
 * The registry calls the refugee team "10_hope"; season data calls it "10".
 */
const CODE_TO_TEAM_ID = { '10_HOPE': 'hope', '10': 'hope' };

// ---------------------------------------------------------------------------

async function loadJson(p, fallback = null) {
  if (!(await exists(p))) return fallback;
  return JSON.parse(await readFile(p, 'utf8'));
}

/** season -> code -> { names, teamKeys } */
async function collectObservations() {
  const bySeason = new Map();

  for (const year of ALL_SEASONS) {
    const bundle = await loadJson(path.join(RAW, String(year), 'season.json'));
    if (!bundle) continue;

    const perCode = new Map();
    const add = (team) => {
      if (!team?.countryCode) return;
      const code = upper(team.countryCode);
      if (!perCode.has(code)) perCode.set(code, { names: new Set(), teamKeys: new Set() });
      const rec = perCode.get(code);
      if (team.name) rec.names.add(String(team.name).trim());
      if (team.teamKey !== undefined) rec.teamKeys.add(team.teamKey);
    };

    for (const row of [...(bundle.rankings ?? []), ...(bundle.round_robin ?? []), ...(bundle.finals ?? [])]) {
      add(row.team);
    }
    for (const key of ['alliances_round_robin', 'alliances_finals']) {
      for (const alliance of bundle[key] ?? []) {
        for (const slot of ['captain', 'pick1', 'pick2', 'pick3']) add(alliance[slot]?.team);
      }
    }
    bySeason.set(year, perCode);
  }
  return bySeason;
}

/** The ISO country list, so entities with no archive data are still representable. */
async function fetchCountrySeed() {
  if (NO_SEED) return null;
  try {
    const res = await fetch(FLAG_ICONS_COUNTRIES, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // flag-icons ships an array of { code, name, iso, continent, ... }. The set
    // also contains non-country entities (eu, un, arab, nato, …) marked iso:false;
    // those are not teams we would ever archive, so only iso entries are seeded.
    if (!Array.isArray(data)) throw new Error('unexpected shape');
    const countries = {};
    for (const entry of data) {
      if (!entry?.iso || !entry?.code || !entry?.name) continue;
      countries[String(entry.code).toLowerCase()] = String(entry.name);
    }
    if (!Object.keys(countries).length) throw new Error('no iso entries parsed');
    return countries;
  } catch (err) {
    console.warn(`  (country seed unavailable: ${err.message} — continuing with observed entities only)`);
    return null;
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const registry = (await loadJson(path.join(RAW, 'teams.json'), [])) ?? [];
  const bySeason = await collectObservations();
  const previous = await loadJson(OUT, null);
  const seed = await fetchCountrySeed();

  console.log(`registry entries        : ${registry.length}`);
  console.log(`seasons with data       : ${[...bySeason.keys()].join(', ')}`);
  console.log(`country seed            : ${seed ? `${Object.keys(seed).length} ISO entries` : 'none'}`);
  console.log(`existing registry file  : ${previous ? `${previous.teams?.length ?? 0} teams — will merge` : 'none — first run'}`);

  // ---- default code -> team_id, from the all-time registry -----------------
  const defaultCodeToTeamId = new Map();
  const teams = new Map(); // team_id -> record

  const ensureTeam = (teamId, init = {}) => {
    if (!teams.has(teamId)) {
      teams.set(teamId, {
        team_id: teamId,
        name: '',
        display_name: '',
        entity_type: 'country',
        iso2: null,
        code3: null,
        aliases: { country_code: [], name: [] },
        first_season: null,
        seasons_active: [],
        notes: '',
        ...init,
      });
    }
    return teams.get(teamId);
  };

  // Preserve hand edits across runs. Only fields a human is expected to touch:
  // `entity_type` is not one of them — it comes from the curated tables below,
  // and carrying it forward would let an earlier mistake become permanent.
  const handEdits = new Map();
  for (const t of previous?.teams ?? []) {
    handEdits.set(t.team_id, { name: t.name, display_name: t.display_name, notes: t.notes });
  }

  for (const entry of registry) {
    const rawCode = String(entry.countryCode ?? '');
    const teamId = CODE_TO_TEAM_ID[upper(rawCode)] ?? rawCode.toLowerCase();
    if (!teamId) continue;

    const iso2 = /^[A-Za-z]{2}$/.test(rawCode) ? rawCode.toLowerCase() : null;
    // Upstream's 3-letter code is IOC-style (Taiwan is TPE, not ISO's TWN), so it
    // is stored as `code3` — a display code — not mislabelled as ISO 3166-1 alpha-3.
    const code3 = /^[A-Za-z]{3}$/.test(String(entry.country ?? '')) ? upper(entry.country) : null;

    const team = ensureTeam(teamId);
    if (!team.name) team.name = entry.name?.replace(/^Team\s+/, '') || rawCode;
    if (!team.display_name) team.display_name = entry.name || team.name;
    team.iso2 ??= iso2;
    team.code3 ??= code3;

    const code = upper(rawCode);
    if (!team.aliases.country_code.includes(code)) team.aliases.country_code.push(code);
    defaultCodeToTeamId.set(code, teamId);
  }

  // "10" is spelled "10_hope" in the registry but "10" in season data.
  defaultCodeToTeamId.set('10', 'hope');

  // ---- 2017 continental teams, which are absent from the registry ----------
  for (const [teamId, init] of Object.entries(CONTINENTAL_TEAMS)) {
    const team = ensureTeam(teamId, { entity_type: 'continental' });
    Object.assign(team, init);
  }

  // ---- ISO seed: entities that have never appeared -------------------------
  let seeded = 0;
  if (seed) {
    for (const [code, name] of Object.entries(seed)) {
      const teamId = code.toLowerCase();
      if (teams.has(teamId)) continue;
      ensureTeam(teamId, {
        name,
        display_name: `Team ${name}`,
        iso2: teamId,
        entity_type: 'country',
      });
      seeded++;
    }
  }

  // ---- resolve every observation, honouring the overrides ------------------
  const unresolved = [];
  const contestedMisuse = [];

  for (const [year, perCode] of [...bySeason].sort((a, b) => a[0] - b[0])) {
    for (const [code, obs] of perCode) {
      const override = SEASON_OVERRIDES[year]?.[code];
      let teamId = override ?? defaultCodeToTeamId.get(code);

      if (!override && CONTESTED_CODES.has(code)) {
        contestedMisuse.push({ year, code, names: [...obs.names] });
        continue;
      }
      if (!teamId) {
        unresolved.push({ year, code, names: [...obs.names] });
        continue;
      }

      const team = ensureTeam(teamId);
      if (!team.aliases.country_code.includes(code)) team.aliases.country_code.push(code);
      for (const n of obs.names) {
        if (!team.aliases.name.includes(n)) team.aliases.name.push(n);
        team.name ||= n.replace(/^Team\s+/, '');
      }
      if (!team.seasons_active.includes(year)) team.seasons_active.push(year);
      if (team.first_season === null || year < team.first_season) team.first_season = year;
    }
  }

  // ---- preserved hand edits, then the curated corrections ------------------
  for (const [teamId, edit] of handEdits) {
    const team = teams.get(teamId);
    if (!team) continue;
    if (edit.name) team.name = edit.name;
    if (edit.display_name) team.display_name = edit.display_name;
    if (edit.notes) team.notes = edit.notes;
  }

  // Applied last, so the curated tables always win over whatever a previous
  // run happened to write.
  for (const [teamId, fix] of Object.entries(ENTITY_OVERRIDES)) {
    const team = teams.get(teamId);
    if (team) Object.assign(team, fix);
  }

  const list = [...teams.values()]
    .map((t) => ({
      ...t,
      aliases: {
        country_code: [...t.aliases.country_code].sort(),
        name: [...t.aliases.name].sort(),
      },
      seasons_active: [...t.seasons_active].sort((a, b) => a - b),
    }))
    .sort((a, b) => a.team_id.localeCompare(b.team_id));

  // ---- report --------------------------------------------------------------
  console.log(`\nentities                : ${list.length} (${seeded} from the ISO seed, never seen in the archive)`);
  console.log(`with archive data       : ${list.filter((t) => t.seasons_active.length).length}`);

  console.log('\n--- per-season overrides in force ---');
  for (const [year, byCode] of Object.entries(SEASON_OVERRIDES)) {
    for (const [code, teamId] of Object.entries(byCode)) {
      console.log(`  ${year}  code ${code.padEnd(3)} -> ${teamId}`);
    }
  }

  const contested = list.filter((t) => t.entity_type === 'continental');
  console.log(`\n--- continental teams (2017–2018) ---`);
  for (const t of contested) console.log(`  ${t.team_id.padEnd(15)} ${t.display_name}  seasons: ${t.seasons_active.join(',') || '—'}`);

  if (contestedMisuse.length) {
    console.log('\n!! CONTESTED CODE USED WITHOUT AN OVERRIDE — this needs a human decision');
    for (const c of contestedMisuse) console.log(`   ${c.year} code ${c.code} (${c.names.join(' | ')})`);
  }
  if (unresolved.length) {
    console.log('\n!! UNRESOLVED OBSERVATIONS — these would be dropped silently. Fix before committing:');
    for (const u of unresolved) console.log(`   ${u.year} code ${u.code} (${u.names.join(' | ')})`);
  }

  // The one assertion that matters: within a season, no code maps to two teams.
  const collisions = [];
  for (const [year, perCode] of bySeason) {
    const seen = new Map();
    for (const code of perCode.keys()) {
      const teamId = SEASON_OVERRIDES[year]?.[code] ?? defaultCodeToTeamId.get(code);
      if (!teamId) continue;
      if (seen.has(teamId) && seen.get(teamId) !== code) {
        collisions.push(`${year}: ${teamId} reached via both ${seen.get(teamId)} and ${code}`);
      }
      seen.set(teamId, code);
    }
  }
  console.log(collisions.length
    ? `\n!! AMBIGUOUS: ${collisions.join('; ')}`
    : '\nOK: no season maps two different codes to the same team.');

  if (REPORT_ONLY) {
    console.log('\n--report: nothing written.');
    return;
  }
  if (unresolved.length || contestedMisuse.length) {
    console.error('\nRefusing to write while observations are unresolved. Resolve them first.');
    process.exit(1);
  }

  const out = {
    schema_version: 1,
    note:
      'AUTHORITATIVE. Reviewed by a human and committed. The site build reads this file and never regenerates it. ' +
      'Country codes are unique within a season, not across seasons — see season_overrides.',
    season_overrides: SEASON_OVERRIDES,
    teams: list,
  };

  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`\nwrote ${list.length} teams to pipeline/lookups/team-identity.json`);
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
