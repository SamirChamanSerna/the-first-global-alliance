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

## Running it locally

Requires **Node ≥ 22**. There are no dependencies to install — `npm install` is not needed.

```bash
npm run pipeline   # raw → normalized → data/v1/   (reads only what is already in pipeline/raw/)
npm run build      # data + templates → dist/
npm run serve      # serve dist/ at http://localhost:8080/
```

`npm run build` does **not** run the pipeline, so a build from a clean checkout needs both commands. `npm run pipeline && npm run build` is the full rebuild.

Options:

```bash
npm run serve -- --port 3000   # different port
npm run serve -- --open        # open the browser when it starts
npm run build -- --only teams  # rebuild one route family
npm run build -- --limit 20    # build a sample, for a quick look
```

**Do not open `dist/index.html` directly from the filesystem.** The built site uses absolute paths (`/assets/app.css`, `/teams/af/`), exactly as it does in production, so from `file://` it loads no CSS, no flags and no navigation and looks broken when it is not. Serve it over HTTP with `npm run serve`.

The networked steps — `npm run fetch` and `npm run fetch:details` — are only needed to refresh the archive from `api.first.global`. They are not part of a normal local build, and everything they download is committed under `pipeline/raw/`.

Run `npm run check` before committing: it verifies data quality, style-guide sync, byte-determinism and internal links.

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
