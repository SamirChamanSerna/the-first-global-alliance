# The First Global Alliance

An independent, open archive and live-coverage platform for the **FIRST Global Challenge** — the annual international robotics olympiad, one national team per country.

Built as a static site at ~$0 operating cost: no framework, no database for the archive, no server between the reader and the data.

---

## Status

| | |
|---|---|
| Phase | **Planning complete, implementation not started** |
| Scope | Defined in [`docs/plan/`](docs/plan/README.md) |
| Research | Complete in [`docs/discovery/`](docs/discovery/README.md) |

---

## What it will do

- **Archive every season** — summary and awards for 2017→present; full standings, matches and per-team records for 2023→present.
- **A page per team, per season, per match** — generated from generic templates, one data file per page.
- **A team history timeline** — every season, newest first, with rank, record, awards and coverage labels.
- **An all-time medal table** — complete since 2017, because awards are the only uninterrupted series.
- **Insights** — participation, awards and score distributions, modelled on The Blue Alliance Insights.
- **A points calculator** per season, reproducing the official scoring formula.
- **Match videos** — each match links to the correct field stream, and to the exact minute when a timestamp is known.

## What it deliberately does not do (yet)

User submissions and moderation. Computed ratings like OPR/EPA. Robot photo galleries. Video timestamp extraction. Historical reconstruction of the four seasons with no match data. All are designed for and deferred — see [`docs/plan/README.md §5`](docs/plan/README.md).

---

## Documentation

```
docs/
├─ discovery/   Research. What data exists, what is computable, what is not.
└─ plan/        The build. Scope, architecture, data contract, pages, roadmap, backlog.
```

**Start here:** [`docs/plan/README.md`](docs/plan/README.md) — scope decisions and an index of everything else.

---

## Credits and data sources

- **Data** — [`api.first.global`](https://results.first.global/), the public API behind the official FIRST Global results site. All competition data is theirs.
- **Flags** — [`lipis/flag-icons`](https://github.com/lipis/flag-icons) (MIT).
- **Design lineage** — [The Blue Alliance](https://www.thebluealliance.com/) (MIT) for information architecture, and [Statbotics](https://www.statbotics.io/) for analytics presentation.

This project is independent and is not affiliated with or endorsed by FIRST Global.

## Licence

See [LICENSE](LICENSE).
