/**
 * 2026 — Igniting Innovation (Incheon). ~17 scoring keys.
 *
 * ⚠️ UNVERIFIED. The 2026 event had not run when this was written, so the key
 * list below comes from the official frontend's `fgc_2026` adapter rather than
 * from observed data. It must be checked against real payloads before anything
 * built on it is trusted — `verify.mjs` reports when a declared key never
 * appears, which is the signal that the vocabulary has moved.
 *
 * Fourth generation of the per-robot name: `{red,blue}Robot{One,Two,Three}BraceState`.
 */
export default {
  model: 'fgc2026',
  game: 'Igniting Innovation',
  custom_stat_key: 'climbPoints',

  positioning: {
    label: 'BraceState',
    scale: [0, 0.05, 0.1, 0.2, 0.3], // None / Contact / Zone1 / Zone2 / Zone3
    keys: {
      red: ['redRobotOneBraceState', 'redRobotTwoBraceState', 'redRobotThreeBraceState'],
      blue: ['blueRobotOneBraceState', 'blueRobotTwoBraceState', 'blueRobotThreeBraceState'],
    },
  },

  coopertition: { keys: ['coopertition'] }, // None=0, Four=10, Five=25, Six=40

  // Alliance-level: wildfireIn{Red,Blue}SuppressionUnit, wildfireInExtinguisher,
  // approximateWildfireIn*, {red,blue}ClimbMultiplier, {red,blue}PartnerClimbPoints
  season_specific_note: 'Vocabulary sourced from the official frontend, not from observed data.',
};
