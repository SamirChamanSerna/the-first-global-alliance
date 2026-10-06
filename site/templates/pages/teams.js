/**
 * /teams/ — the team registry.
 *
 * Every entity the registry knows is listed, including the ones that have never
 * competed. A team the registry holds must be findable; hiding it because it has
 * no results would make the registry a lie.
 */

import { layout } from '../layout.js';
import { t } from '../brand.js';
import { esc, num, DASH } from '../html.js';
import * as b from '../blocks.js';

const seasonsRange = (years) =>
  !years.length ? DASH : years.length === 1 ? String(years[0]) : `${years[0]}–${years[years.length - 1]}`;

function table(rows, ctx) {
  return b.dataTable({
    head: [
      { label: t('teamsIndex') }, { label: t('entityType') }, { label: t('seasonsCount'), num: true },
      { label: t('season'), num: true }, { label: t('medalsLabel') },
    ],
    rows: rows.map((r) => [
      { v: b.teamLink(r.team_id, ctx), html: true },
      esc(r.entity_type ?? DASH),
      { v: num(r.seasons_count), num: true },
      { v: esc(seasonsRange(r.seasons_active)), num: true },
      { v: b.medalTally(r.medals), html: true },
    ]),
  });
}

export function render(p, ctx) {
  const never = p.never_competed;

  const body = `<h1>${esc(t('teamsIndex'))}</h1>
<div class="when">${esc(p.total)} ${esc(t('teamNoun'))}</div>
${table(p.competed, ctx)}
${never.length
      ? `<h2>${esc(t('registry'))}</h2><p class="note">${esc(t('neverCompeted'))}</p>${table(never, ctx)}`
      : ''}`;

  return layout({
    title: t('teamsIndex'),
    description: `Every team in the FIRST Global Challenge archive: ${p.total} entities.`,
    body,
    pageId: 'teams',
    assetHash: ctx.assetHash,
  });
}
