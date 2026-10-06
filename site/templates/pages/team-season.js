/**
 * /teams/<id>/<year>/ — Team / Season.
 *
 * This is the page the style guide's demo actually depicts, so it is the one
 * that exercises every block at once: the team header, the summary line, the
 * coverage notice, the stat boxes, the key/value rows and the match table.
 *
 * The reference's "regional pool points" section is omitted: FGC has no pool
 * points (guide §3.11). Its place is taken by the season's own scoring values,
 * which are the numbers the archive actually holds.
 */

import { layout, sectionMenu } from '../layout.js';
import { t } from '../brand.js';
import { esc, wlt, pct, num, dateRange, DASH } from '../html.js';
import * as b from '../blocks.js';

export function render(p, ctx) {
  const team = p.team;
  const seasonLabel = `${t('season')} ${p.year}`;
  const host = [p.season.host_city, p.season.host_country].filter(Boolean).join(', ');
  const iso = [team.iso2 ? String(team.iso2).toUpperCase() : null, team.code3].filter(Boolean).join(' / ');

  const { side, subbar } = sectionMenu({
    sections: [
      { id: 'info', label: t('teamInfo') },
      { id: `s${p.year}`, label: seasonLabel },
    ],
    years: (p.team_years ?? []).map((y) => ({
      label: String(y),
      href: ctx.href.teamSeason(p.team_id, y),
      current: y === p.year,
    })),
    currentId: 'info',
  });

  // ── header ────────────────────────────────────────────────────────────────
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

  // ── summary (§3.4): the denominator is stated next to every figure ────────
  const figures = [];
  if (p.standing?.record) {
    figures.push(`${esc(team.name)} went <b>${wlt(p.standing.record)}</b> (${pct(p.standing.win_rate)}) in ${p.year}`);
  }
  if (p.standing?.rank !== null && p.standing?.rank !== undefined) {
    const of = p.denominator ? ` ${esc(t('of'))} <b>${esc(p.denominator)}</b> ${esc(t('teamNoun'))}` : '';
    figures.push(`ranked <b>#${esc(p.standing.rank)}</b>${of}`);
  }
  const summary = b.summaryLine(
    figures.length ? `${figures.join(' and ')}.` : esc(t('noStandings')),
  );

  // ── season block, left column ─────────────────────────────────────────────
  const boxes = [];
  if (p.standing?.rank !== null && p.standing?.rank !== undefined) {
    boxes.push({ label: t('rank'), value: esc(p.standing.rank), note: p.denominator ? `${t('of')} ${p.denominator}` : null });
  }
  if (p.standing?.record) {
    boxes.push({ label: t('record'), value: wlt(p.standing.record), note: pct(p.standing.win_rate) });
  }

  const alliance = p.alliance
    ? `<div class="row"><span class="lbl">${esc(p.alliance.alliance_name)}</span><span>${p.alliance.members
        .map((m) => b.chip(b.code3(ctx.teamById.get(m.team_id), m.team_id), ctx.href.team(m.team_id)))
        .join(' ')}</span></div>`
    : '';

  const awards = p.awards.length
    ? b.sectionLabel('awards') + p.awards.map((a) => b.kvRow(a.name, b.awardPip(a.class))).join('')
    : b.sectionLabel('awards') + `<p class="note">${esc(t('noAwards'))}</p>`;

  const values = [];
  if (p.standing?.ranking_score !== null && p.standing?.ranking_score !== undefined) {
    values.push(b.kvRow(t('rankingScore'), esc(p.standing.ranking_score)));
  }
  if (p.standing?.custom_stat?.value !== null && p.standing?.custom_stat?.value !== undefined) {
    values.push(b.kvRow(p.season.ranking_stat_name ?? t('seasonValues'), esc(p.standing.custom_stat.value)));
  }
  if (p.standing?.highest_score !== null && p.standing?.highest_score !== undefined) {
    values.push(b.kvRow(t('highestScore'), esc(p.standing.highest_score), { total: true }));
  }
  const valueBlock = values.length ? b.sectionLabel('seasonValues') + values.join('') : '';

  const seasonBlock = `<!-- @component:season-block -->
<section id="s${p.year}" class="ev"><div>
<h2><a href="${esc(p.links.season)}">${esc(seasonLabel)}${p.season.game_name ? ` · ${esc(p.season.game_name)}` : ''}</a></h2>
<div class="when">${esc(dateRange(p.season.start_date, p.season.end_date))}${host ? ` · ${esc(host)}` : ''}</div>
${b.statBoxes(boxes)}
${alliance}
${awards}
${valueBlock}
</div>
<div>${b.matchTable(p.matches, ctx, { viewerTeamId: p.team_id, watchHref: b.watchHrefOf(p.season.videos) })}</div>
</section>
<!-- @end:season-block -->`;

  const body = `<section id="info">
${header}
${summary}
${b.coverageNotice(p.coverage)}
<h2>${esc(t('media'))}</h2>
${b.mediaStrip()}
</section>
${seasonBlock}`;

  return layout({
    title: `${team.name} · ${p.year}`,
    description: `${team.name} at the FIRST Global Challenge ${p.year}${host ? ` in ${host}` : ''}.`,
    body,
    side,
    subbar,
    pageId: 'teams',
    assetHash: ctx.assetHash,
  });
}
