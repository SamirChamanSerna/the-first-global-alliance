/**
 * /seasons/<year>/matches/ — every match of one season.
 *
 * The whole list is in the HTML: with JavaScript off this is simply the full
 * schedule, and the field filter only ever NARROWS what is already on screen.
 * It never fetches, and it never renders a match that the build did not.
 */

import { layout } from '../layout.js';
import { t } from '../brand.js';
import { esc } from '../html.js';
import * as b from '../blocks.js';

export function render(p, ctx) {
  const fields = [...new Set(p.stages.flatMap((s) => s.matches.map((m) => m.field)).filter((f) => f !== null && f !== undefined))].sort(
    (a, z) => a - z,
  );

  const filters = `<div class="seg" data-filters>
<button type="button" data-field="all" aria-pressed="true">${esc(t('allFields'))}</button>
${fields.map((f) => `<button type="button" data-field="${esc(f)}" aria-pressed="false">${esc(t('fieldNoun'))} ${esc(f)}</button>`).join('')}
</div>
<p class="note" data-filter-summary hidden data-label-matches="${esc(t('matchesLabel').toLowerCase())}" data-label-shown="${esc(t('shown'))}"></p>`;

  const body = `<h1>${esc(p.year)}${p.name ? ` · ${esc(p.name)}` : ''}</h1>
<div class="when">${esc(p.stages.reduce((n, s) => n + s.count, 0))} ${esc(t('matchesLabel').toLowerCase())} · ${esc(p.stage_count)} ${esc(t('stagesLabel'))}</div>
${filters}
${b.matchTable(null, ctx, { groups: p.stages, watchHref: b.watchHrefOf(p.videos) })}`;

  return layout({
    title: `${p.year} · ${t('allMatches')}`,
    description: `Every match of the FIRST Global Challenge ${p.year}, grouped by stage.`,
    body,
    pageId: 'seasons',
    assetHash: ctx.assetHash,
  });
}
