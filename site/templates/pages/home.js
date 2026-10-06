/**
 * / — Home.
 *
 * Not a landing page: a reference tool's front door is the densest useful
 * overview it has — the seasons, the leaders, and the way to everything else.
 */

import { layout } from '../layout.js';
import { brand, t } from '../brand.js';
import { esc, wlt, num, dateRange, DASH } from '../html.js';
import * as b from '../blocks.js';

export function render(p, ctx) {
  const counts = b.statBoxes([
    { label: t('seasons'), value: num(p.counts.seasons) },
    { label: t('matchesLabel'), value: num(p.counts.matches) },
  ]) + b.statBoxes([
    { label: t('teamsIndex'), value: num(p.counts.teams) },
    { label: t('registry'), value: num(p.counts.registry) },
  ]);

  const seasons = b.dataTable({
    head: [{ label: t('year') }, { label: t('host') }, { label: t('dates') }, { label: t('game') }, { label: t('coverage') }],
    rows: p.seasons.map((s) => [
      { v: b.yearLink(s.year, s.href), html: true },
      esc([s.host_city, s.host_country].filter(Boolean).join(', ') || DASH),
      esc(dateRange(s.start_date, s.end_date)),
      esc(s.game_name ?? DASH),
      { v: b.coveragePill(s.data_coverage) || DASH, html: true },
    ]),
  });

  const medals = b.dataTable({
    head: [{ label: t('teamsIndex') }, { label: t('gold'), num: true }, { label: t('silver'), num: true }, { label: t('bronze'), num: true }],
    rows: p.medal_leaders.gold.map((r) => [
      { v: b.teamLink(r.team_id, ctx), html: true },
      { v: num(r.gold), num: true },
      { v: num(r.silver), num: true },
      { v: num(r.bronze), num: true },
    ]),
  });

  const ranks = b.dataTable({
    head: [{ label: t('teamsIndex') }, { label: t('year'), num: true }, { label: t('rank'), num: true }, { label: t('record'), num: true }],
    rows: p.medal_leaders.best_rank.map((r) => [
      { v: `<a href="${esc(r.href)}">${esc(r.team_id.toUpperCase())}</a>`, html: true },
      { v: esc(r.year), num: true },
      { v: num(r.rank), num: true },
      { v: esc(wlt(r.record)), num: true },
    ]),
  });

  const mostSeasons = b.dataTable({
    head: [{ label: t('teamsIndex') }, { label: t('seasonsCount'), num: true }, { label: t('firstSeason'), num: true }, { label: t('season'), num: true }],
    rows: p.medal_leaders.most_seasons.map((r) => [
      { v: `<a href="${esc(r.href)}">${esc(r.team_id.toUpperCase())}</a>`, html: true },
      { v: num(r.count), num: true },
      { v: num(r.first), num: true },
      { v: num(r.last), num: true },
    ]),
  });

  const active = p.active_season
    ? `<h2><a href="${esc(p.active_season.links.self)}">${esc(t('season'))} ${esc(p.active_season.year)}</a></h2>${b.coverageNotice(p.active_season.coverage)}`
    : '';

  const body = `<h1>${esc(brand.name)}</h1>
${counts}
${active}
${seasons}
<h2>${esc(t('medalsTable'))}</h2>${medals}
<h2>${esc(t('seasonsPresent'))}</h2>${mostSeasons}
<h2>${esc(t('bestRank'))}</h2>${ranks}`;

  return layout({
    title: null,
    description: `An independent archive of the FIRST Global Challenge: ${p.counts.seasons} seasons, ${p.counts.matches} matches, ${p.counts.registry} teams.`,
    body,
    pageId: 'home',
    assetHash: ctx.assetHash,
  });
}
