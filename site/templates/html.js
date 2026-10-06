/**
 * HTML helpers.
 *
 * Templates are pure functions returning STRINGS, with no DOM and no
 * dependencies. That is what lets the same module run in Node at build time and
 * in the browser during live hydration — one implementation, not two.
 *
 * There are NO interface strings in this file. Every label lives in brand.js and
 * is read through t(); a literal here would bypass the one place the UI text is
 * defined.
 */

const ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape text for an element body or a quoted attribute. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

/** Render an attribute only when it has a value, so empty ones never appear. */
export function attr(name, value) {
  if (value === null || value === undefined || value === '' || value === false) return '';
  if (value === true) return ` ${name}`;
  return ` ${name}="${esc(value)}"`;
}

/** Join class names, dropping falsy ones. */
export const cls = (...parts) => parts.filter(Boolean).join(' ');

/**
 * Serialise data for embedding in a `<script type="application/json">`.
 *
 * `</script>` inside a JSON string would close the tag early, so the sequence is
 * escaped. JSON.parse handles the resulting `<` transparently.
 */
export function jsonScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Absent data renders as an em dash, never as a zero — zero is a claim.
 * See docs/plan/02-data-contract.md §4.
 */
export const DASH = '—';

/** `5–7–0`, or an em dash when the record is unknown. */
export function wlt(record) {
  if (!record) return DASH;
  return `${record.w}–${record.l}–${record.t}`;
}

/** A percentage, or an em dash when the denominator is zero. */
export function pct(value, digits = 1) {
  if (value === null || value === undefined) return DASH;
  return `${(value * 100).toFixed(digits)}%`;
}

/** A number, or an em dash for null — never a bare 0. */
export function num(value) {
  if (value === null || value === undefined) return DASH;
  return String(value);
}

/** `17:10` from a scheduled time's venue-local timestamp. */
export function timeLocal(scheduled) {
  if (!scheduled?.local) return DASH;
  const m = scheduled.local.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? m[2] : DASH;
}

/** `2025-11-01` from a scheduled time's venue-local timestamp, or null. */
export function dateLocal(scheduled) {
  if (!scheduled?.local) return null;
  const m = scheduled.local.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** A date range, collapsing `2025-10-29`–`2025-11-01` to `Oct 29 – Nov 1, 2025`. */
export function dateRange(start, end) {
  const fmt = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { y, m, d, text: `${MONTHS[m - 1]} ${d}` };
  };
  const a = fmt(start);
  const b = fmt(end);
  if (!a && !b) return DASH;
  if (!a) return `${b.text}, ${b.y}`;
  if (!b) return `${a.text}, ${a.y}`;
  if (a.y === b.y && a.m === b.m) return `${a.text}–${b.d}, ${a.y}`;
  if (a.y === b.y) return `${a.text} – ${b.text}, ${a.y}`;
  return `${a.text}, ${a.y} – ${b.text}, ${b.y}`;
}
