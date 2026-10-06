/**
 * /insights/ — all-time distributions.
 *
 * The reference groups by region. This archive has no region field on a team,
 * and deriving one from the ISO code would be inventing the data, so the
 * grouping is by `entity_type` — country, continental team, refugee team — which
 * the registry actually carries.
 */

import { layout } from '../layout.js';
import { t } from '../brand.js';
import { esc, num } from '../html.js';
import * as b from '../blocks.js';
import { barChart } from '../charts.js';

export function render(p, ctx) {
  const distribution = barChart({
    title: t('seasonsDistribution'),
    desc: `${t('seasonsDistribution')}: ${t('teamsIndex')} ${t('of')} ${esc(String(p.counts.teams))}`,
    caption: `${esc(String(p.counts.teams))} ${esc(t('teamNoun'))} · ${esc(String(p.counts.competed))} ${esc(t('played').toLowerCase())}`,
    buckets: p.seasons_distribution.map((d) => ({ label: String(d.seasons), count: d.count })),
    series: [{ key: 'count', label: t('teamsIndex'), slot: 'a' }],
  });

  const types = b.dataTable({
    head: [
      { label: t('entityType') }, { label: t('teamsIndex'), num: true }, { label: t('played'), num: true },
      { label: t('gold'), num: true }, { label: t('silver'), num: true }, { label: t('bronze'), num: true },
      { label: t('honorable'), num: true }, { label: t('total'), num: true },
    ],
    rows: p.entity_types.map((row) => [
      esc(row.type),
      { v: num(row.teams), num: true },
      { v: num(row.competed), num: true },
      { v: num(row.medals.gold), num: true },
      { v: num(row.medals.silver), num: true },
      { v: num(row.medals.bronze), num: true },
      { v: num(row.medals.honorable), num: true },
      { v: `<b>${num(row.medals.total)}</b>`, html: true },
    ]),
  });

  const mostAwarded = b.dataTable({
    head: [
      { label: t('teamsIndex') }, { label: t('gold'), num: true }, { label: t('silver'), num: true },
      { label: t('bronze'), num: true }, { label: t('honorable'), num: true }, { label: t('total'), num: true },
    ],
    rows: p.most_awarded.map((r) => [
      { v: b.teamLink(r.team_id, ctx), html: true },
      { v: num(r.gold), num: true },
      { v: num(r.silver), num: true },
      { v: num(r.bronze), num: true },
      { v: num(r.honorable), num: true },
      { v: `<b>${num(r.total)}</b>`, html: true },
    ]),
  });

  const body = `<h1>${esc(t('insightsAll'))}</h1>
<div class="when">${esc(String(p.counts.seasons))} ${esc(t('seasons').toLowerCase())} · ${esc(String(p.counts.awards))} ${esc(t('awardsLabel').toLowerCase())}</div>
<h2>${esc(t('awardsByType'))}</h2>
${types}
<h2>${esc(t('participationByType'))}</h2>
${distribution}
<h2>${esc(t('mostAwarded'))}</h2>
${mostAwarded}`;

  return layout({
    title: t('insightsAll'),
    description: 'All-time FIRST Global Challenge distributions: awards and participation by entity type, seasons played, most awarded teams.',
    body,
    pageId: 'insights',
    assetHash: ctx.assetHash,
  });
}
