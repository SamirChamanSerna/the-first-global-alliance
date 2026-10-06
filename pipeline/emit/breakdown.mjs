/**
 * The scoring breakdown, as rows a table can render.
 *
 * `match.details` is a flat object of raw, season-specific upstream keys
 * (`barriersInRedMitigator`, `redRobotOneParking`, `coopertition`, …). The shape
 * of that object changes every season, so nothing here knows any season's
 * vocabulary: keys that name a side are paired with their opposite number and
 * become a red | label | blue row, and everything else becomes a key/value row.
 * One implementation, any season, no per-year code.
 *
 * The label is derived from the key with the side word removed, so the two
 * halves of a pair share a name ("barriersInRedMitigator" and
 * "barriersInBlueMitigator" both become "Barriers in mitigator"). The label is a
 * description of the DATA, not interface copy, which is why it is built here
 * rather than read from brand.js.
 */

/** A side token anywhere in a camelCase key: `…InRedMitigator`, `redRobotOne…`. */
const SIDE_TOKEN = /(^|[a-z0-9])(Red|Blue|red|blue)(?=[A-Z]|$)/;

const MINOR_WORDS = new Set(['in', 'of', 'the', 'and', 'per', 'to', 'on', 'at', 'side']);

/** `barriersInRedMitigator` → `{ side: 'red', core: 'barriersInMitigator' }`. */
export function splitSide(key) {
  const m = key.match(SIDE_TOKEN);
  if (!m) return { side: null, core: key };
  const at = m.index + m[1].length;
  return {
    side: m[2].toLowerCase() === 'red' ? 'red' : 'blue',
    core: key.slice(0, at) + key.slice(at + m[2].length),
  };
}

/** Split camelCase and snake_case into a sentence: `RobotOneParking` → `Robot one parking`. */
export function humanise(key) {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_]+/)
    .filter(Boolean);

  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && MINOR_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/** The side with the larger value, or null on a tie or a non-numeric pair. */
function leadOf(red, blue) {
  if (typeof red !== 'number' || typeof blue !== 'number') return null;
  if (red > blue) return 'red';
  if (blue > red) return 'blue';
  return null;
}

/**
 * Pair up the sided keys, keeping the source order of first appearance.
 *
 * @returns {{ rows: Array, singles: Array }} `rows` are red|label|blue, `singles`
 * are the keys that name no side and get a plain key/value row.
 */
export function breakdownRows(details, consumed = new Set()) {
  if (!details) return { rows: [], singles: [] };

  const pairs = new Map();
  const singles = [];

  for (const [key, value] of Object.entries(details)) {
    // Keys the component model already presents are skipped. The adapter
    // declares them (`declaredKeys`), so this needs no per-season knowledge —
    // and without it the same three parking values would appear twice, once as
    // a per-robot row and once as three generic ones.
    if (consumed.has(key)) continue;

    const { side, core } = splitSide(key);
    if (!side) {
      singles.push({ label: humanise(key), value });
      continue;
    }
    if (!pairs.has(core)) pairs.set(core, { red: null, blue: null, label: humanise(core) });
    pairs.get(core)[side] = value;
  }

  const rows = [];
  for (const [, pair] of pairs) {
    // A key with a side but no counterpart is still a row; the missing half
    // renders as an em dash rather than a zero.
    rows.push({ kind: 'detail', label: pair.label, red: pair.red, blue: pair.blue, lead: leadOf(pair.red, pair.blue) });
  }

  return { rows, singles };
}

/**
 * The normalised component subset (per-robot positioning), only where the season
 * model supports it. This is the one part of the breakdown that generalises
 * across seasons — but the SCALE does not, which is why `positioning_scale`
 * travels with the match and nothing compares these values across years.
 */
export function componentRows(match) {
  const components = match.components;
  if (!components?.per_team) return [];

  const side = (name) =>
    components.per_team[name].map((entry, i) => ({
      team_id: match.alliances[name][i]?.team_id ?? null,
      value: entry.positioning ?? null,
    }));

  return [{
    kind: 'robots',
    label: components.positioning_label ?? 'Positioning',
    red: side('red'),
    blue: side('blue'),
    lead: null,
  }];
}

/**
 * The component model's single-value figures (coopertition and anything like
 * it), which name no side and so become key/value rows next to the table.
 */
export function componentSingles(match, adapter) {
  const value = match.components?.coopertition;
  if (value === null || value === undefined) return [];
  const key = adapter?.coopertition?.keys?.[0];
  return [{ label: humanise(key ?? 'coopertition'), value }];
}
