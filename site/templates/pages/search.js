/**
 * /search/ — the team registry, filtered in the browser.
 *
 * The whole list is rendered into the HTML, so the page is complete and usable
 * with JavaScript off; the filter only hides rows that are already there. The
 * `data-key` each row carries was folded at build time (lowercased, accents
 * stripped, every name and ISO code joined), so the client does one `includes()`.
 */

import { layout } from '../layout.js';
import { t } from '../brand.js';
import { esc, num, attr, DASH } from '../html.js';
import * as b from '../blocks.js';

export function render(p, ctx) {
  const rows = p.teams.map((team) => [
    { v: b.teamLink(team.team_id, ctx), html: true },
    esc(team.entity_type ?? DASH),
    esc(team.code3 ?? DASH),
    { v: num(team.seasons), num: true },
    { v: num(team.first_season), num: true },
  ]);

  const table = b.dataTable({
    head: [
      { label: t('teamsIndex') }, { label: t('entityType') }, { label: t('iso') },
      { label: t('seasonsCount'), num: true }, { label: t('firstSeason'), num: true },
    ],
    rows,
    // The folded key the client filter matches against. It is data, so it is
    // read here rather than re-derived in the browser.
    rowAttr: (i) => attr('data-key', p.teams[i].key) + attr('data-search-row', true),
  });

  const body = `<h1>${esc(t('searchNav'))}</h1>
<div class="when">${esc(String(p.count))} ${esc(t('teamNoun'))}</div>
<div class="qwrap"><input class="q" type="search" data-search placeholder="${esc(t('search'))}" aria-label="${esc(t('search'))}"></div>
<p class="note" data-search-summary hidden data-label-teams="${esc(t('teamNoun'))}" data-label-shown="${esc(t('shown'))}"></p>
${table}`;

  return layout({
    title: t('searchNav'),
    description: `Search the ${p.count} teams in the FIRST Global Challenge archive by name, ISO code or alias.`,
    body,
    pageId: 'search',
    assetHash: ctx.assetHash,
  });
}
