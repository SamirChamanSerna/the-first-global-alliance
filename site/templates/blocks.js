/**
 * Shared blocks — the vocabulary every page is assembled from.
 *
 * Each block is a transcription of a `<!-- @component:… -->` block of
 * docs/web-style-guide/Demo-team-match/demo-team-match.html and uses ONLY the
 * class names defined in site/css/components.css (plus the guide-defined
 * additions in site/css/guide.css). No literal UI text: every string comes from
 * brand.js through t(). No literal colours: colours live in tokens.css.
 *
 * Pure string functions. No DOM, no I/O, no Date.now(), so the same output is
 * produced in Node at build time and in the browser during live hydration.
 *
 * `ctx` is `{ teamById, flags, href, groupByStage }`. `href` and `groupByStage`
 * are the very functions from pipeline/emit/lib.mjs, passed in rather than
 * re-implemented, so there is one definition of a URL shape and one of the
 * stage order.
 */

import { brand, t } from './brand.js';
import { esc, attr, cls, wlt, pct, num, timeLocal, dateRange, DASH } from './html.js';

// ---------------------------------------------------------------------------
// Team identity

/** The stage key → label key map. The labels themselves live in brand.js. */
const STAGE_KEY = { ranking: 'stageRanking', round_robin: 'stageRoundRobin', finals: 'stageFinals' };

export const stageLabel = (stage) => t(STAGE_KEY[stage] ?? 'stageRanking');

/**
 * A team's flag, from the vendored lipis/flag-icons set (MIT). Entities without
 * a country flag — the continental teams, the refugee team — get the demo's code
 * cell, which is a defined state and not a broken image.
 */
export function flag(team) {
  const iso2 = team?.iso2;
  if (iso2) {
    return `<img class="fl" src="/assets/flags/${esc(iso2)}.svg" alt="" width="16" height="11" loading="lazy" decoding="async">`;
  }
  return '<i class="fl none" aria-hidden="true"></i>';
}

/** The three-letter code shown next to the flag. Uppercased, always. */
export const code3 = (team, teamId) => String(team?.code3 || teamId || '???').toUpperCase().slice(0, 3);

/** Flag + code, linked. The `t me` mark is the visitor's team (§3.12). */
export function teamLink(teamId, ctx, { viewer = false, link = true } = {}) {
  const team = ctx?.teamById?.get(teamId);
  const inner = `${flag(team)}${esc(code3(team, teamId))}`;
  const klass = cls('t', viewer && 'me');
  if (!link || !ctx?.href) return `<span class="${klass}">${inner}</span>`;
  return `<a class="${klass}" href="${esc(ctx.href.team(teamId))}">${inner}</a>`;
}

/** A season's year, linked only when the build produced a page for it. */
export const yearLink = (year, href) =>
  href ? `<a href="${esc(href)}">${esc(year)}</a>` : esc(year);

/** A rounded chip. Alliance members use it in the season block. */
export function chip(label, href = null) {
  return href
    ? `<a class="chip" href="${esc(href)}">${esc(label)}</a>`
    : `<span class="chip">${esc(label)}</span>`;
}

// ---------------------------------------------------------------------------
// Medals and coverage

/** One medal pill: emoji and text ALWAYS together (§3.9). */
export function medalPip(key, count = null) {
  const medal = brand.medals[key];
  if (!medal) return '';
  const times = count === null ? '' : ` ×${count}`;
  return `<span class="pip">${medal.emoji} ${esc(medal.label)}${esc(times)}</span>`;
}

/** The four tiers, plus recognitions that carry no tier. */
export function medalTally(medals) {
  if (!medals) return DASH;
  const tiers = ['gold', 'silver', 'bronze', 'honorable']
    .filter((k) => (medals[k] ?? 0) > 0)
    .map((k) => medalPip(k, medals[k]));
  if (medals.unclassed) tiers.push(`<span class="pip">${esc(t('unclassed'))} ×${medals.unclassed}</span>`);
  return tiers.length ? tiers.join(' ') : DASH;
}

/** An award's tier. A recognition with no class says "Award" rather than being
 *  promoted to a medal it does not have. */
export const awardPip = (cls_) =>
  cls_ ? medalPip(cls_) : `<span class="pip">${esc(t('unclassed'))}</span>`;

/** The season's stream/playlist link, if the owner has recorded one (D-F). */
export const watchHrefOf = (videos) => videos?.playlist_url || videos?.streams_url || null;

const COVERAGE_MSG = {
  awards_only: 'covAwardsOnly',
  standings_only: 'covStandingsOnly',
  upcoming: 'covUpcoming',
  none: 'covNone',
};

const COVERAGE_SHORT = {
  awards_only: 'covShortAwards',
  standings_only: 'covShortStandings',
  upcoming: 'covShortUpcoming',
  none: 'covShortNone',
};

/**
 * Partial data says so, inline, next to the number. This is the banner that
 * keeps the site trustworthy, and it is mandatory wherever coverage is not full.
 */
export function coverageNotice(coverage, extra = '') {
  const key = COVERAGE_MSG[coverage];
  if (!key) return '';
  return `<div class="cov">${esc(t(key))}${extra}</div>`;
}

export function coveragePill(coverage) {
  const key = COVERAGE_SHORT[coverage];
  if (!key) return '';
  return `<span class="pip">${esc(t(key))}</span>`;
}

// ---------------------------------------------------------------------------
// Data primitives

/** An uppercase, muted section label (§3.6). */
export const sectionLabel = (key) => `<div class="lbl">${esc(t(key))}</div>`;

/** A label-left / value-right row; `total` adds the rule and the bold (§3.6). */
export function kvRow(label, value, { total = false } = {}) {
  return `<div class="kvr${total ? ' tot' : ''}"><span>${esc(label)}</span><span>${value}</span></div>`;
}

/** Up to two stat boxes per row, never more (§3.5). */
export function statBoxes(boxes) {
  if (!boxes.length) return '';
  return `<div class="boxes">${boxes
    .map((b) => `<div class="box"><small>${esc(b.label)}</small><b>${b.value}</b>${b.note ? `<small>${esc(b.note)}</small>` : ''}</div>`)
    .join('')}</div>`;
}

/** One line with the key figures in bold, between two rules (§3.4). */
export const summaryLine = (html) => `<p class="sum">${html}</p>`;

// ---------------------------------------------------------------------------
// Photos (§3.3 carousel frame, §3.7 Media). Both ship empty: no team has a
// photo yet, and the frame is the defined state rather than a void.

const NO_PHOTO = `<span class="when">🎞️ ${esc(t('noPhoto'))}</span>`;

/** The 4:3 frame plus its pagination dots. */
export function photoFrame() {
  return `<div class="photo">${NO_PHOTO}</div><div class="dots"><i class="on"></i><i></i><i></i></div>`;
}

/** The Media strip: same frame, three slots, still empty. */
export function mediaStrip(slots = 3) {
  const one = `<div class="photo">${NO_PHOTO}</div>`;
  return `<div class="vids">${Array.from({ length: slots }, () => one).join('')}</div>`;
}

// ---------------------------------------------------------------------------
// Match rendering — the most reused group in the project

/**
 * One row of a match list. Red alliance above blue on narrow screens; six cells
 * on one line above 900 px. The demo's own grid does that, untouched.
 *
 * Winner and loser are told apart by tone AND by the bold-underline on the
 * winning score, so colour is never the only channel (§3.12).
 */
export function matchRow(row, ctx, { viewerTeamId = null } = {}) {
  const label = `#${esc(String(row.match_id).split(':').pop())}`;
  const time = timeLocal(row.scheduled_time);
  const field = row.field === null || row.field === undefined ? DASH : esc(row.field);
  const when = `${row.played ? '' : `${t('approx')} `}${esc(time)} · ${esc(t('field'))} ${field}`;

  const video = row.video?.url
    ? `<a class="pl" href="${esc(row.video.url)}" rel="noopener" aria-label="${esc(t('watch'))}"></a>`
    : '';

  const played = row.played === true;
  const redWon = played && row.result === 'red';
  const blueWon = played && row.result === 'blue';
  const redTone = !played || row.result === 'tie' ? 'neu' : redWon ? 'win' : 'lose';
  const blueTone = !played || row.result === 'tie' ? 'neu' : blueWon ? 'win' : 'lose';

  const score = (value, won) => {
    if (!played || value === null || value === undefined) return DASH;
    return won ? `<b class="w">${esc(value)}</b>` : esc(value);
  };

  const cells = (ids) =>
    ids.map((id) => teamLink(id, ctx, { viewer: id === viewerTeamId })).join('');

  return `<div class="m"${attr('data-field', row.field ?? null)}>
<span class="c-pl">${video}</span>
<a class="lb" href="${esc(row.href)}" title="${esc(row.name ?? '')}">${label}<small>${when}</small></a>
<div class="ra ${redTone}">${cells(row.red)}</div>
<div class="ba ${blueTone}">${cells(row.blue)}</div>
<span class="rs ${redTone}">${score(row.red_score, redWon)}</span>
<span class="bs ${blueTone}">${score(row.blue_score, blueWon)}</span>
</div>`;
}

/**
 * The stage bar. `.stg` is a three-column grid, so it ALWAYS gets three
 * children: omitting the link would slide the name into the wrong column.
 *
 * `watchHref` is the season's stream/playlist link (D-F). It is shown on the
 * first stage bar only, because there is one playlist per season, not per stage.
 */
export function stageHeader({ stage, watchHref = null }) {
  const link = watchHref
    ? `<a href="${esc(watchHref)}" rel="noopener">${esc(t('watchAllVideos'))}</a>`
    : '<i></i>';
  return `<div class="stg"><i></i><b>${esc(stageLabel(stage))}</b>${link}</div>`;
}

/** A list of matches grouped by stage. */
export function matchTable(matches, ctx, { viewerTeamId = null, watchHref = null, groups = null } = {}) {
  const staged = groups ?? ctx.groupByStage(matches);
  if (!staged.length) return `<p class="note">${esc(t('noMatches'))}</p>`;
  return staged
    .map((g, i) =>
      stageHeader({ stage: g.stage, watchHref: i === 0 ? watchHref : null }) +
      g.matches.map((m) => matchRow(m, ctx, { viewerTeamId })).join(''),
    )
    .join('');
}

/** The match page's scoreboard: red above blue, score in its own column (§3.19). */
export function scoreboard(match, ctx, { viewerTeamId = null } = {}) {
  const played = match.played === true;
  const redWon = played && match.result === 'red';
  const blueWon = played && match.result === 'blue';
  const redTone = !played || match.result === 'tie' ? 'neu' : redWon ? 'win' : 'lose';
  const blueTone = !played || match.result === 'tie' ? 'neu' : blueWon ? 'win' : 'lose';

  const side = (alliance, tone) =>
    match.alliances[alliance]
      .map((p) => {
        const mark = p.disqualified
          ? `<small title="${esc(t('disqualified'))}">${esc(t('dqShort'))}</small>`
          : p.no_show
            ? `<small title="${esc(t('noShow'))}">${esc(t('nsShort'))}</small>`
            : '';
        return teamLink(p.team_id, ctx, { viewer: p.team_id === viewerTeamId }) + mark;
      })
      .join('');

  const score = (value, won) =>
    !played || value === null || value === undefined
      ? DASH
      : won
        ? `<b class="w">${esc(value)}</b>`
        : esc(value);

  return `<div class="sb"><div class="hd2">${esc(t('teams'))}</div><div class="hd2">${esc(t('score'))}</div>
<div class="ra ${redTone}">${side('red')}</div><span class="rs ${redTone}">${score(match.score.red, redWon)}</span>
<div class="ba ${blueTone}">${side('blue')}</div><span class="bs ${blueTone}">${score(match.score.blue, blueWon)}</span></div>`;
}

/**
 * The scoring breakdown (§3.19): three columns, red | label | blue.
 *
 * Tones follow §3.19, which is the opposite logic to the match table: the
 * strong tone marks a TOTAL row and the soft tone a DETAIL row, whoever won.
 * The arrow points at the higher side and is never the only signal — both
 * values are always on screen.
 */
export function breakdownTable(rows, ctx) {
  if (!rows?.length) return '';

  const arrow = (side, lead) =>
    `<span class="ar">${lead === side ? esc(t(side === 'red' ? 'arrowLeft' : 'arrowRight')) : ''}</span>`;

  // A per-robot cell stacks one chip and its value per robot (§3.19, `robots`).
  const cellOf = (value, side, ctx_) => {
    if (Array.isArray(value)) {
      return value
        .map((r) => {
          const team = ctx_?.teamById?.get(r.team_id);
          const link = r.team_id && ctx_?.href ? ctx_.href.team(r.team_id) : null;
          return `${chip(code3(team, r.team_id), link)} ${r.value === null || r.value === undefined ? DASH : esc(r.value)}`;
        })
        .join('<br>');
    }
    return value === null || value === undefined ? DASH : esc(value);
  };

  const body = rows
    .map((r) => {
      const strong = r.kind === 'total';
      const left = strong ? 'rw' : 'rl';
      const right = strong ? 'bw' : 'bl';
      const tall = r.kind === 'robots' ? ' tall' : '';
      const labelCls = `lb${strong ? ' tot' : ''}`;
      return `<tr><td class="${left}${tall}">${cellOf(r.red, 'red', ctx)}</td><td class="${labelCls}">${arrow('red', r.lead)}<span>${esc(r.label)}</span>${arrow('blue', r.lead)}</td><td class="${right}${tall}">${cellOf(r.blue, 'blue', ctx)}</td></tr>`;
    })
    .join('');

  return `<table class="bd"><tbody>${body}</tbody></table>`;
}

/** The demo's video card without a thumbnail: score, and the link if there is one. */
export function videoFallback({ label, red, blue, detail = null, href = null }) {
  return `<div class="vb"><small class="when">${esc(label)}</small>
<div class="sc"><div class="tn-rl"><b>${red.score}</b><small>${red.codes}</small></div><div class="tn-bw"><b>${blue.score}</b><small>${blue.codes}</small></div></div>
${detail ? `<small class="when">${esc(detail)}</small>` : ''}
${href ? `<a class="go" href="${esc(href)}" rel="noopener">${esc(t('watch'))}</a>` : ''}</div>`;
}

// ---------------------------------------------------------------------------
// Data tables (§3.13). The guide defines this component; the demo has no table
// other than the score breakdown, so it is transcribed in site/css/guide.css.

/**
 * @param {{ head?: Array<{label:string,num?:boolean}>, rows: Array<Array<*>>, caption?: string }} spec
 * A cell is a bare value (escaped, or an em dash when null) or `{ v, num, html }`
 * when it is pre-rendered markup or a number that must be right-aligned.
 */
export function dataTable({ head = [], rows = [], caption = null, rowAttr = null }) {
  const cell = (c, tag, isHead = false) => {
    const obj = c !== null && typeof c === 'object';
    const value = obj ? c.v : c;
    const numeric = obj ? c.num : false;
    const body = value === null || value === undefined ? DASH : obj && c.html ? value : esc(value);
    return `<${tag}${attr('class', numeric ? 'r' : null)}>${body}</${tag}>`;
  };

  const thead = head.length
    ? `<thead><tr>${head.map((h) => cell({ v: h.label, num: h.num }, 'th', true)).join('')}</tr></thead>`
    : '';

  const tbody = rows
    .map((r, i) => `<tr${rowAttr ? rowAttr(i, r) : ''}>${r.map((c) => cell(c, 'td')).join('')}</tr>`)
    .join('');

  return `<div class="dtwrap"><table class="dt">${caption ? `<caption>${esc(caption)}</caption>` : ''}${thead}<tbody>${tbody}</tbody></table></div>`;
}

export { wlt, pct, num, esc, attr, cls, dateRange, DASH };
