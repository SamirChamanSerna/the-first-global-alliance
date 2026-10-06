/**
 * /matches/<year>/<stage>/<id>/ — one match.
 *
 * The reference opens the match as a modal over the team page; here it is a
 * full page that works with JavaScript disabled (guide §3.19). The order is the
 * reference's: title, then two columns (breakdown | video), then context.
 *
 * The breakdown renders the season's own scoring vocabulary, paired by side. It
 * is built generically in pipeline/emit/breakdown.mjs — there is no per-year
 * code here, and adding a season adds no template.
 */

import { layout } from '../layout.js';
import { t } from '../brand.js';
import { esc, num, timeLocal, DASH } from '../html.js';
import * as b from '../blocks.js';

export function render(m, ctx) {
  const time = timeLocal(m.scheduled_time);
  const field = m.field === null || m.field === undefined ? DASH : m.field;

  // ── title and meta ────────────────────────────────────────────────────────
  const meta = `${esc(t('field'))} ${esc(field)} · ${esc(time)}`;

  // ── breakdown: the season's rows, plus the final score as the total ───────
  const rows = [...(m.breakdown?.rows ?? [])];
  if (m.played && m.score.red !== null && m.score.blue !== null) {
    rows.push({
      kind: 'total',
      label: t('finalScore'),
      red: m.score.red,
      blue: m.score.blue,
      lead: m.result === 'red' ? 'red' : m.result === 'blue' ? 'blue' : null,
    });
  }

  const penalties = m.penalties
    ? (m.penalties.red.minor ?? 0) + (m.penalties.red.major ?? 0) + (m.penalties.blue.minor ?? 0) + (m.penalties.blue.major ?? 0)
    : 0;

  const singles = m.breakdown?.singles?.length
    ? b.sectionLabel('seasonValues') +
      m.breakdown.singles
        .map((s) => b.kvRow(s.label, s.value === null || s.value === undefined ? DASH : esc(s.value)))
        .join('')
    : '';

  // ── video (§3.16 B: no thumbnail exists for any match, so the score card) ─
  const codes = (ids) => ids.map((id) => b.code3(ctx.teamById.get(id), id)).join(' · ');
  // `.vb .sc b` carries the size, so the cell is always a `<b>`; the winner adds
  // the demo's bold-underline mark on top of it.
  const scoreCell = (value, won) =>
    !m.played || value === null ? DASH : won ? `<b class="w">${esc(value)}</b>` : `<b>${esc(value)}</b>`;

  const video = `<div class="vb"><small class="when">${esc(m.name)}${m.played ? '' : ` · ${esc(t('estimated'))}`}</small>
<div class="sc"><div class="tn-rl">${scoreCell(m.score.red, m.result === 'red')}<small>${esc(codes(m.alliances.red.map((p) => p.team_id)))}</small></div><div class="tn-bw">${scoreCell(m.score.blue, m.result === 'blue')}<small>${esc(codes(m.alliances.blue.map((p) => p.team_id)))}</small></div></div>
${m.video?.url ? `<a class="go" href="${esc(m.video.url)}" rel="noopener">${esc(t('watch'))}</a>` : `<small class="when">${esc(t('noVideos'))}</small>`}</div>`;

  const context = m.same_field?.length
    ? `<section class="ev"><div class="span-all"><h2>${esc(t('otherMatchesOnField'))}</h2>${b.matchTable(m.same_field, ctx, { watchHref: null })}</div></section>`
    : '';

  const body = `<section class="ev"><div class="mh span-all">
<div>
<h2>${esc(m.name)} · ${esc(t('season'))} ${m.year}</h2>
<div class="when">${meta}</div>
${b.scoreboard(m, ctx)}
${penalties ? b.kvRow(t('penalties'), esc(penalties)) : ''}
${b.breakdownTable(rows, ctx)}
${rows.length ? `<p class="note">${esc(t('breakdownNote'))}</p>` : ''}
${singles}
</div>
<div class="vids">${video}</div>
</div></section>
${context}`;

  return layout({
    title: `${m.name} · ${m.year}`,
    description: `${m.name} at the FIRST Global Challenge ${m.year}.`,
    body,
    pageId: 'seasons',
    assetHash: ctx.assetHash,
  });
}
