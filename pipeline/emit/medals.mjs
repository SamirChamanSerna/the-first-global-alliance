/**
 * The all-time medal table.
 *
 * This is the only view with uninterrupted coverage from 2017 — every other
 * statistic has a hole in it somewhere — which makes it the most trustworthy
 * thing the site publishes and worth getting exactly right.
 *
 * Counts come from the award tally, which already excludes awards given to
 * people rather than teams (see normalize/awards.mjs). Unclassed recognitions —
 * judges' awards, mentor awards, social-media challenges — are counted in their
 * own column, never folded into a medal tier.
 */

import { href } from './lib.mjs';

export const MEDAL_ORDER = ['gold', 'silver', 'bronze', 'honorable'];

/**
 * Sort by gold, then silver, then bronze, then total — the conventional order.
 * Ties fall back to team_id so the output is deterministic.
 */
function compare(a, b) {
  for (const key of ['gold', 'silver', 'bronze', 'honorable']) {
    if (a[key] !== b[key]) return b[key] - a[key];
  }
  if (a.total !== b.total) return b.total - a.total;
  return a.team_id.localeCompare(b.team_id);
}

export function buildMedalTable(tallies) {
  const rows = [...tallies]
    .map(([teamId, t]) => ({
      team_id: teamId,
      href: href.team(teamId),
      gold: t.gold,
      silver: t.silver,
      bronze: t.bronze,
      honorable: t.honorable,
      unclassed: t.unclassed,
      medals: t.medals,
      total: t.total,
      by_year: t.by_year,
    }))
    .sort(compare);

  return {
    // Only teams that have received at least one award appear at all.
    row_count: rows.length,
    totals: {
      gold: rows.reduce((n, r) => n + r.gold, 0),
      silver: rows.reduce((n, r) => n + r.silver, 0),
      bronze: rows.reduce((n, r) => n + r.bronze, 0),
      honorable: rows.reduce((n, r) => n + r.honorable, 0),
      unclassed: rows.reduce((n, r) => n + r.unclassed, 0),
    },
    rows,
  };
}
