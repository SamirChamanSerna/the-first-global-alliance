#!/usr/bin/env node
/**
 * What video data is still missing, and what would not resolve.
 *
 * The overlay is written by hand and grows over time, so the useful question is
 * never "is it valid" but "what is left, and did I just write something that
 * silently does nothing".
 *
 * Reports per season:
 *   · matches with a day and a timestamp        — complete
 *   · matches with a day but no timestamp       — links to the VOD, no seek
 *   · matches with no entry at all              — no link
 *   · entries that resolve to NOTHING           — the ones worth catching
 *
 * The last category is the point of this script. An entry with a `day` whose
 * stream URL is missing from `seasons.json` produces no link at all, and from
 * the overlay file alone it looks perfectly fine.
 *
 * Usage: node scripts/video-coverage.mjs
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NORM = path.join(ROOT, 'pipeline', 'normalized');
const OVERLAYS = path.join(ROOT, 'pipeline', 'overlays', 'videos');

const readJson = async (p, fallback = null) => {
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return fallback;
  }
};

async function main() {
  const seasons = (await readJson(path.join(ROOT, 'pipeline', 'lookups', 'seasons.json'))).seasons;
  const withMatches = [];

  for (const meta of seasons) {
    const file = await readJson(path.join(NORM, String(meta.year), 'matches.json'));
    if (!file?.matches?.length) continue;
    withMatches.push({ meta, matches: file.matches });
  }

  if (!withMatches.length) {
    console.error('No normalized matches found. Run `npm run normalize` first.');
    process.exit(1);
  }

  let totalMissing = 0;
  let totalBroken = 0;

  for (const { meta, matches } of withMatches) {
    const year = meta.year;
    const overlay = (await readJson(path.join(OVERLAYS, `${year}.json`), {})) ?? {};
    const days = meta.streams?.days ?? [];

    let complete = 0;
    let dayOnly = 0;
    let missing = 0;
    const broken = [];
    const fieldsWithoutStream = new Set();

    for (const match of matches) {
      const key = `${match.tournament_key}:${match.id}`;
      const entry = overlay[key];

      if (!entry || entry.day === null || entry.day === undefined) {
        missing++;
        continue;
      }

      // An entry only counts as linked if it actually resolves. Counting it
      // before checking is how a file full of dead entries reads as progress.
      const day = days.find((d) => d.day === entry.day);
      const stream = day ? (day.fields?.[String(match.field)] ?? day.fields?.main) : null;

      if (!day) {
        broken.push(`${key} — day ${entry.day} is not in seasons.json → streams.days`);
        continue;
      }
      if (!stream?.url) {
        broken.push(`${key} — day ${entry.day} field ${match.field} has no stream URL`);
        fieldsWithoutStream.add(`${match.field}`);
        continue;
      }

      if (entry.t === null || entry.t === undefined) dayOnly++;
      else complete++;
    }

    const linked = complete + dayOnly;
    const pct = ((linked / matches.length) * 100).toFixed(0);

    console.log(`\n${year}  ${linked}/${matches.length} linked (${pct}%)`);
    console.log(`   ${String(complete).padStart(4)} with exact timestamp`);
    console.log(`   ${String(dayOnly).padStart(4)} VOD only, no timestamp`);
    console.log(`   ${String(missing).padStart(4)} no entry — no link`);
    if (broken.length) console.log(`   ${String(broken.length).padStart(4)} written but resolve to nothing`);

    if (days.length === 0 && linked > 0) {
      console.log('   !! seasons.json has no streams.days for this season — every entry resolves to nothing');
    }
    if (broken.length) {
      console.log(`   !! ${broken.length} entry/entries resolve to NOTHING:`);
      for (const b of broken.slice(0, 5)) console.log(`        ${b}`);
      if (broken.length > 5) console.log(`        … and ${broken.length - 5} more`);
    }
    if (fieldsWithoutStream.size) {
      console.log(`   !! field(s) ${[...fieldsWithoutStream].join(', ')} have no stream on the days used`);
    }

    totalMissing += missing;
    totalBroken += broken.length;
  }

  console.log(`\n${totalMissing} match(es) still without a video entry.`);
  if (totalBroken) {
    console.error(`${totalBroken} entr(ies) are written but will render nothing — fix before committing.`);
    process.exit(1);
  }
  console.log('All written entries resolve to a real URL.');
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
