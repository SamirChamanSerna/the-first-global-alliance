/**
 * 2025 — Eco Equilibrium (Panama City). 20 scoring keys.
 *
 * Third generation of the per-robot name: `redRobot{One,Two,Three}Parking`.
 * Unlike 2023/2024's integer levels, this is a fractional multiplier.
 *
 * This is the season whose scoring formula the points calculator reproduces:
 *   final = ((WaterConserved + EnergyConserved + FoodProduced) * BalanceMultiplier)
 *         + FoodSecured + Coopertition
 */
export default {
  model: 'fgc2025',
  game: 'Eco Equilibrium',
  custom_stat_key: 'protectionPoints',

  positioning: {
    label: 'Parking',
    scale: [0, 0.125, 0.25, 0.375, 0.5],
    keys: {
      red: ['redRobotOneParking', 'redRobotTwoParking', 'redRobotThreeParking'],
      blue: ['blueRobotOneParking', 'blueRobotTwoParking', 'blueRobotThreeParking'],
    },
  },

  coopertition: { keys: ['coopertition'] },

  // Alliance-level, deliberately NOT attributed to robots:
  //   barriersIn{Red,Blue}Mitigator, biodiversityUnits*Ecosystem,
  //   approximateBiodiversity*, biodiversityDistributionFactor,
  //   biodiversityDistributed, {red,blue}ProtectionMultiplier, allBarriersCleared
  season_specific_note:
    'The ProtectionMultiplier is applied per alliance, so identical cooperative play yields ' +
    'different points on each side — the reason raw-score OPR is contaminated for this game.',
};
