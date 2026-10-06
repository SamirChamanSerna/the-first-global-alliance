/**
 * /seasons/ — the season index.
 *
 * A data table (§3.13), not a grid of cards: the guide is a reference tool, and
 * a reader comparing ten seasons wants ten aligned rows.
 */

import { layout } from '../layout.js';
import { t } from '../brand.js';
import { esc, dateRange, DASH } from '../html.js';
import * as b from '../blocks.js';

export function render(p, ctx) {
  const rows = p.seasons.map((s) => [
    { v: b.yearLink(s.year, s.href), html: true },
    esc([s.host_city, s.host_country].filter(Boolean).join(', ') || DASH),
    esc(dateRange(s.start_date, s.end_date)),
    esc(s.game_name ?? DASH),
    esc(s.theme ?? DASH),
    { v: b.coveragePill(s.data_coverage) || DASH, html: true },
  ]);

  const body = `<h1>${esc(t('seasons'))}</h1>
${b.dataTable({
    head: [
      { label: t('year') }, { label: t('host') }, { label: t('dates') },
      { label: t('game') }, { label: t('theme') }, { label: t('coverage') },
    ],
    rows,
  })}`;

  return layout({
    title: t('seasons'),
    description: 'Every FIRST Global Challenge season in the archive, with its host, dates and coverage.',
    body,
    pageId: 'seasons',
    assetHash: ctx.assetHash,
  });
}
