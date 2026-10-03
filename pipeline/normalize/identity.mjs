/**
 * Team identity resolution.
 *
 * Turns an upstream (season, countryCode) pair into our stable team_id.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE, AND WHY IT LOOKS LIKE THIS
 *
 * `countryCode` is unique WITHIN a season, not ACROSS seasons:
 *
 *   "15"  →  Team Asia        in 2017
 *            Chinese Taipei   in 2024, 2025
 *
 * and one entity moved codes as well: Chinese Taipei is "TW" in 2017–2018 and
 * "15" in 2024–2025. See docs/discovery/02-data-model.md §1.
 *
 * So resolution is two-stage, and the order matters:
 *
 *   1. the season's override table  — the exceptions, and they win
 *   2. the global alias table       — everything else
 *
 * A contested code with no override is an ERROR, not a guess. The whole point of
 * this module is that these cases fail loudly instead of silently attributing a
 * continental team's 2017 record to Chinese Taipei.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const IDENTITY_PATH = path.join(ROOT, 'pipeline', 'lookups', 'team-identity.json');

/**
 * Codes assigned to 2017–2018 continental teams. They are never valid outside
 * the seasons listed in the override table; if one shows up elsewhere, the data
 * has changed shape and a human needs to look.
 */
const CONTESTED_CODES = new Set(['11', '12', '13', '14', '15', '16']);

export const normalizeCode = (code) => String(code ?? '').trim().toUpperCase();

export class IdentityError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'IdentityError';
    this.detail = detail;
  }
}

let cached = null;

/** Load the authoritative registry. Cached for the process lifetime. */
export async function loadIdentity(p = IDENTITY_PATH) {
  if (cached) return cached;
  const raw = JSON.parse(await readFile(p, 'utf8'));

  const byTeamId = new Map();
  const byCode = new Map(); // CODE -> team_id, from the global alias table

  for (const team of raw.teams) {
    byTeamId.set(team.team_id, team);
    for (const code of team.aliases.country_code) {
      const key = normalizeCode(code);
      const existing = byCode.get(key);
      // Two teams may legitimately share a code in the alias table when every
      // season that uses it is covered by an override. Record it as contested
      // rather than pretending it is unambiguous.
      if (existing && existing !== team.team_id) {
        byCode.set(key, null); // null = ambiguous without an override
      } else if (!byCode.has(key)) {
        byCode.set(key, team.team_id);
      }
    }
  }

  cached = {
    raw,
    teams: raw.teams,
    byTeamId,
    byCode,
    seasonOverrides: new Map(
      Object.entries(raw.season_overrides ?? {}).map(([year, map]) => [Number(year), map]),
    ),
  };
  return cached;
}

/**
 * Resolve one observation. Returns a team_id, or throws — never null.
 *
 * @param {object} identity  result of loadIdentity()
 * @param {number} year
 * @param {string} code      raw upstream countryCode, any casing
 */
export function resolveTeamId(identity, year, code) {
  const key = normalizeCode(code);
  if (!key) throw new IdentityError('Missing countryCode', { year });

  const override = identity.seasonOverrides.get(year)?.[key];
  if (override) {
    if (!identity.byTeamId.has(override)) {
      throw new IdentityError(`Override points at unknown team_id "${override}"`, { year, code: key });
    }
    return override;
  }

  if (CONTESTED_CODES.has(key)) {
    throw new IdentityError(
      `Contested code "${key}" used in ${year} with no season override. ` +
        `These codes were reassigned between seasons — add an explicit override before proceeding.`,
      { year, code: key },
    );
  }

  const teamId = identity.byCode.get(key);
  if (teamId === undefined) {
    throw new IdentityError(`Unknown countryCode "${key}" — not in the identity registry`, { year, code: key });
  }
  if (teamId === null) {
    throw new IdentityError(
      `countryCode "${key}" is ambiguous in the global alias table and ${year} has no override`,
      { year, code: key },
    );
  }
  return teamId;
}

/** Non-throwing variant, for validation passes that want to collect every failure. */
export function tryResolveTeamId(identity, year, code) {
  try {
    return { ok: true, teamId: resolveTeamId(identity, year, code) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * The assertion this whole module exists for: within one season, no two
 * different codes may resolve to the same team.
 */
export function assertNoSeasonCollisions(identity, observations) {
  const problems = [];
  for (const [year, codes] of observations) {
    const seen = new Map();
    for (const code of codes) {
      const r = tryResolveTeamId(identity, year, code);
      if (!r.ok) continue;
      const key = normalizeCode(code);
      if (seen.has(r.teamId) && seen.get(r.teamId) !== key) {
        problems.push(`${year}: team "${r.teamId}" reached via both "${seen.get(r.teamId)}" and "${key}"`);
      }
      seen.set(r.teamId, key);
    }
  }
  return problems;
}
