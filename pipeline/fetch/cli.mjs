#!/usr/bin/env node
/**
 * Fetch stage — pulls api.first.global into pipeline/raw/, verbatim.
 *
 * Raw bytes are immutable evidence: they are never edited, never reformatted,
 * and are committed so that any later discrepancy can be audited against what
 * upstream actually returned. Everything downstream (normalized/, derived/) is
 * rebuildable from here.
 *
 * Commands:
 *   probe      Verify the API still behaves as documented. Writes nothing.
 *   backfill   Season bundles + registries, once. ~20 requests.
 *   details    Per-match scoring breakdowns, one request per played match.
 *              Resumable: files already on disk are skipped.
 *
 * Usage: node pipeline/fetch/cli.mjs <command> [--years 2023,2024]
 */

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as api from './client.mjs';
import { readMatchDetails, writeMatchDetails, matchKey, unwrapMatch } from '../raw/match-details.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = path.join(ROOT, 'pipeline', 'raw', 'api');

/** Every year the platform supports. 2016 predates it; 2020/2021 had no competition. */
const ALL_YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

/** Years the API has match data for. Everything else is rankings/awards only. */
const MATCH_YEARS = [2023, 2024, 2025, 2026];

const exists = (p) => access(p).then(() => true, () => false);

async function writeRaw(relPath, body) {
  const abs = path.join(RAW, relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, body, 'utf8');
  return Buffer.byteLength(body);
}

function parseYears(argv) {
  const i = argv.indexOf('--years');
  if (i === -1) return ALL_YEARS;
  return argv[i + 1].split(',').map(Number).filter((y) => Number.isInteger(y));
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

// ---------------------------------------------------------------------------

async function probe(argv) {
  const years = parseYears(argv);
  console.log(`Probing api.first.global — ${years.length} years\n`);

  const results = [];

  for (const year of years) {
    try {
      const { body, bytes, status } = await api.season(year, { details: true });
      const bundle = JSON.parse(body);
      results.push({
        year,
        status,
        bytes,
        matches: bundle.matches?.length ?? 0,
        rankings: bundle.rankings?.length ?? 0,
        round_robin: bundle.round_robin?.length ?? 0,
        finals: bundle.finals?.length ?? 0,
        alliances_rr: bundle.alliances_round_robin?.length ?? 0,
        alliances_finals: bundle.alliances_finals?.length ?? 0,
        awards: bundle.awards?.length ?? 0,
      });
    } catch (err) {
      results.push({ year, status: err.status ?? 'ERR', error: err.message.slice(0, 80) });
    }
  }

  const pad = (v, n) => String(v).padEnd(n);
  console.log(
    pad('year', 6) + pad('matches', 9) + pad('rank', 6) + pad('rr', 5) + pad('fin', 5) +
    pad('al_rr', 7) + pad('al_fin', 8) + pad('awards', 8) + 'payload'
  );
  console.log('-'.repeat(62));
  for (const r of results) {
    if (r.error) {
      console.log(pad(r.year, 6) + `  ERROR ${r.status}: ${r.error}`);
      continue;
    }
    console.log(
      pad(r.year, 6) + pad(r.matches, 9) + pad(r.rankings, 6) + pad(r.round_robin, 5) +
      pad(r.finals, 5) + pad(r.alliances_rr, 9) + pad(r.alliances_finals, 8) +
      pad(r.awards, 8) + kb(r.bytes)
    );
  }

  const total = results.reduce((s, r) => s + (r.bytes ?? 0), 0);
  console.log('-'.repeat(62));
  console.log(`total payload (with details): ${kb(total)}`);
  console.log('\nExpected, per docs/discovery/01-data-sources.md §2:');
  console.log('  matches appear only from 2023; 2020/2021 are empty-but-valid;');
  console.log('  2022 has round_robin/finals rankings and alliances but no matches.');
}

// ---------------------------------------------------------------------------

async function backfill(argv) {
  const years = parseYears(argv);
  let requests = 0;
  let bytes = 0;

  console.log('Fetching season bundles (without match details) and registries\n');

  for (const year of years) {
    const { body, bytes: n } = await api.season(year, { details: false });
    const { matches = [], rankings = [], awards = [] } = JSON.parse(body);
    await writeRaw(path.join(String(year), 'season.json'), body);
    requests++;
    bytes += n;
    console.log(
      `  ${year}  ${String(matches.length).padStart(4)} matches  ` +
      `${String(rankings.length).padStart(4)} rankings  ${String(awards.length).padStart(3)} awards  ${kb(n)}`
    );

    const roster = await api.teamsForYear(year);
    await writeRaw(path.join(String(year), 'teams.json'), roster.body);
    requests++;
    bytes += roster.bytes;
  }

  // The all-time registry is incomplete (discovery 02 §3.2) but still an input.
  const registry = await api.teams();
  await writeRaw('teams.json', registry.body);
  requests++;
  bytes += registry.bytes;
  console.log(`\n  all-time registry: ${JSON.parse(registry.body).length} teams`);

  await writeFetchLog('backfill', requests, bytes);
  console.log(`\n${requests} requests, ${kb(bytes)} written to pipeline/raw/api/`);
}

// ---------------------------------------------------------------------------

async function details(argv) {
  const years = parseYears(argv).filter((y) => MATCH_YEARS.includes(y));
  let requests = 0;
  let skipped = 0;
  let bytes = 0;

  for (const year of years) {
    const seasonPath = path.join(RAW, String(year), 'season.json');
    if (!(await exists(seasonPath))) {
      console.warn(`  ${year}  no season.json — run \`backfill\` first, skipping`);
      continue;
    }

    const bundle = JSON.parse(await readFile(seasonPath, 'utf8'));
    const played = (bundle.matches ?? []).filter((m) => m.played);

    const store = await readMatchDetails(year);
    const already = Object.keys(store.responses).length;
    console.log(`\n  ${year}  ${played.length} played matches  (${already} already stored)`);

    let done = 0;
    for (const m of played) {
      const key = matchKey(m.tournamentKey, m.id);
      if (store.responses[key]) {
        skipped++;
        continue;
      }
      const res = await api.match(year, m.tournamentKey, m.id);
      store.responses[key] = unwrapMatch(JSON.parse(res.body));
      requests++;
      bytes += res.bytes;
      done++;

      // Flush periodically so an interrupted run resumes instead of restarting.
      if (done % 50 === 0) {
        await writeMatchDetails(year, store.responses, { fetched_at: new Date().toISOString() });
        console.log(`    ${done}/${played.length - already}…`);
      }
    }

    await writeMatchDetails(year, store.responses, { fetched_at: new Date().toISOString() });
    console.log(`    ${done} fetched, ${played.length - done - already} already present`);
  }

  await writeFetchLog('details', requests, bytes);
  console.log(`\n${requests} requests, ${skipped} skipped, ${kb(bytes)} written`);
}

// ---------------------------------------------------------------------------

async function writeFetchLog(mode, requests, bytes) {
  const logPath = path.join(RAW, '_fetch-log.json');
  const log = (await exists(logPath)) ? JSON.parse(await readFile(logPath, 'utf8')) : [];
  log.push({ mode, requests, bytes, at: new Date().toISOString() });
  await writeFile(logPath, JSON.stringify(log, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------

const COMMANDS = { probe, backfill, details };

const [, , command, ...rest] = process.argv;

if (!COMMANDS[command]) {
  console.error(`Usage: node pipeline/fetch/cli.mjs <${Object.keys(COMMANDS).join('|')}> [--years 2023,2024]`);
  process.exit(1);
}

COMMANDS[command](rest).catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  if (err.body) console.error(err.body);
  process.exit(1);
});
