/**
 * /medals/ — the all-time medal table.
 *
 * Awards are the only series with uninterrupted coverage from 2017, which makes
 * this the most trustworthy view the archive publishes. Recognitions with no
 * class (judges', mentor and social-media awards) keep their own column: folding
 * them into a medal tier would inflate it.
 */

import { layout } from '../layout.js';
import { t } from '../brand.js';
import { esc, num, DASH } from '../html.js';
import * as b from '../blocks.js';

export function render(p, ctx) {
  const first = p.generated_for[0];
  const last = p.generated_for[p.generated_for.length - 1];

  const rows = p.rows.map((r, i) => [
    { v: esc(i + 1), num: true },
    { v: b.teamLink(r.team_id, ctx), html: true },
    { v: num(r.gold), num: true },
    { v: num(r.silver), num: true },
    { v: num(r.bronze), num: true },
    { v: num(r.honorable), num: true },
    { v: r.unclassed ? num(r.unclassed) : DASH, num: true },
    { v: `<b>${num(r.total)}</b>`, html: true },
  ]);

  // Totals row: bold, no new class — the emphasis is the weight (§1).
  if (p.rows.length) {
    const totals = p.totals;
    rows.push([
      DASH,
      { v: `<b>${esc(t('total'))}</b>`, html: true },
      { v: `<b>${num(totals.gold)}</b>`, html: true },
      { v: `<b>${num(totals.silver)}</b>`, html: true },
      { v: `<b>${num(totals.bronze)}</b>`, html: true },
      { v: `<b>${num(totals.honorable)}</b>`, html: true },
      { v: `<b>${num(totals.unclassed)}</b>`, html: true },
      { v: `<b>${num(p.totals.gold + totals.silver + totals.bronze + totals.honorable + totals.unclassed)}</b>`, html: true },
    ]);
  }

  const body = `<h1>${esc(t('medalsTable'))}</h1>
<div class="when">${esc(first)}–${esc(last)} · ${esc(p.row_count)} ${esc(t('teamNoun'))}</div>
${b.dataTable({
    head: [
      { label: '#', num: true }, { label: t('teamsIndex') },
      { label: t('gold'), num: true }, { label: t('silver'), num: true }, { label: t('bronze'), num: true },
      { label: t('honorable'), num: true }, { label: t('unclassed'), num: true }, { label: t('total'), num: true },
    ],
    rows,
  })}`;

  return layout({
    title: t('medalsTable'),
    description: `All-time medal table, ${first}–${last}: gold, silver, bronze and honorable mention by team.`,
    body,
    pageId: 'medals',
    assetHash: ctx.assetHash,
  });
}
