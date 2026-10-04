/**
 * Shared emit helpers.
 *
 * Two rules drive everything here:
 *
 * 1. **Precompute what a template would otherwise compute.** Every `href`, every
 *    alliance membership and every video URL is resolved here, at build time,
 *    once — instead of on every visit, in JavaScript, on a phone.
 *
 * 2. **Deterministic bytes.** Fixed key construction order, fixed indentation,
 *    explicit array sorting. The same input must produce the same file, or a
 *    correction becomes an unreadable diff.
 */

/** Route builders. These are the ONLY place URL shapes are written down. */
export const href = {
  home: () => '/',
  seasons: () => '/seasons/',
  season: (year) => `/seasons/${year}/`,
  seasonMatches: (year) => `/seasons/${year}/matches/`,
  seasonStandings: (year) => `/seasons/${year}/standings/`,
  calculator: (year) => `/calculator/${year}/`,
  insights: () => '/insights/',
  insightsYear: (year) => `/insights/${year}/`,
  medals: () => '/medals/',
  team: (teamId) => `/teams/${teamId}/`,
  teamSeason: (teamId, year) => `/teams/${teamId}/${year}/`,
  match: (year, stage, id) => `/matches/${year}/${stage}/${id}/`,
};

/**
 * Append an exact start time to a video URL.
 * Handles the case where the URL already carries a query string.
 */
export function withTimeParam(url, seconds) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${seconds}`;
}

/**
 * Resolve a match's video link from the owner's overlay.
 *
 * `day` is NEVER derived — not from `scheduled_time`, not from match ordering
 * (docs/plan/02-data-contract.md §6). If the owner has not recorded which day a
 * match was played, the match has no link. Showing the wrong VOD is worse than
 * showing nothing.
 *
 * A link points at the day+field VOD, and at an exact second only when `t` is
 * set. There is no approximate-time behaviour.
 */
export function resolveVideo(match, overlay, seasonMeta) {
  const entry = overlay?.[`${match.tournament_key}:${match.id}`];
  if (!entry || entry.day === null || entry.day === undefined) return null;

  const days = seasonMeta?.streams?.days ?? [];
  const day = days.find((d) => d.day === entry.day);
  if (!day) return null;

  const stream = day.fields?.[String(match.field)] ?? day.fields?.main;
  if (!stream?.url) return null;

  const t = entry.t ?? null;
  return {
    url: t === null ? stream.url : withTimeParam(stream.url, t),
    t,
    day: entry.day,
    field: match.field ?? null,
  };
}

/**
 * The compact match row — the single shape repeated everywhere a list of matches
 * is rendered: season page, season match list, team page, insights, and the live
 * overlay. One shape, one template, four renderers.
 */
export function compactMatchRow(match, { overlay = null, seasonMeta = null } = {}) {
  return {
    match_id: match.match_id,
    href: href.match(match.year, match.stage, match.id),
    stage: match.stage,
    name: match.name,
    scheduled_time: match.scheduled_time,
    field: match.field,
    red_score: match.score.red,
    blue_score: match.score.blue,
    result: match.result,
    played: match.played,
    red: match.alliances.red.map((p) => p.team_id),
    blue: match.alliances.blue.map((p) => p.team_id),
    video: resolveVideo(match, overlay, seasonMeta),
  };
}

/**
 * The same row, in the context of one team. `is_team_red` can only be computed
 * in a team's context — the same match is red for one team and blue for the
 * other — so it is added here rather than baked into the season-wide list.
 */
export function matchRowForTeam(match, teamId, opts = {}) {
  const row = compactMatchRow(match, opts);
  return {
    ...row,
    is_team_red: match.alliances.red.some((p) => p.team_id === teamId),
    involving_team: match.alliances.red.some((p) => p.team_id === teamId)
      || match.alliances.blue.some((p) => p.team_id === teamId),
  };
}

/** Deterministic JSON write payload. */
export const json = (payload) => JSON.stringify(payload, null, 2) + '\n';

/** Sort matches by stage, then numeric id — so t2:9 precedes t2:10. */
export const byStageThenId = (a, b) => a.stage.localeCompare(b.stage) || a.id - b.id;

/** Group a flat match list by stage, preserving stage order. */
export function groupByStage(matches) {
  const order = ['ranking', 'round_robin', 'finals'];
  const byStage = new Map(order.map((s) => [s, []]));
  for (const m of matches) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, []);
    byStage.get(m.stage).push(m);
  }
  return [...byStage]
    .filter(([, list]) => list.length)
    .map(([stage, list]) => ({ stage, count: list.length, matches: list }));
}
