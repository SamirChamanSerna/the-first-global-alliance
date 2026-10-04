/**
 * Season adapter registry.
 *
 * The scoring vocabulary is entirely different every season — 13 keys in 2023,
 * 37 in 2024, 20 in 2025 — and even the concept that survives (per-robot
 * positioning) has been renamed three times and rescaled twice. So there is one
 * adapter per season family, and no universal parser.
 *
 * What the adapters buy is narrow and deliberate: a single normalised key
 * (`positioning`) that lets the code be generic, plus an explicit declaration of
 * each season's scale so nothing is silently compared across games.
 *
 *   season  per-robot key                    scale
 *   2023    red{One,Two,Three}Proficiency    0, 1, 2
 *   2024    redRobot{One,Two,Three}Parked    0, 1, 2
 *   2025    redRobot{One,Two,Three}Parking   0, 0.125, 0.25, 0.375, 0.5
 *   2026    redRobot{One,Two,Three}BraceState 0, 0.05, 0.1, 0.2, 0.3
 *
 * Those scales are NOT comparable. `positioning` unifies the shape so templates
 * and code stay generic; it does not make the values chartable across seasons,
 * and nothing should treat them as if it did.
 */

import fgc2023 from './fgc2023.mjs';
import fgc2024 from './fgc2024.mjs';
import fgc2025 from './fgc2025.mjs';
import fgc2026 from './fgc2026.mjs';
import legacy from './legacy.mjs';

export const ADAPTERS = { fgc2023, fgc2024, fgc2025, fgc2026, legacy };

/** Which adapter applies to a season. Unknown years fall back to legacy, loudly. */
export function adapterForYear(year) {
  const adapter = ADAPTERS[`fgc${year}`];
  if (adapter) return adapter;
  if (legacy.seasons[year]) return legacy;
  return null;
}

export function adapterForModel(model) {
  return ADAPTERS[model] ?? null;
}

/**
 * Every scoring key an adapter claims. Used to detect a vocabulary that has
 * moved: a declared key that never appears in a season's data means the adapter
 * is stale and its output should not be trusted.
 */
export function declaredKeys(adapter) {
  if (!adapter?.positioning) return [];
  const keys = [];
  for (const side of ['red', 'blue']) keys.push(...adapter.positioning.keys[side]);
  keys.push(...(adapter.coopertition?.keys ?? []));
  return keys;
}

/**
 * Map a raw `details` object into the normalised component vocabulary.
 *
 * Returns `null` when there is nothing to map, so callers can distinguish
 * "no breakdown" from "a breakdown with no components".
 *
 * `season_specific` is deliberately NOT duplicated here: the raw `details` on
 * the same match already holds every key untouched, and copying the unmapped
 * ones would double the payload for no gain.
 */
export function normalizeComponents(details, adapter) {
  if (!details || !adapter?.positioning) return null;

  const perTeam = { red: [], blue: [] };
  for (const side of ['red', 'blue']) {
    perTeam[side] = adapter.positioning.keys[side].map((key) => ({
      positioning: details[key] ?? null,
    }));
  }

  let coopertition = null;
  for (const key of adapter.coopertition?.keys ?? []) {
    if (details[key] !== undefined && details[key] !== null) {
      coopertition = details[key];
      break;
    }
  }

  return {
    model: adapter.model,
    positioning_label: adapter.positioning.label,
    positioning_scale: adapter.positioning.scale,
    coopertition,
    per_team: perTeam,
  };
}

/**
 * Check an adapter against real data. Reports declared keys that never appear
 * (the adapter is stale) and keys that appear but are not declared (the
 * vocabulary grew). Neither is fatal — both are things a human should see.
 */
export function auditAdapter(adapter, detailObjects) {
  const declared = new Set(declaredKeys(adapter));
  const seen = new Set();
  for (const details of detailObjects) {
    for (const key of Object.keys(details ?? {})) seen.add(key);
  }

  return {
    missing: [...declared].filter((k) => !seen.has(k)),
    undeclared: [...seen].filter((k) => !declared.has(k)).sort(),
  };
}
