#!/usr/bin/env node
/**
 * One-off: consolidate `raw/api/<year>/matches/*.json` into
 * `raw/api/<year>/match-details.json`.
 *
 * Run once, after the per-match layout has been replaced. It does not re-download
 * anything — it reads the 1,098 files already on disk, writes the consolidated
 * store, and only deletes the old directory after verifying the entry count
 * matches exactly.
 *
 * Usage:
 *   node pipeline/raw/migrate-match-details.mjs --dry-run
 *   node pipeline/raw/migrate-match-details.mjs
 */

import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMatchDetails, writeMatchDetails, matchKey, detailsPath, unwrapMatch } from './match-details.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = path.join(ROOT, 'pipeline', 'raw', 'api');

const DRY_RUN = process.argv.includes('--dry-run');
const YEARS = [2023, 2024, 2025, 2026];

const exists = (p) => readdir(p).then(() => true, () => false);

/**
 * Repair pass for stores written before `unwrapMatch` existed: the first
 * migration kept the endpoint's one-element array wrapper. Data is identical,
 * only the wrapper is removed.
 */
async function fixShape() {
  for (const year of YEARS) {
    const store = await readMatchDetails(year);
    const keys = Object.keys(store.responses);
    if (!keys.length) continue;

    let fixed = 0;
    for (const key of keys) {
      if (Array.isArray(store.responses[key])) {
        store.responses[key] = unwrapMatch(store.responses[key]);
        fixed++;
      }
    }
    if (!fixed) {
      console.log(`${year}  ${keys.length} entries already correct`);
      continue;
    }
    await writeMatchDetails(year, store.responses, { ...store.meta, shape_fixed_at: new Date().toISOString() });
    console.log(`${year}  unwrapped ${fixed}/${keys.length} entries`);
  }
}

async function main() {
  if (process.argv.includes('--fix-shape')) return fixShape();

  let grandTotal = 0;
  let grandRemoved = 0;

  for (const year of YEARS) {
    const dir = path.join(RAW, String(year), 'matches');
    if (!(await exists(dir))) {
      console.log(`${year}  no per-match directory — nothing to migrate`);
      continue;
    }

    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
    const store = await readMatchDetails(year);

    let added = 0;
    for (const file of files) {
      // "<tournamentKey>-<id>.json", e.g. "t2-214.json"
      const stem = file.replace(/\.json$/, '');
      const dash = stem.indexOf('-');
      if (dash === -1) throw new Error(`Unparseable match filename: ${file}`);
      const key = matchKey(stem.slice(0, dash), stem.slice(dash + 1));

      if (store.responses[key]) continue; // already consolidated by a previous run
      store.responses[key] = unwrapMatch(JSON.parse(await readFile(path.join(dir, file), 'utf8')));
      added++;
    }

    const expected = Object.keys(store.responses).length;

    if (DRY_RUN) {
      console.log(`${year}  ${files.length} files -> ${expected} entries  (dry run, nothing written)`);
      grandTotal += expected;
      continue;
    }

    const written = await writeMatchDetails(year, store.responses, {
      migrated_at: new Date().toISOString(),
    });

    if (written !== expected) {
      throw new Error(`${year}: wrote ${written} entries but expected ${expected} — refusing to delete anything`);
    }

    console.log(`${year}  ${files.length} files -> ${written} entries  (${added} added)  ${detailsPath(year)}`);

    // Only now is it safe to remove the old layout.
    await rm(dir, { recursive: true, force: true });
    grandRemoved += files.length;
    grandTotal += written;
  }

  if (DRY_RUN) {
    console.log(`\ndry run: would consolidate to ${grandTotal} entries. Nothing written, nothing deleted.`);
    return;
  }
  console.log(`\nconsolidated ${grandTotal} entries into ${YEARS.length} files; removed ${grandRemoved} per-match files.`);
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
