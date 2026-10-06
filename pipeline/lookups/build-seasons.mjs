#!/usr/bin/env node
/**
 * Build / refresh pipeline/lookups/seasons.json — the season metadata the API
 * does not provide.
 *
 * There is no event-metadata endpoint upstream ([discovery 01 §1.2]), so this
 * file is part hand-curated and part detected. The split matters:
 *
 *   DETECTED from raw data   ranking_stat_key, data_coverage, match_source,
 *                            counts, and the observed date range
 *   CURATED here             host, game name, theme, ranking stat NAME, prose
 *   OWNER ONLY               synopsis, score_formula, stream URLs
 *
 * The curated table marks each entry `verified` or `from-discovery`. Nothing
 * here invents a value: an unknown field stays null and is reported, because a
 * plausible-looking wrong date on a season page is worse than an empty one.
 *
 * Usage:
 *   node pipeline/lookups/build-seasons.mjs --report
 *   node pipeline/lookups/build-seasons.mjs
 */

import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = path.join(ROOT, 'pipeline', 'raw', 'api');
const OUT = path.join(ROOT, 'pipeline', 'lookups', 'seasons.json');

const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const REPORT_ONLY = process.argv.includes('--report');

const exists = (p) => access(p).then(() => true, () => false);

/**
 * Curated facts. `verified` means the value was confirmed against a live source
 * during this project; `from-discovery` means it comes from the discovery
 * documents and has not been independently re-checked. 2020/2021 had no
 * competition at all.
 */
const FACTS = {
  2017: {
    host_city: 'Washington, D.C.', host_country: 'United States',
    game_name: null, theme: null, ranking_stat_name: 'Cumulative Points',
    confidence: 'from-discovery',
  },
  2018: {
    host_city: 'Mexico City', host_country: 'Mexico',
    game_name: 'Energy Impact', theme: null, ranking_stat_name: 'Parking Points',
    confidence: 'from-discovery',
  },
  2019: {
    host_city: 'Dubai', host_country: 'United Arab Emirates',
    game_name: 'Ocean Opportunity', theme: null, ranking_stat_name: null,
    confidence: 'from-discovery',
  },
  2020: { host_city: null, host_country: null, game_name: null, theme: null, ranking_stat_name: null, confidence: 'verified', note: 'No competition held.' },
  2021: { host_city: null, host_country: null, game_name: null, theme: null, ranking_stat_name: null, confidence: 'verified', note: 'No competition held.' },
  2022: {
    host_city: 'Geneva', host_country: 'Switzerland',
    game_name: 'Carbon Capture', theme: null, ranking_stat_name: 'Carbon Points',
    confidence: 'from-discovery',
  },
  2023: {
    host_city: 'Singapore', host_country: 'Singapore',
    game_name: 'Hydrogen Horizons', theme: null, ranking_stat_name: 'OxyHydro Points',
    confidence: 'from-discovery',
  },
  2024: {
    host_city: 'Athens', host_country: 'Greece',
    game_name: 'Feeding the Future', theme: null, ranking_stat_name: 'Food Secured Points',
    confidence: 'from-discovery',
  },
  2025: {
    host_city: 'Panama City', host_country: 'Panama',
    start_date: '2025-10-29', end_date: '2025-11-01',
    game_name: 'Eco Equilibrium', theme: 'Sustainable Ecosystems',
    ranking_stat_name: 'Protection Points',
    confidence: 'verified',
  },
  2026: {
    host_city: 'Incheon', host_country: 'South Korea',
    start_date: '2026-10-07', end_date: '2026-10-10',
    game_name: 'Igniting Innovation', theme: null, ranking_stat_name: 'Climb Points',
    confidence: 'verified',
  },
};

/** Fields that live outside the API and are the owner's to write. */
const OWNER_FIELDS = ['synopsis', 'score_formula'];

/**
 * What each season PUBLISHES — a decision (plan D1), not a detection.
 *
 * Awards and season summaries are complete upstream for every year, so they are
 * published for every year. Competition data is published only where the match
 * record is trustworthy, which is 2023 onward — 2022's standings exist but have
 * no matches behind them, and 2017/2018 were zeroed.
 */
const PUBLISH_COVERAGE = {
  2017: 'awards_only', 2018: 'awards_only', 2019: 'awards_only',
  2020: 'none', 2021: 'none',
  2022: 'awards_only',
  2023: 'full', 2024: 'full', 2025: 'full',
  2026: 'upcoming',
};

/**
 * Fields that appear on some seasons' ranking rows but are structural, not
 * scoring: 2022's rows carry `tournamentLevel` and `allianceKey`, which describe
 * which stage a row belongs to rather than measuring anything.
 */
const RANKING_BASE_KEYS = new Set([
  'eventKey', 'tournamentKey', 'teamKey', 'rank', 'rankChange', 'played',
  'wins', 'losses', 'ties', 'rankingScore', 'highestScore', 'team', 'rankKey',
  'tournamentLevel', 'allianceKey',
]);

async function readJson(p, fallback = null) {
  if (!(await exists(p))) return fallback;
  return JSON.parse(await readFile(p, 'utf8'));
}

/** The season-specific stat is whatever sits beside rankingScore that is not a base key. */
function detectStatKey(bundle) {
  const found = new Map();
  const rows = [...(bundle.rankings ?? []), ...(bundle.round_robin ?? []), ...(bundle.finals ?? [])];
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (RANKING_BASE_KEYS.has(key)) continue;
      if (typeof value !== 'number') continue;
      const e = found.get(key) ?? { min: Infinity, max: -Infinity };
      e.min = Math.min(e.min, value);
      e.max = Math.max(e.max, value);
      found.set(key, e);
    }
  }
  return [...found].map(([key, range]) => ({ key, ...range }));
}

function detectCoverage(bundle) {
  const matches = (bundle.matches ?? []).length;
  const rankings = (bundle.rankings ?? []).length;
  const awards = (bundle.awards ?? []).length;
  if (matches) return 'full';
  if (rankings) return 'standings_only';
  if (awards) return 'awards_only';
  return 'none';
}

/**
 * Observed span of scheduled times — but only when the sample is representative.
 *
 * 2023 times 19 of its 338 matches, all playoff matches on one day, so the
 * "range" would read as a single date and look like fact. A span derived from a
 * minority of matches is reported as null, not presented.
 */
function detectDateRange(bundle) {
  const matches = bundle.matches ?? [];
  if (!matches.length) return { observed_from: null, observed_to: null, representative: false };

  const times = matches
    .map((m) => m.scheduledTime)
    .filter((t) => typeof t === 'string' && t.length)
    .map((t) => new Date(t))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);

  const coverage = times.length / matches.length;
  if (!times.length || coverage < 0.9) {
    return { observed_from: null, observed_to: null, representative: false, coverage };
  }
  return {
    observed_from: times[0].toISOString().slice(0, 10),
    observed_to: times[times.length - 1].toISOString().slice(0, 10),
    representative: true,
    coverage,
  };
}

async function main() {
  const previous = await readJson(OUT, null);
  const previousByYear = new Map((previous?.seasons ?? []).map((s) => [s.year, s]));

  console.log(`existing seasons.json   : ${previous ? `${previous.seasons.length} rows — will merge` : 'none — first run'}`);

  const seasons = [];
  const needsAttention = [];

  for (const year of YEARS) {
    const bundle = await readJson(path.join(RAW, String(year), 'season.json'));
    if (!bundle) {
      needsAttention.push(`${year}: no raw bundle — run \`npm run fetch\` first`);
      continue;
    }

    const facts = FACTS[year] ?? {};
    const prior = previousByYear.get(year) ?? {};
    const stats = detectStatKey(bundle);
    const upstreamCoverage = detectCoverage(bundle);
    const coverage = PUBLISH_COVERAGE[year] ?? upstreamCoverage;
    const dates = detectDateRange(bundle);

    const statKey = stats[0]?.key ?? null;
    if (stats.length > 1) {
      needsAttention.push(`${year}: more than one candidate stat key (${stats.map((s) => s.key).join(', ')})`);
    }
    if (!dates.representative && (bundle.matches ?? []).length) {
      needsAttention.push(
        `${year}: only ${Math.round((dates.coverage ?? 0) * 100)}% of matches carry a scheduledTime — ` +
          `season dates not derived`,
      );
    }

    // Owner-written fields survive a rebuild; everything else is regenerated.
    const row = {
      year,
      host_city: prior.host_city ?? facts.host_city ?? null,
      host_country: prior.host_country ?? facts.host_country ?? null,
      start_date: prior.start_date ?? facts.start_date ?? dates.observed_from,
      end_date: prior.end_date ?? facts.end_date ?? dates.observed_to,
      theme: prior.theme ?? facts.theme ?? null,
      game_name: prior.game_name ?? facts.game_name ?? null,
      ranking_stat_name: prior.ranking_stat_name ?? facts.ranking_stat_name ?? null,
      ranking_stat_key: statKey,
      data_coverage: coverage,              // what we publish — a decision
      upstream_coverage: upstreamCoverage,  // what the API actually holds
      match_source: (bundle.matches ?? []).length ? 'api' : null,
      synopsis: prior.synopsis ?? null,
      score_formula: prior.score_formula ?? null,
      streams: prior.streams ?? null,
      // Hand-written: the season's stream and/or playlist links. Preserved like
      // every other owner-written field — regenerating this file must never
      // discard one.
      videos: prior.videos ?? null,
      facts_confidence: facts.confidence ?? null,
      counts: {
        rankings: (bundle.rankings ?? []).length,
        matches: (bundle.matches ?? []).length,
        awards: (bundle.awards ?? []).length,
        round_robin: (bundle.round_robin ?? []).length,
        finals: (bundle.finals ?? []).length,
      },
    };

    if (statKey && !row.ranking_stat_name) {
      needsAttention.push(`${year}: stat key "${statKey}" detected but no human name set`);
    }
    for (const field of OWNER_FIELDS) {
      if (!row[field] && coverage !== 'none') needsAttention.push(`${year}: ${field} not written`);
    }
    if (!row.streams && coverage === 'full') needsAttention.push(`${year}: stream URLs not captured (unlisted VODs)`);
    // 2020 and 2021 had no competition, so absent dates are correct, not missing.
    if ((!row.start_date || !row.end_date) && coverage !== 'none') {
      needsAttention.push(`${year}: dates missing`);
    }
    if (facts.confidence === 'from-discovery') {
      needsAttention.push(`${year}: host/game come from the discovery docs — not independently re-verified`);
    }

    seasons.push(row);
  }

  const pad = (v, n) => String(v ?? '—').padEnd(n);
  console.log('\nyear  coverage        stat key              stat name              matches  dates');
  console.log('-'.repeat(88));
  for (const s of seasons) {
    console.log(
      pad(s.year, 6) + pad(s.data_coverage, 16) + pad(s.ranking_stat_key, 22) +
      pad(s.ranking_stat_name, 23) + pad(s.counts.matches, 9) +
      (s.start_date ? `${s.start_date} → ${s.end_date}` : '—'),
    );
  }

  console.log(`\n${needsAttention.length} item(s) needing attention:`);
  for (const item of needsAttention) console.log(`  · ${item}`);

  if (REPORT_ONLY) {
    console.log('\n--report: nothing written.');
    return;
  }

  const out = {
    schema_version: 1,
    note:
      'Hand-maintained season metadata. There is no event-metadata endpoint upstream. ' +
      'Regenerate with build-seasons.mjs — owner-written fields (synopsis, score_formula, stream URLs) survive.',
    seasons,
  };
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`\nwrote ${seasons.length} seasons to pipeline/lookups/seasons.json`);
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
