/**
 * Inline SVG charts (guide §3.14).
 *
 * No library, no client script, no animation. Every chart carries a <title> and
 * a <desc>, states its denominator in the caption, and distinguishes its two
 * series by more than colour — the marks differ in shape as well as in hue,
 * which is what keeps them apart for a colour-blind reader.
 *
 * Geometry is computed with fixed numbers so the same input always produces the
 * same bytes.
 */

import { esc } from './html.js';
import { t } from './brand.js';

const W = 640;
const H = 200;
const PAD = { l: 38, r: 8, t: 8, b: 26 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

/** Round a maximum up to a readable axis top. */
function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

/**
 * A grouped bar chart over a shared bucket axis.
 *
 * @param {{ title: string, desc: string, caption?: string,
 *           buckets: Array<Record<string, *> & { label: string }>,
 *           series: Array<{ key: string, label: string, slot: 'a'|'b' }> }} spec
 */
export function barChart({ title, desc, caption = null, buckets = [], series = [] }) {
  if (!buckets.length || !series.length) return '';

  const max = niceMax(Math.max(...buckets.flatMap((b) => series.map((s) => Number(b[s.key]) || 0))));
  const groupW = PLOT_W / buckets.length;
  const barW = Math.max(1.5, (groupW - 3) / series.length);
  const y = (v) => PAD.t + PLOT_H - (v / max) * PLOT_H;

  const grid = [0, 0.5, 1]
    .map((f) => {
      const value = max * f;
      const yy = y(value);
      return `<line class="grid" x1="${PAD.l}" y1="${yy.toFixed(1)}" x2="${W - PAD.r}" y2="${yy.toFixed(1)}"/><text class="axis" x="${PAD.l - 4}" y="${(yy + 3).toFixed(1)}" text-anchor="end">${Math.round(value)}</text>`;
    })
    .join('');

  const every = Math.ceil(buckets.length / 12);
  const bars = buckets
    .map((bucket, i) => {
      const x0 = PAD.l + i * groupW;
      const marks = series
        .map((s, j) => {
          const value = Number(bucket[s.key]) || 0;
          const yy = y(value);
          const h = PAD.t + PLOT_H - yy;
          return h <= 0
            ? ''
            : `<rect class="bar-${s.slot}" x="${(x0 + 1.5 + j * barW).toFixed(1)}" y="${yy.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}"><title>${esc(`${s.label}: ${value}`)}</title></rect>`;
        })
        .join('');
      const label =
        i % every === 0
          ? `<text class="axis" x="${(x0 + groupW / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(bucket.label)}</text>`
          : '';
      return marks + label;
    })
    .join('');

  // The square/circle difference lives in guide.css, so the two series are told
  // apart by shape and not only by hue (§3.14).
  const legend = series
    .map((s) => `<span><i class="${s.slot}"></i>${esc(s.label)}</span>`)
    .join('');

  return `<figure>
<figcaption class="lbl">${esc(title)}</figcaption>
<div class="legend">${legend}</div>
<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><desc>${esc(desc)}</desc>${grid}${bars}</svg>
${caption ? `<p class="note">${esc(caption)}</p>` : ''}
</figure>`;
}

/** The two series every score and margin chart uses (§3.14: all vs playoffs). */
export const scoreSeries = () => [
  { key: 'all', label: t('seriesAll'), slot: 'a' },
  { key: 'playoffs', label: t('seriesPlayoffs'), slot: 'b' },
];
