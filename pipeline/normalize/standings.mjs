/**
 * Standings normalization.
 *
 * Two sources feed a standings row, and which one is authoritative depends on
 * the season:
 *
 *   rank, rankingScore, highestScore, the year's custom stat  →  upstream `rankings`
 *   wins / losses / ties                                      →  the MATCHES, where they exist
 *
 * The record is not taken from `rankings` for 2023–2025 because those rows are
 * internally inconsistent — they report more results than games played, always
 * as extra losses. In 2025, Albania reports `played: 12` beside `w:4 l:8 t:3`.
 * See docs/plan/02-data-contract.md §4.8b.
 *
 * Where matches do not exist the record falls back to `rankings`, but ONLY for
 * 2019, the single pre-2023 season whose rows are sound (3 of 189 off by one).
 * 2017/2018 are zeroed and 2022 is corrupt, so those seasons get `record: null`
 * rather than a number that would read as fact.
 *
 * The upstream values are always preserved alongside as `record_upstream`, so a
 * disagreement is auditable rather than erased.
 */

import { resolveTeamId, normalizeCode } from './identity.mjs';
import { roundScore } from './values.mjs';
import { ADAPTERS } from '../adapters/index.mjs';

const legacy = ADAPTERS.legacy;

/** A ranking row that names no team cannot be attributed; upstream has one of these in 2024. */
const hasTeam = (row) => Boolean(row?.team?.countryCode);

function deriveRecordFromMatches(matches) {
  const record = new Map();
  for (const match of matches) {
    if (match.stage !== 'ranking' || !match.played) continue;
    for (const p of [...match.alliances.red, ...match.alliances.blue]) {
      if (p.no_show || p.disqualified) continue;
      if (!record.has(p.team_id)) record.set(p.team_id, { w: 0, l: 0, t: 0 });
      const r = record.get(p.team_id);
      if (match.result === 'tie') r.t++;
      else if (match.result === p.alliance) r.w++;
      else r.l++;
    }
  }
  return record;
}

export function normalizeStandings(bundle, matches, identity, year, seasonMeta) {
  const issues = [];
  const rows = [];
  const derivedRecords = deriveRecordFromMatches(matches);

  const legacySeason = legacy.seasons[year] ?? null;
  const hasMatches = matches.length > 0;
  const rankingsUsable = hasMatches ? false : Boolean(legacySeason?.record_usable);
  const statKey = seasonMeta?.ranking_stat_key ?? null;

  let skippedNoTeam = 0;

  for (const row of bundle.rankings ?? []) {
    if (!hasTeam(row)) {
      skippedNoTeam++;
      continue;
    }

    const teamId = resolveTeamId(identity, year, row.team.countryCode);

    const upstreamRecord = { w: row.wins ?? null, l: row.losses ?? null, t: row.ties ?? null };
    let record = null;
    let recordSource = null;

    if (hasMatches) {
      record = derivedRecords.get(teamId) ?? { w: 0, l: 0, t: 0 };
      recordSource = 'matches';
    } else if (rankingsUsable) {
      record = { ...upstreamRecord };
      recordSource = 'rankings';
    }

    rows.push({
      team_id: teamId,
      upstream_team_key: row.team.teamKey ?? row.teamKey ?? null,
      country_code_raw: normalizeCode(row.team.countryCode),
      rank: row.rank ?? null,
      rank_change: row.rankChange ?? null,
      played: row.played ?? null,
      record,
      record_source: recordSource,
      record_upstream: upstreamRecord,
      ranking_score: roundScore(row.rankingScore),
      highest_score: roundScore(row.highestScore),
      custom_stat: statKey && row[statKey] !== undefined
        ? { key: statKey, value: roundScore(row[statKey]) }
        : null,
    });
  }

  // Deterministic: rank ascending; unranked rows last.
  rows.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.team_id.localeCompare(b.team_id));

  if (skippedNoTeam) {
    issues.push({
      kind: 'standings',
      message: `${year}: ${skippedNoTeam} ranking row(s) name no team and were skipped (upstream placeholder)`,
    });
  }

  const byRank = new Map(rows.map((r) => [r.rank, r]));
  if (byRank.size !== rows.length) {
    issues.push({ kind: 'standings', message: `${year}: duplicate ranks present` });
  }

  return { standings: rows, issues };
}
