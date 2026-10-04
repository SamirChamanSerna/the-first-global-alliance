/**
 * 2023 — Hydrogen Horizons (Singapore). 13 scoring keys.
 *
 * The first generation of the per-robot naming: `{One,Two,Three}Proficiency`.
 * Values are integers 0–2 and do NOT share a scale with any later season.
 */
export default {
  model: 'fgc2023',
  game: 'Hydrogen Horizons',
  custom_stat_key: 'oxyHydroPoints',

  positioning: {
    label: 'Proficiency',
    scale: [0, 1, 2],
    keys: {
      red: ['redOneProficiency', 'redTwoProficiency', 'redThreeProficiency'],
      blue: ['blueOneProficiency', 'blueTwoProficiency', 'blueThreeProficiency'],
    },
  },

  // Declared because the key exists upstream, but it is NULL in all 338 matches:
  // 2023 has no coopertition data at all. Kept so the absence is explicit rather
  // than looking like an oversight.
  coopertition: { keys: ['coopertitionBonus'], always_null: true },
};
