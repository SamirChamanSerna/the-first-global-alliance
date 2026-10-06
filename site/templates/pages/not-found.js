/**
 * 404 — must not be a dead end.
 *
 * Same signature as every other page: `render(payload, ctx)`. The payload is the
 * only one the build constructs by hand, because a 404 has no artifact behind it.
 */

import { layout } from '../layout.js';
import { t } from '../brand.js';
import { esc } from '../html.js';
import * as b from '../blocks.js';

export function render({ sample = [] } = {}, ctx) {
  const body = `<h1>${esc(t('notFoundTitle'))}</h1>
${b.summaryLine(esc(t('notFoundBody')))}
<p><a href="/seasons/">${esc(t('seasons'))}</a> · <a href="/teams/">${esc(t('teamsIndex'))}</a> · <a href="/search/">${esc(t('searchNav'))}</a></p>
${sample.length ? `<div class="lbl">${esc(t('teamsIndex'))}</div><p>${sample.map((id) => b.teamLink(id, ctx)).join(' ')}</p>` : ''}`;

  return layout({
    title: t('notFoundTitle'),
    description: t('notFoundBody'),
    body,
    pageId: null,
    assetHash: ctx.assetHash,
  });
}
