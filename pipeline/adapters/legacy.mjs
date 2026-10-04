/**
 * 2017, 2018, 2019, 2022 — the four seasons with no usable match data.
 *
 * There is no scoring vocabulary to adapt, because there are no matches. What
 * this file declares instead is what each season CAN be trusted for, which is
 * the only thing the UI needs in order to render these seasons honestly.
 *
 * Verified against the live archive — see docs/plan/02-data-contract.md §4.8b.
 */
export default {
  model: 'legacy',
  match_adapter: false,

  seasons: {
    2017: {
      coverage: 'awards_only',
      custom_stat_key: null,
      // Ranking points are cumulative ("Cumulative Points", 237–716) and
      // highestScore IS populated even though wins/losses are zeroed.
      record_usable: false,
      highest_score_usable: true,
      note: 'wins/losses/ties present but zeroed; do not present them as a 0-0 record.',
    },
    2018: {
      coverage: 'awards_only',
      custom_stat_key: 'parkingPoints',
      record_usable: false,
      highest_score_usable: false,
      note: 'wins/losses/ties zeroed AND highestScore zeroed.',
    },
    2019: {
      coverage: 'awards_only',
      custom_stat_key: null,
      // The one pre-2023 season whose record is sound: w+l+t == played in 186 of
      // 189 rows, remaining 3 off by one. It is the reason a career record can
      // reach back past 2023 at all.
      record_usable: true,
      highest_score_usable: false,
      note: 'Record complete and internally consistent, from rankings. highestScore is zeroed.',
    },
    2022: {
      coverage: 'standings_only',
      custom_stat_key: 'carbonPoints',
      record_usable: false,
      highest_score_usable: true,
      note: 'Rankings and alliances exist; the matches array does not. w+l+t != played in 135 of 162 rows.',
    },
  },
};
