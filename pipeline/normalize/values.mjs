/**
 * Value-level normalization primitives.
 *
 * Every rule here exists because the upstream data violates it. This module has
 * no knowledge of seasons or games — only of how a value is shaped.
 *
 * The governing discipline is NULL DISCIPLINE: an absent value becomes `null`,
 * never `0`, never `""`, never omitted. "No data" and "zero" are different
 * claims, and the UI must be able to tell them apart.
 */

export const SCHEMA_VERSION = 1;
export const RULE_VERSION = 1;

/** Upstream's tournament stage codes. Anything else is a shape change worth failing on. */
export const STAGES = { t2: 'ranking', t3: 'round_robin', t4: 'finals' };

export class NormalizationError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'NormalizationError';
    this.detail = detail;
  }
}

export function stageFromTournamentKey(tournamentKey) {
  const stage = STAGES[tournamentKey];
  if (!stage) {
    throw new NormalizationError(`Unknown tournamentKey "${tournamentKey}"`, { tournamentKey });
  }
  return stage;
}

/** 0/1 flags become real booleans. `null`/`undefined` stay `null`. */
export function flagToBool(value) {
  if (value === null || value === undefined) return null;
  return value === 1 || value === true || value === '1';
}

/**
 * Scores are floats upstream and some carry binary-float noise
 * (`1.2000000000000002`). Six decimals is far finer than any scoring element
 * and makes output deterministic.
 */
export function roundScore(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new NormalizationError(`Non-numeric score: ${JSON.stringify(value)}`, { value });
  }
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Derive the season integer from an upstream `eventKey`.
 *
 * `eventKey` has two coexisting formats that disagree *within* the same season —
 * `FGC_2025-FGC-CMP` on matches versus `2025_FGC-FGC-CMP` on awards — and is
 * stored as an attribute only. It is NEVER used as a join key.
 */
export function yearFromEventKey(eventKey) {
  if (typeof eventKey !== 'string') return null;
  const match = eventKey.match(/(20\d{2})/);
  return match ? Number(match[1]) : null;
}

/**
 * Split an ISO-8601 timestamp into `{ utc, offset, local }`.
 *
 * The offset is the host venue's, so it is preserved rather than discarded —
 * displaying "11:15" without knowing whose 11:15 it is makes event-day pages
 * wrong for most of the audience. An empty string is `null`: upstream leaves
 * `startTime` empty on essentially every match, and `""` is not a time.
 */
export function parseTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value);
  const m = str.match(/^(.*?)(Z|[+-]\d{2}:\d{2})$/);
  if (!m) {
    throw new NormalizationError(`Timestamp has no UTC offset: ${str}`, { value: str });
  }
  const [, local, offset] = m;
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) {
    throw new NormalizationError(`Unparseable timestamp: ${str}`, { value: str });
  }
  // The full instant is preserved. Upstream sometimes carries milliseconds and
  // sometimes does not; deciding they are meaningless would be inventing a rule,
  // and dropping them would make `utc` fail to round-trip to the same instant.
  const utc = date.toISOString();
  return { utc, offset: offset === 'Z' ? '+00:00' : offset, local: str };
}

/**
 * The match outcome, derived from the score.
 *
 * NOT taken from upstream's `result` field, for two verified reasons:
 *   - in 2023 it is `0` for all 338 matches (the field is not implemented)
 *   - in 2024–2025 it contradicts the score in 10 matches that no
 *     card/disqualification rule explains
 *
 * Deriving from the score reproduces the official record exactly wherever that
 * record is self-consistent. The upstream value is preserved separately as
 * `result_upstream` so the disagreement stays auditable rather than erased.
 */
export function resultFromScore(redScore, blueScore) {
  if (redScore === null || blueScore === null) return null;
  if (redScore > blueScore) return 'red';
  if (redScore < blueScore) return 'blue';
  return 'tie';
}

/** Upstream's numeric enum: -1 not played, 0 tie, 1 red win, 2 blue win. */
export function resultFromUpstreamEnum(value) {
  if (value === -1) return 'unplayed';
  if (value === 0) return 'tie';
  if (value === 1) return 'red';
  if (value === 2) return 'blue';
  return null;
}

/**
 * Station decides the alliance: 11–13 are red robots 1–3, 21–23 are blue.
 * 14 and 24 mean "did not play" and carry no alliance.
 */
export function allianceFromStation(station) {
  if (station >= 11 && station <= 13) return { alliance: 'red', slot: station - 10 };
  if (station >= 21 && station <= 23) return { alliance: 'blue', slot: station - 20 };
  if (station === 14 || station === 24) return { alliance: null, slot: null };
  throw new NormalizationError(`Unknown station ${station}`, { station });
}
