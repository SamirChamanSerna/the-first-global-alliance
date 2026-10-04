/**
 * Playoff alliance normalization.
 *
 * Shape: a captain plus three picks, four teams per alliance. Verified across
 * 2022–2025 (the seasons that have them).
 *
 * Two details worth stating because the data makes them easy to get wrong:
 *
 *  - `allianceRank` and `pickOrder` are DIFFERENT numbers and both matter. Rank
 *    is where the alliance placed; pick order is when the captain chose that
 *    team. A team can be pick1 of the 6th-ranked alliance.
 *  - The captain also appears in `pickOrder` terms — its `pickOrder` is 1 in the
 *    observed data, but it is identified by `isCaptain`, not by pick order, so
 *    the role is taken from that flag rather than inferred.
 */

import { resolveTeamId } from './identity.mjs';

const SLOTS = ['captain', 'pick1', 'pick2', 'pick3'];

function member(slotName, entry, year, identity, issues) {
  const team = entry?.team;
  if (!team?.countryCode) {
    issues.push({ kind: 'alliance', message: `${year}: alliance ${slotName} has no team` });
    return null;
  }
  return {
    team_id: resolveTeamId(identity, year, team.countryCode),
    role: slotName,
    is_captain: Boolean(entry.isCaptain),
    pick_order: entry.pickOrder ?? null,
    alliance_rank: entry.allianceRank ?? null,
    alliance_name_short: entry.allianceNameShort ?? null,
    alliance_name_long: entry.allianceNameLong ?? null,
  };
}

export function normalizeAlliances(bundle, identity, year) {
  const issues = [];
  const byStage = [];

  for (const [key, stage] of [['alliances_round_robin', 'round_robin'], ['alliances_finals', 'finals']]) {
    const list = bundle[key] ?? [];
    if (!list.length) continue;

    const alliances = list.map((alliance) => {
      const members = SLOTS
        .map((slot) => member(slot, alliance[slot], year, identity, issues))
        .filter(Boolean);

      const captains = members.filter((m) => m.is_captain).length;
      if (captains !== 1) {
        issues.push({
          kind: 'alliance',
          message: `${year} ${stage}: "${alliance.name}" has ${captains} captains, expected 1`,
        });
      }

      return {
        name: alliance.name ?? null,
        rank: alliance.rank ?? null,
        ranking_score: alliance.rankingScore ?? null,
        played: alliance.played ?? null,
        members,
      };
    });

    alliances.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
    byStage.push({ stage, count: alliances.length, alliances });
  }

  return { byStage, issues };
}

/** team_id -> its alliance entry, across both playoff stages. */
export function allianceIndex(byStage) {
  const byTeam = new Map();
  for (const { stage, alliances } of byStage) {
    for (const alliance of alliances) {
      for (const m of alliance.members) {
        // A team appears in one alliance; finals supersedes round robin.
        byTeam.set(m.team_id, {
          stage,
          alliance_name: alliance.name,
          alliance_rank: alliance.rank,
          role: m.role,
          is_captain: m.is_captain,
          pick_order: m.pick_order,
        });
      }
    }
  }
  return byTeam;
}
