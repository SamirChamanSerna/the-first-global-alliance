#!/usr/bin/env node
/**
 * Vendor the flag SVG set from lipis/flag-icons (MIT).
 *
 * Flags are static assets served from our own origin — no third-party request
 * at page load, no CDN to be unavailable, no upstream to change a URL under us.
 *
 * Only the 4:3 set is taken, and only for entities the identity registry can
 * actually name. Entities with no country flag render a code chip instead
 * (`blocks.js`), which is why a missing file here is not an error.
 *
 * Resumable: files already present are skipped, so re-running after a partial
 * download picks up where it left off.
 *
 * Usage: node scripts/vendor-flags.mjs [--force]
 */

import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site', 'assets', 'flags');
const IDENTITY = path.join(ROOT, 'pipeline', 'lookups', 'team-identity.json');

const BASE = 'https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3';
const FORCE = process.argv.includes('--force');
const CONCURRENCY = 8;

const USER_AGENT = 'TheFirstGlobalAlliance/0.1 (+https://github.com/SamirChamanSerna/the-first-global-alliance)';

const exists = (p) => access(p).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchFlag(code) {
  const res = await fetch(`${BASE}/${code}.svg`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const svg = await res.text();
  if (!svg.includes('<svg')) throw new Error('response is not an SVG');
  return svg;
}

async function main() {
  const identity = JSON.parse(await readFile(IDENTITY, 'utf8'));

  // iso2 is the only field that maps onto this set; entities without one
  // (continental teams, the refugee team) have no flag and are expected to.
  const codes = [...new Set(
    identity.teams.map((t) => t.iso2).filter((c) => typeof c === 'string' && /^[a-z]{2}$/.test(c)),
  )].sort();

  const withoutFlag = identity.teams.filter((t) => !t.iso2).map((t) => t.team_id);

  console.log(`${identity.teams.length} teams · ${codes.length} with an ISO code · ${withoutFlag.length} without`);
  console.log(`entities with no country flag (code chip fallback): ${withoutFlag.join(', ')}\n`);

  await mkdir(OUT, { recursive: true });

  let fetched = 0;
  let skipped = 0;
  const failed = [];

  const queue = [...codes];
  async function worker() {
    while (queue.length) {
      const code = queue.shift();
      const dest = path.join(OUT, `${code}.svg`);
      if (!FORCE && (await exists(dest))) {
        skipped++;
        continue;
      }
      try {
        const svg = await fetchFlag(code);
        await writeFile(dest, svg, 'utf8');
        fetched++;
        if (fetched % 40 === 0) console.log(`  ${fetched} fetched…`);
      } catch (err) {
        failed.push(`${code}: ${err.message}`);
      }
      await sleep(20);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\n${fetched} fetched, ${skipped} already present, ${failed.length} failed`);
  if (failed.length) {
    console.log('failures (these render as a code chip):');
    for (const f of failed.slice(0, 20)) console.log(`  ${f}`);
    if (failed.length > 20) console.log(`  … and ${failed.length - 20} more`);
  }
  console.log(`\nwrote to site/assets/flags/`);
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
