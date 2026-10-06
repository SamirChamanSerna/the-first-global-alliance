/**
 * /insights/<year>/ — one season's distributions.
 *
 * Scores are charted WITHIN a season and never across seasons: the scoring
 * system changes every year, so a 2023 score and a 2025 score are not the same
 * measurement and putting them on one axis would be a false comparison.
 */

import { layout } from '../layout.js';
import { t } from '../brand.js';
import { esc, num } from '../html.js';
import * as b from '../blocks.js';
import { barChart, scoreSeries } from '../charts.js';

export function render(p, ctx) {
  const matchCount = `${p.counts.matches} ${t('matchesLabel').toLowerCase()}`;

  const score = barChart({
    title: t('scoreDistribution'),
    desc: `${t('scoreDistribution')}, ${p.year}. ${matchCount}.`,
    caption: matchCount,
    buckets: p.score_distribution,
    series: scoreSeries(),
  });

  const margin = barChart({
    title: t('marginDistribution'),
    desc: `${t('marginDistribution')}, ${p.year}. ${matchCount}.`,
    caption: matchCount,
    buckets: p.margin_distribution,
    series: scoreSeries(),
  });

  const movement = barChart({
    title: t('rankMovement'),
    desc: `${t('rankMovement')}, ${p.year}. ${p.rank_movement.teams} ${t('teamNoun')}.`,
    caption: `${p.rank_movement.moved} ${t('of')} ${p.rank_movement.teams} ${t('teamNoun')} ${t('rankChange').toLowerCase()}`,
    buckets: p.rank_movement.buckets,
    series: [{ key: 'count', label: t('teamsIndex'), slot: 'a' }],
  });

  const awards = b.dataTable({
    head: [{ label: t('awardsLabel') }, { label: t('count'), num: true }],
    rows: p.award_distribution.map((row) => [
      esc(t(row.cls)),
      { v: num(row.count), num: true },
    ]),
  });

  const roles = b.dataTable({
    head: [{ label: t('role') }, { label: t('count'), num: true }],
    rows: p.alliance_roles.map((row) => [
      row.role === 'captain' ? esc(t('captain')) : esc(row.role),
      { v: num(row.count), num: true },
    ]),
  });

  const improved = b.dataTable({
    head: [{ label: t('teamsIndex') }, { label: t('rank'), num: true }, { label: t('rankChange'), num: true }],
    rows: p.most_improved.map((r) => [
      { v: b.teamLink(r.team_id, ctx), html: true },
      { v: num(r.rank), num: true },
      { v: num(r.change), num: true },
    ]),
  });

  const body = `<h1>${esc(p.year)}${p.name ? ` · ${esc(p.name)}` : ''}</h1>
<div class="when">${esc(String(p.counts.ranked))} ${esc(t('teamNoun'))} · ${esc(String(p.counts.awards))} ${esc(t('awardsLabel').toLowerCase())} · ${esc(String(p.counts.alliances))} ${esc(t('alliance').toLowerCase())}</div>
${score}
${margin}
<h2>${esc(t('awardDistribution'))}</h2>
${awards}
<h2>${esc(t('allianceRoles'))}</h2>
${roles}
<h2>${esc(t('mostImproved'))}</h2>
${improved}
<h2>${esc(t('rankMovement'))}</h2>
${movement}`;

  return layout({
    title: `${p.year} · ${t('insights')}`,
    description: `FIRST Global Challenge ${p.year} insights: score distribution, awards, alliance roles and rank movement.`,
    body,
    pageId: 'insights',
    assetHash: ctx.assetHash,
  });
}
