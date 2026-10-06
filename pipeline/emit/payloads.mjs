/**
 * Page payload builders.
 *
 * Each function returns exactly what ONE page renders. They are the single
 * definition of a page's data, used by:
 *
 *   pipeline/emit/cli.mjs   to write data/v<N>/…
 *   site/build.mjs          to inline the payload into the HTML
 *
 * `data_coverage` drives everything. A season publishes competition data only
 * where the record is trustworthy; templates branch on this value and never on
 * the year, so one template serves 2019 (awards only) and 2025 (everything)
 * without a special case.
 */

import { href, compactMatchRow, byStageThenId, groupByStage } from './lib.mjs';
import { buildTeamHistory, buildTeamSeason } from './teams.mjs';
import { buildMedalTable } from './medals.mjs';
import { breakdownRows, componentRows, componentSingles } from './breakdown.mjs';
import { adapterForModel, declaredKeys } from '../adapters/index.mjs';
import { insightsAllPayload, insightsYearPayload } from './insights.mjs';
import { searchIndexPayload } from './search.mjs';

export { insightsAllPayload, insightsYearPayload, searchIndexPayload };

const TOP_N_STANDINGS = 10;

export const publishesCompetition = (meta) => meta.data_coverage === 'full';

// ---------------------------------------------------------------------------

/**
 * The home page: the seasons strip plus a few leaders.
 *
 * Everything a page renders arrives in its payload. A template never reaches
 * into a global context for a second dataset — that is what keeps "one page,
 * one file" true at build time as well as at runtime.
 */
export function homePayload(ctx) {
  const medals = buildMedalTable(ctx.awardTally);
  const active = ctx.config.active_season ? ctx.yearData.get(ctx.config.active_season) : null;

  return {
    active_season: active
      ? { year: active.year, ...seasonPayload(ctx, active.year) }
      : null,
    seasons: seasonsIndexPayload(ctx).seasons,
    counts: {
      seasons: ctx.perYear.length,
      matches: ctx.perYear.reduce((n, y) => n + y.matches.length, 0),
      teams: ctx.identity.teams.filter((t) => t.seasons_active.length).length,
      registry: ctx.identity.teams.length,
    },
    medal_leaders: {
      gold: medals.rows.slice(0, 5),
      best_rank: bestSingleSeasonRanks(ctx, 5),
      most_seasons: mostSeasons(ctx, 5),
    },
  };
}

/** Career records are only comparable within the seasons they cover. */
function bestSingleSeasonRanks(ctx, n) {
  const rows = [];
  for (const y of ctx.perYear) {
    if (!publishesCompetition(y.meta)) continue;
    for (const s of y.standings) {
      if (s.rank === null) continue;
      rows.push({ team_id: s.team_id, year: y.year, rank: s.rank, record: s.record, href: href.teamSeason(s.team_id, y.year) });
    }
  }
  return rows.sort((a, b) => a.rank - b.rank || a.year - b.year).slice(0, n);
}

function mostSeasons(ctx, n) {
  return ctx.identity.teams
    .filter((t) => t.seasons_active.length)
    .map((t) => ({
      team_id: t.team_id,
      count: t.seasons_active.length,
      first: t.first_season,
      last: t.last_season,
      href: href.team(t.team_id),
    }))
    .sort((a, b) => b.count - a.count || a.team_id.localeCompare(b.team_id))
    .slice(0, n);
}

/** The teams index: every entity the registry knows, grouped by whether it has played. */
export function teamsIndexPayload(ctx) {
  const rows = ctx.identity.teams.map((t) => {
    const medal = ctx.awardTally.get(t.team_id);
    return {
      team_id: t.team_id,
      name: t.name,
      display_name: t.display_name,
      entity_type: t.entity_type,
      iso2: t.iso2,
      code3: t.code3,
      seasons_active: t.seasons_active,
      seasons_count: t.seasons_active.length,
      medals: medal
        ? { gold: medal.gold, silver: medal.silver, bronze: medal.bronze, honorable: medal.honorable, unclassed: medal.unclassed }
        : null,
      href: href.team(t.team_id),
    };
  });

  return {
    total: rows.length,
    competed: rows.filter((r) => r.seasons_count > 0),
    never_competed: rows.filter((r) => r.seasons_count === 0),
  };
}

export function seasonsIndexPayload(ctx) {
  return {
    seasons: ctx.seasons.map((s) => ({
      year: s.year,
      host_city: s.host_city,
      host_country: s.host_country,
      start_date: s.start_date,
      end_date: s.end_date,
      theme: s.theme,
      game_name: s.game_name,
      ranking_stat_name: s.ranking_stat_name,
      data_coverage: s.data_coverage,
      // A season with no normalized data has no page — 2020 and 2021 were not
      // held and 2026 has not happened. The link is omitted rather than pointed
      // at a 404, which is the only honest way to say "there is nothing here".
      href: ctx.yearData.has(s.year) ? href.season(s.year) : null,
    })),
  };
}

export function seasonPayload(ctx, year) {
  const y = ctx.yearData.get(year);
  if (!y) return null;

  const { meta } = y;
  const competition = publishesCompetition(meta);
  const standings = competition ? y.standings : [];
  const matches = competition ? y.matches : [];

  const rows = matches.slice().sort(byStageThenId)
    .map((m) => compactMatchRow(m, { overlay: y.overlay, seasonMeta: meta }));

  return {
    year,
    meta: {
      host_city: meta.host_city,
      host_country: meta.host_country,
      start_date: meta.start_date,
      end_date: meta.end_date,
      theme: meta.theme,
      game_name: meta.game_name,
      ranking_stat_name: meta.ranking_stat_name,
      ranking_stat_key: meta.ranking_stat_key,
      synopsis: meta.synopsis,
      score_formula: meta.score_formula,
      // Hand-written in pipeline/lookups/seasons.json: the season's stream and/or
      // playlist. Replaces the reference's per-stage "Watch all videos", which
      // does not apply when a season has one playlist rather than one per stage.
      videos: meta.videos ?? null,
    },
    coverage: meta.data_coverage,
    upstream_coverage: meta.upstream_coverage ?? null,
    standings_top: standings.slice(0, TOP_N_STANDINGS),
    standings_available: standings.length > 0,
    awards: y.awards,
    counts: { teams: standings.length, matches: rows.length, awards: y.awards.length },
    // Only routes that exist. A link to a page the build does not generate is a
    // 404 waiting to happen, so standings and the calculator are omitted rather
    // than pointed at a route with no template.
    links: {
      matches: rows.length ? href.seasonMatches(year) : null,
      // Insights for a season exist only where the season has competition data.
      insights: competition ? href.insightsYear(year) : null,
      self: href.season(year),
    },
  };
}

export function seasonMatchesPayload(ctx, year) {
  const y = ctx.yearData.get(year);
  if (!y || !publishesCompetition(y.meta)) return null;

  const ordered = y.matches.slice().sort(byStageThenId);
  if (!ordered.length) return null;

  const rows = ordered.map((m) => compactMatchRow(m, { overlay: y.overlay, seasonMeta: y.meta }));
  return {
    year,
    name: y.meta.game_name,
    videos: y.meta.videos ?? null,
    stage_count: groupByStage(rows).length,
    stages: groupByStage(rows),
  };
}

export function seasonStandingsPayload(ctx, year) {
  const y = ctx.yearData.get(year);
  if (!y || !publishesCompetition(y.meta) || !y.standings.length) return null;

  return {
    year,
    ranking_stat_name: y.meta.ranking_stat_name,
    record_source: y.standings[0]?.record_source ?? null,
    row_count: y.standings.length,
    standings: y.standings,
  };
}

/**
 * A single match, with its full scoring breakdown.
 *
 * Read from the normalized layer, not from the published season file — the
 * published compact rows deliberately omit `details` to keep the season match
 * list at 257 KB instead of 1.7 MB.
 */
export function matchPayload(ctx, matchId) {
  const hit = ctx.matchById.get(matchId);
  if (!hit) return null;
  const { match, year: y } = hit;

  const rows = y.matches.slice().sort(byStageThenId)
    .map((m) => compactMatchRow(m, { overlay: y.overlay, seasonMeta: y.meta }));

  // The table the match page renders: the normalised component rows first, then
  // the season's own vocabulary, paired by side. Both are generic — no season is
  // special-cased anywhere. The adapter tells us which raw keys the component
  // model already accounts for, so nothing is rendered twice.
  const adapter = adapterForModel(match.components?.model);
  const consumed = new Set(adapter ? declaredKeys(adapter) : []);
  const { rows: detailRows, singles: rawSingles } = breakdownRows(match.details, consumed);

  return {
    ...match,
    breakdown: {
      rows: [...componentRows(match), ...detailRows],
      singles: [...componentSingles(match, adapter), ...rawSingles],
    },
    // Compact rows for navigation: the rest of the day's matches on the same field.
    same_field: rows.filter((r) => r.field === match.field && r.match_id !== match.match_id).slice(0, 8),
    coverage: y.meta.data_coverage,
    links: {
      self: href.match(match.year, match.stage, match.id),
      season: href.season(match.year),
      matches: href.seasonMatches(match.year),
    },
  };
}

export function teamHistoryPayload(ctx, teamId) {
  const team = ctx.teamById.get(teamId);
  if (!team) return null;

  const years = ctx.teamYears.get(teamId);
  const history = buildTeamHistory(
    team,
    ctx.perYear.map((y) => {
      const slice = years?.get(y.year);
      return {
        year: y.year,
        meta: y.meta,
        standing: slice?.standing ?? null,
        awards: slice?.awards ?? [],
        alliance: slice?.alliance ?? null,
      };
    }),
    ctx.awardTally.get(teamId) ?? null,
  );

  // Every registry team gets a page — including the ones that have never
  // competed. A team the registry knows about must not 404.
  return history ?? {
    team_id: teamId,
    team,
    career: null,
    timeline: [],
    awards: [],
    never_competed: true,
  };
}

export function teamSeasonPayload(ctx, teamId, year) {
  const team = ctx.teamById.get(teamId);
  const y = ctx.yearData.get(year);
  if (!team || !y) return null;

  const slice = ctx.teamYears.get(teamId)?.get(year);
  if (!slice) return null;

  // The rest of the team's alliance, resolved here so the page never looks up a
  // second dataset for something it must render.
  const allianceMembers = slice.alliance
    ? (y.alliances
        .find((s) => s.stage === slice.alliance.stage)
        ?.alliances.find((a) => a.name === slice.alliance.alliance_name)?.members ?? [])
    : [];

  const built = buildTeamSeason(team, {
    year,
    meta: y.meta,
    standing: slice.standing,
    awards: slice.awards,
    alliance: slice.alliance,
    allianceMembers,
    matches: slice.matches,
    videoOpts: { overlay: y.overlay, seasonMeta: y.meta },
    denominator: y.standings.length || null,
  });

  // The other seasons this team has a page for, newest first: the year selector
  // in the section menu, resolved here so the template does no lookups.
  return built && {
    ...built,
    team_years: [...(ctx.teamYears.get(teamId)?.keys() ?? [])].sort((a, b) => b - a),
  };
}

export function medalTablePayload(ctx) {
  return {
    generated_for: ctx.perYear.map((y) => y.year),
    ...buildMedalTable(ctx.awardTally),
  };
}

/** Every route the site has, as data. The build maps this to templates. */
export function routeTable(ctx) {
  return {
    seasons: ctx.perYear.map((y) => y.year),
    teamIds: ctx.identity.teams.map((t) => t.team_id),
    teamSeasons: [...ctx.teamYears].flatMap(([teamId, years]) =>
      [...years.keys()].map((year) => ({ teamId, year })),
    ),
    matches: [...ctx.matchById.keys()],
  };
}
