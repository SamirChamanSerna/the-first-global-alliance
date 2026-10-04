/**
 * 2024 — Feeding the Future (Athens). 37 scoring keys, the largest vocabulary.
 *
 * Second generation of the per-robot name: `redRobot{One,Two,Three}Parked`.
 * Note the upstream typo `redResevoirConserved` — preserved as-is; correcting it
 * would be inventing data.
 */
export default {
  model: 'fgc2024',
  game: 'Feeding the Future',
  custom_stat_key: 'foodSecuredPoints',

  positioning: {
    label: 'Parked',
    scale: [0, 1, 2],
    keys: {
      red: ['redRobotOneParked', 'redRobotTwoParked', 'redRobotThreeParked'],
      blue: ['blueRobotOneParked', 'blueRobotTwoParked', 'blueRobotThreeParked'],
    },
  },

  coopertition: { keys: ['coopertition'] },

  // Notable season-specific keys, declared for documentation only. They stay in
  // the raw `details` and are never charted across seasons.
  //   red/blueResevoirConserved, red/blueFoodProduced,
  //   red/blueCw1–6, red/blueEc1–6, fieldBalanced, foodSecured
  season_specific_note:
    'Cw1-6 and Ec1-6 are twelve per-side values whose meaning is specific to this game; ' +
    'they are not attributable to individual robots.',
};
