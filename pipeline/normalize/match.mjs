/**
 * Match normalization — raw upstream payloads to the canonical shape.
 *
 * This is where the two upstream payload shapes are reconciled. `GET /v1` and
 * `GET /v1/matches` return DIFFERENT objects for the same match:
 *
 *              bundle (/v1)          detail (/v1/matches)
 *   field      `field`               `fieldNumber`
 *   played     `played`              (absent)
 *   result     (absent)              `result`
 *   times      —                      `startTime`
 *   details    (absent)               `details`
 *   participants  have countryCode    have teamKey ONLY
 *
 * The last row is the one that bites: a detail participant carries no
 * `countryCode`, so it cannot identify a team on its own. Identification runs
 * through a per-season `teamKey -> team_id` index built from the bundle, which
 * is sound because teamKey was verified 1:1 with countryCode within each season
 * (zero conflicts across 191/180/183 teams in 2023–2025).
 */

import {
  SCHEMA_VERSION,
  RULE_VERSION,
  NormalizationError,
  stageFromTournamentKey,
  flagToBool,
  roundScore,
  parseTimestamp,
  resultFromScore,
  allianceFromStation,
} from './values.mjs';
import { resolveTeamId, normalizeCode } from './identity.mjs';
import { adapterForYear, normalizeComponents } from '../adapters/index.mjs';

/**
 * Build the per-season `teamKey -> team_id` index from the bundle.
 *
 * teamKey is reassigned every season — that is the trap this whole pipeline is
 * built around — so the index is per-season by construction and never cached
 * across years.
 */
export function buildSeasonTeamIndex(bundle, identity, year) {
  const byTeamKey = new Map();
  const conflicts = [];

  const consider = (teamKey, countryCode, name) => {
    if (teamKey === undefined || teamKey === null) return;
    const key = String(teamKey);
    const teamId = resolveTeamId(identity, year, countryCode);
    const existing = byTeamKey.get(key);
    if (existing && existing.team_id !== teamId) {
      conflicts.push(
        `${year}: teamKey ${key} maps to both "${existing.team_id}" (via ${existing.country_code}) ` +
          `and "${teamId}" (via ${normalizeCode(countryCode)})`,
      );
      return;
    }
    if (!existing) {
      byTeamKey.set(key, { team_id: teamId, country_code: normalizeCode(countryCode), name: name ?? null });
    }
  };

  for (const match of bundle.matches ?? []) {
    for (const p of match.participants ?? []) consider(p.teamKey, p.countryCode, p.country);
  }
  for (const row of bundle.rankings ?? []) {
    if (row.team) consider(row.team.teamKey, row.team.countryCode, row.team.name);
  }
  for (const key of ['alliances_round_robin', 'alliances_finals']) {
    for (const alliance of bundle[key] ?? []) {
      for (const slot of ['captain', 'pick1', 'pick2', 'pick3']) {
        const team = alliance[slot]?.team;
        if (team) consider(team.teamKey, team.countryCode, team.name);
      }
    }
  }

  return { byTeamKey, conflicts };
}

function normalizeParticipant(p, ctx) {
  const entry = ctx.teamIndex.byTeamKey.get(String(p.teamKey));
  if (!entry) {
    // The detail payload gives no fallback, so this is fatal rather than a guess.
    throw new NormalizationError(
      `Participant teamKey ${p.teamKey} is not in the ${ctx.year} team index`,
      { year: ctx.year, teamKey: p.teamKey },
    );
  }

  const { alliance, slot } = allianceFromStation(p.station);

  return {
    team_id: entry.team_id,
    upstream_team_key: p.teamKey,
    country_code_raw: entry.country_code,
    station: p.station,
    alliance,
    slot,
    disqualified: flagToBool(p.disqualified),
    card_status: p.cardStatus ?? null,
    no_show: flagToBool(p.noShow),
    surrogate: flagToBool(p.surrogate),
  };
}

/**
 * Normalize one match. `detail` may be null for a match whose breakdown was
 * never fetched — the canonical shape is the same either way, with `details`
 * and the detail-only fields as `null`.
 */
export function normalizeMatch(bundleMatch, detail, ctx) {
  const year = ctx.year;
  const tournamentKey = bundleMatch.tournamentKey;
  const stage = stageFromTournamentKey(tournamentKey);
  const id = bundleMatch.id;

  const redScore = roundScore(bundleMatch.redScore);
  const blueScore = roundScore(bundleMatch.blueScore);

  // `played` comes from the bundle; the detail payload has no such field.
  // Verified equivalent to `detail.result !== -1` on all 1,098 fetched matches.
  const played = bundleMatch.played ?? (detail ? detail.result !== -1 : null);

  const participants = (bundleMatch.participants ?? []).map((p) => normalizeParticipant(p, ctx));

  const red = participants.filter((p) => p.alliance === 'red');
  const blue = participants.filter((p) => p.alliance === 'blue');

  // The detail payload's `details` object carries its own copies of eventKey /
  // tournamentKey / id at the same level as the scoring keys. They are mine for
  // the match identity, not for scoring, so they are stripped before storage.
  let details = null;
  if (detail?.details) {
    const { eventKey, tournamentKey: tk, id: detailId, ...scoring } = detail.details;
    void eventKey; void tk; void detailId;
    details = scoring;
  }

  const derivedResult = played === false ? 'unplayed' : resultFromScore(redScore, blueScore);
  const upstreamResult = detail?.result ?? null;

  return {
    match_id: `${year}:${tournamentKey}:${id}`,
    year,
    stage,
    tournament_key: tournamentKey,
    id,
    name: bundleMatch.name ?? null,
    scheduled_time: parseTimestamp(bundleMatch.scheduledTime),
    start_time: parseTimestamp(detail?.startTime),
    field: bundleMatch.field ?? detail?.fieldNumber ?? null,
    played,
    result: derivedResult,
    result_upstream: upstreamResult,
    score: { red: redScore, blue: blueScore },
    penalties: {
      red: { minor: roundScore(bundleMatch.redMinPen), major: roundScore(bundleMatch.redMajPen) },
      blue: { minor: roundScore(bundleMatch.blueMinPen), major: roundScore(bundleMatch.blueMajPen) },
    },
    alliances: { red, blue },
    details,
    // Normalised component vocabulary. `details` above stays raw and untouched;
    // this is the generic shape templates can rely on. Only the per-robot
    // positioning value and coopertition survive across seasons, and even those
    // change scale — `positioning_scale` is carried so nothing compares them
    // across games by accident.
    components: normalizeComponents(details, ctx.adapter),
    component_model: ctx.adapter?.model ?? null,
    provenance: {
      source: 'api',
      rule_version: RULE_VERSION,
      schema_version: SCHEMA_VERSION,
    },
  };
}

/**
 * Normalize a whole season, collecting problems instead of throwing on the
 * first one — a single malformed match should not hide the other nine.
 */
export function normalizeSeason(bundle, detailsByKey, identity, year) {
  const teamIndex = buildSeasonTeamIndex(bundle, identity, year);
  const adapter = adapterForYear(year);
  const issues = [...teamIndex.conflicts.map((m) => ({ kind: 'identity', message: m }))];
  const matches = [];

  if (!adapter) {
    issues.push({ kind: 'adapter', message: `${year} has matches but no season adapter is registered` });
  }

  for (const bundleMatch of bundle.matches ?? []) {
    const key = `${bundleMatch.tournamentKey}:${bundleMatch.id}`;
    const detail = detailsByKey[key] ?? null;

    if (bundleMatch.played && !detail) {
      issues.push({ kind: 'missing-details', message: `${year} ${key} is played but has no stored details` });
    }

    try {
      matches.push(normalizeMatch(bundleMatch, detail, { year, teamIndex, adapter }));
    } catch (err) {
      issues.push({ kind: 'normalization', message: `${year} ${key}: ${err.message}` });
    }
  }

  // Deterministic order: stage, then numeric id.
  matches.sort((a, b) => a.stage.localeCompare(b.stage) || a.id - b.id);

  // Cross-check: upstream's `result` against the score, recorded not reconciled.
  const resultDisagreements = matches
    .filter((m) => m.result_upstream !== null && m.result_upstream !== -1)
    .filter((m) => {
      const up = m.result_upstream === 1 ? 'red' : m.result_upstream === 2 ? 'blue' : 'tie';
      return up !== m.result;
    })
    .map((m) => ({ match_id: m.match_id, score: m.score, derived: m.result, upstream: m.result_upstream }));

  return { year, teamIndex, matches, issues, resultDisagreements };
}
