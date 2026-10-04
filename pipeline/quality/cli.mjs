#!/usr/bin/env node
/**
 * The data-quality report.
 *
 * This is the thing standing between an upstream glitch and a wrong number on
 * the public site, so it is written to be *read*, not just to pass CI. Errors
 * block publishing; warnings and notes are printed for a human.
 *
 * The report is derived from the actual artifacts, not from the pipeline's
 * intentions — it re-reads what was written rather than trusting what was meant.
 *
 * Usage:
 *   node pipeline/quality/cli.mjs                    report
 *   node pipeline/quality/cli.mjs --update-baseline  accept the current counts
 *   node pipeline/quality/cli.mjs --quiet            errors and warnings only
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { runChecks, BASELINE_PATH, REGRESSION_THRESHOLD } from './checks.mjs';

const argv = process.argv.slice(2);
const UPDATE_BASELINE = argv.includes('--update-baseline');
const QUIET = argv.includes('--quiet');

const pad = (v, n) => String(v ?? '—').padEnd(n);
const num = (v, n = 6) => String(v ?? '—').padStart(n);

async function main() {
  const { findings: f, counts, identity } = await runChecks();

  // ── report ────────────────────────────────────────────────────────────────
  console.log('=== data quality ===\n');

  console.log('season  matches   played  details  standings  awards  recipients');
  console.log('-'.repeat(66));
  for (const [year, row] of Object.entries(counts.seasons).sort((a, b) => a[0] - b[0])) {
    console.log(
      pad(year, 8) + num(row.matches, 8) + num(row.played, 8) + num(row.with_details, 9) +
        num(row.standings, 11) + num(row.awards, 8) + num(row.award_recipients, 12),
    );
  }
  console.log('-'.repeat(66));
  console.log(`totals: ${counts.totals.matches} matches · ${counts.totals.teams} teams in the registry`);

  if (counts.__diff?.length) {
    console.log('\nchanges vs the recorded baseline:');
    for (const d of counts.__diff) {
      const sign = d.delta > 0 ? '+' : '';
      console.log(`  ${d.year}.${d.field}  ${d.was} → ${d.now}  (${sign}${d.delta})`);
    }
  }

  const sections = [
    ['ERRORS', f.errors, (i) => `  [${i.check}] ${i.message}`],
    ['WARNINGS', f.warnings, (i) => `  [${i.check}] ${i.message}`],
    ['NOTES', f.notes, (i) => `  [${i.check}] ${i.message}`],
  ];

  for (const [title, items, format] of sections) {
    if (QUIET && title === 'NOTES') continue;
    if (!items.length) continue;
    console.log(`\n${title} (${items.length})`);
    const limit = title === 'ERRORS' ? items.length : 25;
    for (const item of items.slice(0, limit)) console.log(format(item));
    if (items.length > limit) console.log(`  … and ${items.length - limit} more`);
  }

  // ── baseline ──────────────────────────────────────────────────────────────
  if (UPDATE_BASELINE) {
    await mkdir(path.dirname(BASELINE_PATH), { recursive: true });
    const { __diff, ...rest } = counts;
    void __diff;
    const payload = {
      note:
        'Recorded counts. A drop of more than ' +
        `${REGRESSION_THRESHOLD * 100}% in any field is treated as a truncated upstream response and blocks publishing. ` +
        'Update with `npm run quality -- --update-baseline` after verifying a change is real.',
      identity: { teams: identity.teams.length },
      totals: rest.totals,
      // Per-season, keyed by year — what checks.mjs reads as `baseline.seasons[year]`.
      seasons: rest.seasons,
    };
    await writeFile(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    console.log(`\nbaseline updated → ${path.relative(process.cwd(), BASELINE_PATH)}`);
  }

  // ── verdict ───────────────────────────────────────────────────────────────
  console.log();
  if (f.errors.length) {
    console.error(`${f.errors.length} error(s). Publishing must not proceed.`);
    process.exit(1);
  }
  console.log(
    f.warnings.length
      ? `OK — ${f.warnings.length} warning(s), no errors.`
      : 'OK — no errors, no warnings.',
  );
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
