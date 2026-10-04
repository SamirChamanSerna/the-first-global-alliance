/**
 * Team artifacts — the two pages built from one team's slice of every season.
 *
 *   teams/<id>/index.json    the Team History page (the default team route)
 *   teams/<id>/<year>.json   the Team/Season page
 *
 * Both are built so that the template needs no joins: everything it renders —
 * hrefs, the viewer's alliance side, the video link, the coverage label — is
 * resolved here.
 *
 * ── THE HONESTY RULE ────────────────────────────────────────────────────────
 *
 * A career record is only as good as the seasons it covers, and those seasons
 * are not contiguous. The record is trustworthy for 2019 (from rankings) and
 * 2023–2025 (from matches). It is absent for 2017, 2018 and 2022 — zeroed or
 * corrupt upstream. So every career aggregate carries `record_years`, and a
 * timeline row for a season without a record renders NO record field rather than
 * a row of zeros. A page that says "31–42" without saying which seven of nine
 * seasons it counted is misleading, and this is the single easiest place for
 * this project to mislead by accident.
 */

import { href, matchRowForTeam, byStageThenId } from './lib.mjs';

/** A season the record can be trusted for, with where it came from. */
function recordForYear(standing) {
  if (!standing?.record) return null;
  return { ...standing.record, source: standing.record_source };
}

function winRate(record) {
  const games = record.w + record.l + record.t;
  return games ? Number((record.w / games).toFixed(4)) : null;
}

/**
 * @param {object} team      registry entry
 * @param {Array}  perYear   [{ year, meta, standing, awards, alliance, matches, rows }]
 */
export function buildTeamHistory(team, perYear, awardTally) {
  const yearsPresent = perYear.filter(
    (y) => y.standing || y.awards.length || y.alliance,
  );
  if (!yearsPresent.length) return null;

  // ---- career record, and the years it actually covers --------------------
  const recordYears = [];
  const career = { w: 0, l: 0, t: 0, matches: 0 };
  for (const y of perYear) {
    const record = recordForYear(y.standing);
    if (!record) continue;
    recordYears.push(y.year);
    career.w += record.w;
    career.l += record.l;
    career.t += record.t;
    career.matches += y.standing.played ?? 0;
  }

  const ranked = perYear.filter((y) => y.standing?.rank != null);
  const bestRank = ranked.length
    ? ranked.reduce((best, y) => (y.standing.rank < best.standing.rank ? y : best), ranked[0])
    : null;

  // ---- timeline, newest first ---------------------------------------------
  const timeline = yearsPresent
    .slice()
    .sort((a, b) => b.year - a.year)
    .map((y) => {
      const record = recordForYear(y.standing);
      return {
        year: y.year,
        href: href.teamSeason(team.team_id, y.year),
        host_city: y.meta.host_city,
        host_country: y.meta.host_country,
        game_name: y.meta.game_name,
        coverage: y.meta.data_coverage,
        rank: y.standing?.rank ?? null,
        rank_change: y.standing?.rank_change ?? null,
        // For a season with no record, this is null — the template omits the
        // column rather than rendering zeros.
        record: record ? { w: record.w, l: record.l, t: record.t } : null,
        win_rate: record ? winRate(record) : null,
        record_source: record?.source ?? null,
        highest_score: y.standing?.highest_score ?? null,
        custom_stat: y.standing?.custom_stat ?? null,
        played: y.standing?.played ?? null,
        alliance: y.alliance
          ? { name: y.alliance.alliance_name, rank: y.alliance.alliance_rank, role: y.alliance.role }
          : null,
        awards: y.awards.map((a) => ({ name: a.name, class: a.class, sort_order: a.sort_order })),
        media: y.media ?? null,
        summary: y.summary ?? null, // reserved for a later phase
      };
    });

  return {
    team_id: team.team_id,
    team,
    career: {
      seasons_present: yearsPresent.length,
      first_season: yearsPresent.length ? Math.min(...yearsPresent.map((y) => y.year)) : null,
      last_season: yearsPresent.length ? Math.max(...yearsPresent.map((y) => y.year)) : null,
      // The denominator. Must be rendered next to every career figure.
      record_years: recordYears,
      record_contiguous: recordYears.length > 0
        && recordYears[recordYears.length - 1] - recordYears[0] === recordYears.length - 1,
      matches: career.matches,
      w: career.w, l: career.l, t: career.t,
      win_rate: winRate(career),
      medals: {
        gold: awardTally?.gold ?? 0,
        silver: awardTally?.silver ?? 0,
        bronze: awardTally?.bronze ?? 0,
        honorable: awardTally?.honorable ?? 0,
        unclassed: awardTally?.unclassed ?? 0,
        total: awardTally?.total ?? 0,
      },
      best_rank: bestRank ? { year: bestRank.year, rank: bestRank.standing.rank } : null,
    },
    timeline,
    awards: perYear
      .flatMap((y) => y.awards.map((a) => ({ year: y.year, ...a })))
      .sort((a, b) => b.year - a.year || (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  };
}

export function buildTeamSeason(team, yearData) {
  const { year, meta, standing, awards, alliance, matches, videoOpts, media } = yearData;
  if (!standing && !awards.length && !matches.length && !alliance) return null;

  const record = recordForYear(standing);

  return {
    team_id: team.team_id,
    year,
    team,
    media: media ?? null,
    coverage: meta.data_coverage,
    standing: standing
      ? {
          rank: standing.rank,
          rank_change: standing.rank_change,
          played: standing.played,
          ranking_score: standing.ranking_score,
          highest_score: standing.highest_score,
          custom_stat: standing.custom_stat,
          record: record ? { w: record.w, l: record.l, t: record.t } : null,
          record_source: record?.source ?? null,
          win_rate: record ? winRate(record) : null,
        }
      : null,
    alliance: alliance ?? null,
    awards: awards.map((a) => ({ name: a.name, class: a.class, sort_order: a.sort_order })),
    // Compact rows in THIS team's context: the same match is red for one team and
    // blue for the other, so `is_team_red` can only be resolved here.
    matches: matches
      .slice()
      .sort(byStageThenId)
      .map((m) => matchRowForTeam(m, team.team_id, videoOpts)),
    links: {
      self: href.teamSeason(team.team_id, year),
      team: href.team(team.team_id),
      season: href.season(year),
    },
  };
}
