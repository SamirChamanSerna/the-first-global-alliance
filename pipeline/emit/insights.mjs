/**
 * Insights — read-only distributions over the archive.
 *
 * Everything here is a count of something the archive already states: no
 * ratings, no predictions, no cross-season comparison of values that are not
 * comparable (a 2023 score and a 2025 score are not the same measurement, so
 * scores are only ever charted within one season).
 *
 * The reference page groups by region. This archive has no region field on a
 * team and inventing one from the ISO code would be inventing the data, so the
 * grouping is by `entity_type`, which the registry does carry.
 */

import { href } from './lib.mjs';
import { buildMedalTable } from './medals.mjs';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Two series over the same bucket edges, so the bars line up: `all` is every
 * match and `playoffs` is the subset that is not ranking.
 */
function twoSeriesBuckets(all, playoffs, width) {
  const nums = all.filter(isNum);
  if (!nums.length) return [];

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const start = Math.floor(min / width) * width;

  const buckets = [];
  for (let lo = start; lo <= max; lo += width) {
    buckets.push({ lo, hi: lo + width - 1, label: `${lo}–${lo + width - 1}`, all: 0, playoffs: 0 });
  }

  const put = (value, key) => {
    const i = Math.min(buckets.length - 1, Math.floor((value - start) / width));
    buckets[i][key]++;
  };

  for (const v of nums) put(v, 'all');
  for (const v of playoffs.filter(isNum)) put(v, 'playoffs');

  return buckets;
}

/** A histogram over the absolute value of a signed quantity. */
function magnitudeBuckets(values, width) {
  const nums = values.filter(isNum);
  if (!nums.length) return [];
  return twoSeriesBuckets(nums, [], width).map((b) => ({ ...b, label: `${b.lo}–${b.hi}` }));
}

// ---------------------------------------------------------------------------

export function insightsAllPayload(ctx) {
  const teams = ctx.identity.teams;

  // Awards and participation per entity type. `entity_type` is the only
  // grouping the registry carries for every team.
  const types = new Map();
  const touch = (type) => {
    const key = type ?? 'unknown';
    if (!types.has(key)) {
      types.set(key, { type: key, teams: 0, competed: 0, medals: { gold: 0, silver: 0, bronze: 0, honorable: 0, unclassed: 0, total: 0 } });
    }
    return types.get(key);
  };

  for (const team of teams) {
    const row = touch(team.entity_type);
    row.teams++;
    if (team.seasons_active.length) row.competed++;

    const tally = ctx.awardTally.get(team.team_id);
    if (!tally) continue;
    for (const key of ['gold', 'silver', 'bronze', 'honorable', 'unclassed', 'total']) {
      row.medals[key] += tally[key] ?? 0;
    }
  }

  // Seasons participated: how many teams played exactly N seasons.
  const seasonsCount = new Map();
  for (const team of teams) {
    const n = team.seasons_active.length;
    if (!n) continue;
    seasonsCount.set(n, (seasonsCount.get(n) ?? 0) + 1);
  }

  const medals = buildMedalTable(ctx.awardTally);

  return {
    counts: {
      seasons: ctx.perYear.length,
      teams: teams.length,
      competed: teams.filter((t) => t.seasons_active.length).length,
      awards: medals.rows.reduce((n, r) => n + r.total, 0),
    },
    entity_types: [...types.values()].sort((a, b) => b.medals.total - a.medals.total || a.type.localeCompare(b.type)),
    seasons_distribution: [...seasonsCount]
      .map(([seasons, count]) => ({ seasons, count }))
      .sort((a, b) => a.seasons - b.seasons),
    most_awarded: medals.rows.slice(0, 10).map((r) => ({
      team_id: r.team_id,
      href: r.href,
      gold: r.gold,
      silver: r.silver,
      bronze: r.bronze,
      honorable: r.honorable,
      total: r.total,
    })),
  };
}

export function insightsYearPayload(ctx, year) {
  const y = ctx.yearData.get(year);
  if (!y || y.meta.data_coverage !== 'full') return null;

  const played = y.matches.filter((m) => m.played);
  const isPlayoff = (m) => m.stage !== 'ranking';

  const totals = played.map((m) => m.score.red + m.score.blue);
  const totalsPlayoffs = played.filter(isPlayoff).map((m) => m.score.red + m.score.blue);
  const margins = played.map((m) => Math.abs(m.score.red - m.score.blue));
  const marginsPlayoffs = played.filter(isPlayoff).map((m) => Math.abs(m.score.red - m.score.blue));

  // Rank movement, from the standings the season publishes.
  const changes = y.standings.map((s) => s.rank_change).filter(isNum);
  const rankMovement = magnitudeBuckets(changes.map(Math.abs), 1).map((b) => ({ label: b.lo === b.hi ? String(b.lo) : b.label, count: b.all }));
  const moved = y.standings.filter((s) => isNum(s.rank_change) && s.rank_change !== 0).length;

  // Award distribution by class, and who plays which alliance role.
  const awardClasses = new Map();
  for (const award of y.awards) {
    for (const r of award.recipients) {
      if (r.kind !== 'team') continue;
      const key = r.class ?? 'unclassed';
      awardClasses.set(key, (awardClasses.get(key) ?? 0) + 1);
    }
  }

  const roles = new Map();
  for (const { alliances } of y.alliances) {
    for (const alliance of alliances) {
      for (const m of alliance.members) {
        const key = m.is_captain ? 'captain' : (m.role ?? 'member');
        roles.set(key, (roles.get(key) ?? 0) + 1);
      }
    }
  }

  const mostImproved = y.standings
    .filter((s) => isNum(s.rank_change) && s.rank_change > 0)
    .sort((a, b) => b.rank_change - a.rank_change || a.team_id.localeCompare(b.team_id))
    .slice(0, 10)
    .map((s) => ({
      team_id: s.team_id,
      href: href.teamSeason(s.team_id, year),
      rank: s.rank,
      change: s.rank_change,
    }));

  return {
    year,
    name: y.meta.game_name,
    coverage: y.meta.data_coverage,
    counts: {
      matches: played.length,
      ranked: y.standings.length,
      awards: y.awards.length,
      alliances: y.alliances.reduce((n, s) => n + s.alliances.length, 0),
    },
    score_distribution: twoSeriesBuckets(totals, totalsPlayoffs, 20),
    margin_distribution: twoSeriesBuckets(margins, marginsPlayoffs, 10),
    rank_movement: { buckets: rankMovement, teams: y.standings.length, moved },
    award_distribution: [...awardClasses]
      .map(([cls, count]) => ({ cls, count }))
      .sort((a, b) => b.count - a.count || a.cls.localeCompare(b.cls)),
    alliance_roles: [...roles]
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count || a.role.localeCompare(b.role)),
    most_improved: mostImproved,
  };
}
