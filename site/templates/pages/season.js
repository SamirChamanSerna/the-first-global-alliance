/**
 * /seasons/<year>/ — one season.
 *
 * Driven entirely by `data_coverage`: sections with no data are omitted, not
 * emptied. One template serves 2019 (awards only) and 2025 (everything) with no
 * branch on the year anywhere.
 */

import { layout } from '../layout.js';
import { t } from '../brand.js';
import { esc, wlt, pct, num, dateRange, DASH } from '../html.js';
import * as b from '../blocks.js';

export function render(p, ctx) {
  const host = [p.meta.host_city, p.meta.host_country].filter(Boolean).join(', ');

  const header = `<h1>${esc(p.year)}${p.meta.game_name ? ` · ${esc(p.meta.game_name)}` : ''}</h1>
<div class="when">${esc(dateRange(p.meta.start_date, p.meta.end_date))}${host ? ` · ${esc(host)}` : ''}${p.meta.theme ? ` · ${esc(p.meta.theme)}` : ''}</div>`;

  const counts = p.coverage === 'full'
    ? b.statBoxes([
        { label: t('teamsIndex'), value: num(p.counts.teams) },
        { label: t('matchesLabel'), value: num(p.counts.matches) },
      ]) + b.statBoxes([
        { label: t('awardsLabel'), value: num(p.counts.awards) },
        { label: p.meta.ranking_stat_name ?? t('rankingScore'), value: DASH },
      ])
    : '';

  const standings = p.standings_available
    ? `<h2>${esc(t('top10'))}</h2>${b.dataTable({
        head: [
          { label: t('rank'), num: true }, { label: t('teamsIndex') }, { label: t('record'), num: true },
          { label: t('rankingScore'), num: true }, { label: t('highestScore'), num: true },
          { label: p.meta.ranking_stat_name ?? t('seasonValues'), num: true },
        ],
        rows: p.standings_top.map((s) => [
          { v: num(s.rank), num: true },
          { v: b.teamLink(s.team_id, ctx), html: true },
          { v: esc(wlt(s.record)), num: true },
          { v: num(s.ranking_score), num: true },
          { v: num(s.highest_score), num: true },
          { v: num(s.custom_stat?.value), num: true },
        ]),
      })}`
    : '';

  const awardRows = p.awards.map((a) => [
    esc(a.name),
    {
      v: a.recipients
        .map((r) =>
          r.kind === 'team'
            ? b.teamLink(r.team_id, ctx)
            : `<span class="when">${esc(r.recipient_name ?? DASH)}</span>`,
        )
        .join(' '),
      html: true,
    },
    { v: a.recipients.filter((r) => r.kind === 'team').map((r) => b.awardPip(r.class)).join(' ') || DASH, html: true },
  ]);

  const awards = p.awards.length
    ? `<h2>${esc(t('awards'))}</h2>${b.dataTable({
        head: [{ label: t('awards') }, { label: t('teamsIndex') }, { label: t('medalsLabel') }],
        rows: awardRows,
      })}`
    : `<h2>${esc(t('awards'))}</h2><p class="note">${esc(t('noAwards'))}</p>`;

  const links = [
    p.links.matches ? `<a href="${esc(p.links.matches)}">${esc(t('allMatches'))}</a>` : null,
    p.links.insights ? `<a href="${esc(p.links.insights)}">${esc(t('seasonInsights'))}</a>` : null,
  ].filter(Boolean);

  const body = `${header}
${b.coverageNotice(p.coverage)}
${p.meta.synopsis ? `<p>${esc(p.meta.synopsis)}</p>` : ''}
${counts}
${standings}
${awards}
${links.length ? `<p>${links.join(' · ')}</p>` : ''}`;

  return layout({
    title: `${p.year}${p.meta.game_name ? ` · ${p.meta.game_name}` : ''}`,
    description: `FIRST Global Challenge ${p.year}${host ? ` in ${host}` : ''}: standings and awards.`,
    body,
    pageId: 'seasons',
    assetHash: ctx.assetHash,
  });
}
