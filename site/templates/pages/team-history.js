/**
 * /teams/<id>/ — Team History, the default team route.
 *
 * ── THE HONESTY RULE ────────────────────────────────────────────────────────
 *
 * A career record is only as good as the seasons it covers, and those seasons
 * are not contiguous: the record is trustworthy for 2019 and 2023–2025 and
 * absent for 2017, 2018 and 2022. Every career figure is therefore rendered next
 * to the list of years it counted, and a season with no record renders the year
 * and its awards with an explicit "no data" rather than a row of zeros.
 */

import { layout, sectionMenu } from '../layout.js';
import { t } from '../brand.js';
import { esc, wlt, pct, num, DASH } from '../html.js';
import * as b from '../blocks.js';

export function render(p, ctx) {
  const team = p.team;
  const iso = [team.iso2 ? String(team.iso2).toUpperCase() : null, team.code3].filter(Boolean).join(' / ');

  const header = `<!-- @component:team-header -->
<div class="hd"><div>
<div class="title">${b.flag(team)}<h1>${esc(team.name)}</h1></div>
<div class="kv">
<div><span>${esc(t('entityType'))}:</span> ${esc(team.entity_type ?? DASH)}</div>
<div><span>${esc(t('firstSeason'))}:</span> ${num(team.first_season)} · <span>${esc(t('seasonsActive'))}:</span> ${num(team.seasons_active.length)}</div>
<div><span>${esc(t('iso'))}:</span> ${esc(iso || DASH)}</div>
</div></div>
<div>${b.photoFrame()}</div></div>
<!-- @end:team-header -->`;

  if (p.never_competed || !p.career) {
    // The registry knows this entity, so the page exists — it just has nothing
    // to report. An empty table with one em dash would say less than this does.
    const body = `<section id="info">
${header}
${b.summaryLine(esc(t('neverCompeted')))}
<p><a href="/teams/">${esc(t('teamsIndex'))}</a> · <a href="/seasons/">${esc(t('seasons'))}</a></p>
</section>`;
    return layout({
      title: team.name,
      description: `${team.name} in the FIRST Global Challenge archive.`,
      body,
      pageId: 'teams',
      assetHash: ctx.assetHash,
    });
  }

  const career = p.career;
  const recordYears = career.record_years ?? [];

  // The denominator, stated next to every career figure (§4.1 of the plan).
  const covers = recordYears.length
    ? `<b>${esc(t('recordCovers'))} ${esc(recordYears[0])}${recordYears.length > 1 ? `–${esc(recordYears[recordYears.length - 1])}` : ''}${career.record_contiguous ? '' : ` (${recordYears.length} ${recordYears.length === 1 ? 'season' : 'seasons'})`}.</b>`
    : '';

  const boxes = [
    { label: t('seasonsPresent'), value: num(career.seasons_present) },
    { label: t('matchesLabel'), value: num(career.matches) },
    { label: t('record'), value: wlt(career), note: pct(career.win_rate) },
    { label: t('bestRank'), value: career.best_rank ? `#${esc(career.best_rank.rank)}` : DASH, note: career.best_rank ? String(career.best_rank.year) : null },
  ];

  const medals = b.medalTally(career.medals);

  // ── timeline: one row per season, newest first ────────────────────────────
  const timeline = p.timeline.map((row) => [
    { v: `<a href="${esc(row.href)}">${esc(row.year)}</a>`, html: true },
    esc([row.host_city, row.host_country].filter(Boolean).join(', ') || DASH),
    esc(row.game_name ?? DASH),
    row.rank === null || row.rank === undefined ? DASH : { v: row.rank, num: true },
    // A season with no trustworthy record shows an em dash, never 0–0–0.
    row.record ? { v: esc(wlt(row.record)), num: true } : DASH,
    row.win_rate === null || row.win_rate === undefined ? DASH : { v: pct(row.win_rate), num: true },
    row.alliance ? esc(row.alliance.name) : DASH,
    { v: row.awards.map((a) => b.awardPip(a.class)).join(' ') || DASH, html: true },
    { v: b.coveragePill(row.coverage) || DASH, html: true },
  ]);

  const timelineTable = b.dataTable({
    head: [
      { label: t('year') }, { label: t('host') }, { label: t('game') },
      { label: t('rank'), num: true }, { label: t('record'), num: true }, { label: t('winRate'), num: true },
      { label: t('alliance') }, { label: t('awards') }, { label: t('coverage') },
    ],
    rows: timeline,
  });

  // ── every award, by year ──────────────────────────────────────────────────
  const awardRows = p.awards.map((a) => [
    { v: esc(a.year), num: true },
    esc(a.name),
    { v: b.awardPip(a.class), html: true },
  ]);

  const awardsTable = p.awards.length
    ? `<h2 id="awards">${esc(t('awards'))}</h2>${b.dataTable({
        head: [{ label: t('year'), num: true }, { label: t('awards') }, { label: t('medalsLabel') }],
        rows: awardRows,
      })}`
    : `<h2 id="awards">${esc(t('awards'))}</h2><p class="note">${esc(t('noAwards'))}</p>`;

  const { side, subbar } = sectionMenu({
    sections: [
      { id: 'info', label: t('teamInfo') },
      { id: 'timeline', label: t('timeline') },
      { id: 'awards', label: t('awards') },
    ],
    currentId: 'info',
  });

  const body = `<section id="info">
${header}
${b.summaryLine(
    `${esc(team.name)} has competed in <b>${num(career.seasons_present)}</b> ${esc(t('seasons').toLowerCase())}${medals !== DASH ? `, with ${medals}` : ''}.`,
  )}
${covers ? `<div class="cov">${covers}</div>` : ''}
${b.statBoxes(boxes.slice(0, 2))}
${b.statBoxes(boxes.slice(2))}
<div class="lbl">${esc(t('medalsLabel'))}</div>
<div>${medals}</div>
<h2 id="timeline">${esc(t('timeline'))}</h2>
${timelineTable}
${awardsTable}
</section>`;

  return layout({
    title: team.name,
    description: `${team.name} in the FIRST Global Challenge archive: seasons, record, rank and awards.`,
    body,
    side,
    subbar,
    pageId: 'teams',
    assetHash: ctx.assetHash,
  });
}
