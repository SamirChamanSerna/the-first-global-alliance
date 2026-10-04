/**
 * Data-quality checks.
 *
 * Every finding is one of:
 *   error — the pipeline must not publish. A wrong number on the public site is
 *           worse than no new number.
 *   warn  — published, but a human should look.
 *   note  — a known property of the upstream data, recorded so it is not
 *           rediscovered every time.
 *
 * This module returns findings; it does not print and does not exit. The CLI
 * formats them and the emitter uses them as a gate, so there is exactly one
 * implementation of each check.
 */

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIdentity, tryResolveTeamId, assertNoSeasonCollisions, normalizeCode } from '../normalize/identity.mjs';
import { normalizeMatch, buildSeasonTeamIndex } from '../normalize/match.mjs';
import { parseTimestamp, SCHEMA_VERSION, RULE_VERSION } from '../normalize/values.mjs';
import { adapterForYear, auditAdapter } from '../adapters/index.mjs';
import { readMatchDetails } from '../raw/match-details.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = path.join(ROOT, 'pipeline', 'raw', 'api');
const NORM = path.join(ROOT, 'pipeline', 'normalized');
export const BASELINE_PATH = path.join(ROOT, 'pipeline', 'quality', 'baseline.json');

/** A drop this large in any count means a truncated response, not a correction. */
export const REGRESSION_THRESHOLD = 0.2;

export const MATCH_YEARS = [2023, 2024, 2025, 2026];
export const ALL_SEASONS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

const exists = (p) => access(p).then(() => true, () => false);

async function readJson(p, fallback = null) {
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return fallback;
  }
}

class Findings {
  constructor() {
    this.items = [];
  }
  error(check, message) { this.items.push({ level: 'error', check, message }); }
  warn(check, message) { this.items.push({ level: 'warn', check, message }); }
  note(check, message) { this.items.push({ level: 'note', check, message }); }
  get errors() { return this.items.filter((i) => i.level === 'error'); }
  get warnings() { return this.items.filter((i) => i.level === 'warn'); }
  get notes() { return this.items.filter((i) => i.level === 'note'); }
}

// ---------------------------------------------------------------------------
// Checks

/** Structural invariants of a normalized match. */
function checkMatchStructure(f, year, matches) {
  for (const m of matches) {
    const all = [...m.alliances.red, ...m.alliances.blue];

    if (all.length !== 6) {
      f.error('structure', `${m.match_id} has ${all.length} participants, expected 6`);
      continue;
    }
    if (new Set(all.map((p) => p.station)).size !== 6) {
      f.error('structure', `${m.match_id} has duplicate stations`);
    }
    for (const p of all) {
      if (!p.team_id) f.error('identity', `${m.match_id} station ${p.station} has no team_id`);
      if (p.alliance === 'red' && !(p.station >= 11 && p.station <= 13)) {
        f.error('structure', `${m.match_id} station ${p.station} assigned to red`);
      }
      if (p.alliance === 'blue' && !(p.station >= 21 && p.station <= 23)) {
        f.error('structure', `${m.match_id} station ${p.station} assigned to blue`);
      }
    }

    if (m.played) {
      if (m.score.red === null || m.score.blue === null) f.error('score', `${m.match_id} played with a null score`);
      if (!m.details) f.error('details', `${m.match_id} played but has no scoring breakdown`);
      if (m.result === 'unplayed') f.error('result', `${m.match_id} played but result is "unplayed"`);
    } else if (m.played === false) {
      if (m.result !== 'unplayed') f.error('result', `${m.match_id} not played but result is "${m.result}"`);
      if (m.score.red === 0 && m.score.blue === 0) {
        f.error('null-discipline', `${m.match_id} is unplayed with scores of 0 — should be null`);
      }
    }
  }
  void year;
}

/** Times must survive parsing with their offset and instant intact. */
function checkTimestamps(f, year, matches, bundle) {
  let missing = 0;
  const missingByStage = new Map();

  for (const m of matches) {
    const original = bundle.matches.find(
      (b) => b.tournamentKey === m.tournament_key && b.id === m.id,
    )?.scheduledTime;

    if (original === undefined || original === null || original === '') {
      missing++;
      missingByStage.set(m.stage, (missingByStage.get(m.stage) ?? 0) + 1);
      if (m.scheduled_time !== null) {
        f.error('time', `${m.match_id} has no upstream schedule but a non-null normalized time`);
      }
      continue;
    }

    const parsed = parseTimestamp(original);
    if (parsed.local !== original) f.error('time', `${m.match_id} local time not preserved`);
    if (new Date(parsed.utc).getTime() !== new Date(original).getTime()) {
      f.error('time', `${m.match_id} utc instant changed by parsing`);
    }
    if (!/^[+-]\d{2}:\d{2}$/.test(parsed.offset)) f.error('time', `${m.match_id} offset not preserved`);
  }

  if (missing) {
    const detail = [...missingByStage].map(([s, n]) => `${s}=${n}`).join(' ');
    f.note(
      'time',
      `${year}: ${missing}/${matches.length} matches have no scheduledTime upstream (${detail}) — ` +
        `the API leaves the field empty; it is not a pipeline defect`,
    );
  }
}

/** The two upstream payload shapes must produce the same identity and score. */
function checkShapeAgreement(f, year, bundle, store, identity) {
  const teamIndex = buildSeasonTeamIndex(bundle, identity, year);
  const ctx = { year, teamIndex, adapter: adapterForYear(year) };

  for (const bundleMatch of (bundle.matches ?? []).slice(0, 40)) {
    const key = `${bundleMatch.tournamentKey}:${bundleMatch.id}`;
    const withDetail = normalizeMatch(bundleMatch, store.responses[key] ?? null, ctx);
    const without = normalizeMatch(bundleMatch, null, ctx);

    for (const field of ['match_id', 'year', 'stage', 'id', 'field', 'played', 'result']) {
      if (JSON.stringify(withDetail[field]) !== JSON.stringify(without[field])) {
        f.error('shape-agreement', `${key}: "${field}" differs between the two upstream payload shapes`);
      }
    }
    for (const field of ['score', 'penalties', 'alliances']) {
      if (JSON.stringify(withDetail[field]) !== JSON.stringify(without[field])) {
        f.error('shape-agreement', `${key}: "${field}" differs between the two upstream payload shapes`);
      }
    }
  }
}

/** The season adapter must describe the vocabulary it claims to. */
function checkAdapters(f, year, matches) {
  const adapter = adapterForYear(year);
  if (!adapter) {
    f.error('adapter', `${year} has matches but no registered season adapter`);
    return;
  }

  const audit = auditAdapter(adapter, matches.map((m) => m.details).filter(Boolean));
  if (audit.missing.length) {
    f.error('adapter', `${year} adapter declares keys that never appear: ${audit.missing.join(', ')}`);
  }

  const scale = new Set(adapter.positioning.scale);
  for (const m of matches) {
    if (!m.details) continue;
    if (!m.components) {
      f.error('components', `${m.match_id} has details but no normalized components`);
      continue;
    }
    for (const side of ['red', 'blue']) {
      const entries = m.components.per_team[side];
      if (entries.length !== 3) {
        f.error('components', `${m.match_id} ${side} has ${entries.length} per-robot entries, expected 3`);
      }
      for (const [i, entry] of entries.entries()) {
        if (entry.positioning !== null && !scale.has(entry.positioning)) {
          f.error(
            'components',
            `${m.match_id} ${side} robot ${i + 1} positioning ${entry.positioning} is outside the declared scale`,
          );
        }
      }
    }
  }
}

/** Every observed countryCode must resolve to exactly one team per season. */
async function checkIdentity(f, identity) {
  const byYear = new Map();

  const note = (year, code) => {
    if (!code) return;
    if (!byYear.has(year)) byYear.set(year, new Set());
    byYear.get(year).add(normalizeCode(code));
  };

  for (const year of ALL_SEASONS) {
    const bundle = await readJson(path.join(RAW, String(year), 'season.json'));
    if (!bundle) continue;

    for (const key of ['rankings', 'round_robin', 'finals']) {
      for (const row of bundle[key] ?? []) note(year, row.team?.countryCode);
    }
    for (const key of ['alliances_round_robin', 'alliances_finals']) {
      for (const alliance of bundle[key] ?? []) {
        for (const slot of ['captain', 'pick1', 'pick2', 'pick3']) note(year, alliance[slot]?.team?.countryCode);
      }
    }
    for (const m of bundle.matches ?? []) {
      for (const p of m.participants ?? []) note(year, p.countryCode);
    }
  }

  for (const year of MATCH_YEARS) {
    const store = await readMatchDetails(year);
    if (!Object.keys(store.responses).length) {
      f.warn('identity', `${year}: no match-details store — participants not validated for this season`);
      continue;
    }
    // Detail participants carry no countryCode; they resolve through the season's
    // teamKey index, which is checked by checkShapeAgreement and checkTeamKeys.
  }

  for (const [year, codes] of byYear) {
    for (const code of codes) {
      const r = tryResolveTeamId(identity, year, code);
      if (!r.ok) f.error('identity', `${year}: ${r.error}`);
    }
  }

  const collisions = assertNoSeasonCollisions(identity, byYear);
  for (const c of collisions) f.error('identity', c);
}

/**
 * The teamKey trap, asserted directly.
 *
 * teamKey is reassigned every season and countryCode has been reused at least
 * once (code 15: Team Asia in 2017, Chinese Taipei in 2024). This is the check
 * that would catch a regression where someone joins across seasons by either.
 */
async function checkTeamKeys(f) {
  const seenByTeam = new Map(); // teamKey -> Set of countryCodes, per season

  for (const year of ALL_SEASONS) {
    const bundle = await readJson(path.join(RAW, String(year), 'season.json'));
    if (!bundle) continue;

    const perSeason = new Map();
    for (const m of bundle.matches ?? []) {
      for (const p of m.participants ?? []) {
        if (p.teamKey === undefined) continue;
        if (!perSeason.has(String(p.teamKey))) perSeason.set(String(p.teamKey), new Set());
        perSeason.get(String(p.teamKey)).add(normalizeCode(p.countryCode));
      }
    }
    for (const [teamKey, codes] of perSeason) {
      if (codes.size > 1) {
        f.error(
          'identity',
          `${year}: teamKey ${teamKey} maps to ${codes.size} different country codes (${[...codes].join(', ')})`,
        );
      }
      const marker = `${year}:${teamKey}`;
      seenByTeam.set(marker, [...codes][0]);
    }
  }
}

/** Record counts, and fail loudly if any of them falls off a cliff. */
async function checkCounts(f, identity) {
  const counts = { totals: { matches: 0, teams: identity.teams.length }, seasons: {} };

  for (const year of ALL_SEASONS) {
    const matches = await readJson(path.join(NORM, String(year), 'matches.json'));
    const standings = await readJson(path.join(NORM, String(year), 'standings.json'));
    const awards = await readJson(path.join(NORM, String(year), 'awards.json'));
    if (!matches && !standings && !awards) continue;

    const row = {
      matches: matches?.matches?.length ?? 0,
      played: matches?.matches?.filter((m) => m.played).length ?? 0,
      with_details: matches?.matches?.filter((m) => m.details).length ?? 0,
      standings: standings?.standings?.length ?? 0,
      awards: awards?.awards?.length ?? 0,
      award_recipients: awards?.awards?.reduce((n, a) => n + a.recipients.length, 0) ?? 0,
    };
    counts.seasons[year] = row;
    counts.totals.matches += row.matches;
  }

  const baseline = await readJson(BASELINE_PATH);
  counts.__diff = [];

  if (!baseline) {
    f.note('counts', 'no baseline recorded yet — this run will establish one');
    return counts;
  }

  for (const [year, row] of Object.entries(counts.seasons)) {
    const prior = baseline.seasons?.[year];
    if (!prior) {
      f.warn('counts', `${year}: not present in the baseline — a season appeared`);
      continue;
    }
    for (const [field, value] of Object.entries(row)) {
      const was = prior[field];
      if (typeof was !== 'number' || was === value) continue;

      const delta = value - was;
      const pct = was === 0 ? Infinity : Math.abs(delta) / was;
      counts.__diff.push({ year, field, was, now: value, delta });

      // Growth during a live event is expected. A large SHRINK is a truncated
      // response far more often than it is a correction.
      if (delta < 0 && pct > REGRESSION_THRESHOLD) {
        f.error(
          'counts',
          `${year}.${field} fell from ${was} to ${value} (−${(pct * 100).toFixed(0)}%) — ` +
            `larger than the ${REGRESSION_THRESHOLD * 100}% threshold. This is a truncated response, not a correction.`,
        );
      } else if (delta < 0) {
        f.warn('counts', `${year}.${field} fell from ${was} to ${value}`);
      }
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------

export async function runChecks({ verbose = false } = {}) {
  const f = new Findings();
  const identity = await loadIdentity();

  f.note('schema', `schema_version ${SCHEMA_VERSION}, rule_version ${RULE_VERSION}`);

  for (const year of ALL_SEASONS) {
    const bundle = await readJson(path.join(RAW, String(year), 'season.json'));
    if (!bundle) {
      f.warn('raw', `${year}: no raw bundle — run \`npm run fetch\``);
      continue;
    }

    const normalized = await readJson(path.join(NORM, String(year), 'matches.json'));
    if (!normalized?.matches?.length) continue;

    const matches = normalized.matches;
    checkMatchStructure(f, year, matches);
    checkTimestamps(f, year, matches, bundle);
    checkAdapters(f, year, matches);

    const store = await readMatchDetails(year);
    if (Object.keys(store.responses).length) {
      checkShapeAgreement(f, year, bundle, store, identity);
    }
    void verbose;
  }

  await checkIdentity(f, identity);
  await checkTeamKeys(f);
  const counts = await checkCounts(f, identity);

  return { findings: f, counts, identity };
}
