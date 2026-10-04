/**
 * Build inputs that a human maintains by hand.
 *
 * These are the two files a person edits year to year. Everything else in the
 * pipeline is regenerated from the raw archive; these are the reason the
 * pipeline can be re-run without losing work.
 */

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const exists = (p) => access(p).then(() => true, () => false);

/**
 * build.config.json — the owner's deployment switches.
 *
 * `data_version` is the write-once integer that appears in every published URL.
 * Bumping it retires the old paths, which is what makes the archive's immutable
 * caching honest (docs/plan/01-architecture.md §5).
 */
export async function ownerConfig() {
  const config = JSON.parse(await readFile(path.join(ROOT, 'build.config.json'), 'utf8'));

  if (!Number.isInteger(config.data_version) || config.data_version < 1) {
    throw new Error('build.config.json: data_version must be a positive integer');
  }
  config.origins ??= {};
  config.live_years ??= [];

  return config;
}

/**
 * pipeline/overlays/videos/<year>.json — the owner's video dataset.
 *
 * Shape: `{ "<tournamentKey>:<id>": { "day": 1, "t": 4213 } }`
 *
 * Both fields are set by hand. `day` selects the day's VOD and is NEVER inferred;
 * `t` is optional and deep-links to the second. A match absent from this file —
 * or present without a `day` — gets no video link at all.
 *
 * Absent file is normal: it means no links have been recorded for that season.
 */
export async function loadOverlay(year) {
  const p = path.join(ROOT, 'pipeline', 'overlays', 'videos', `${year}.json`);
  if (!(await exists(p))) return null;

  const data = JSON.parse(await readFile(p, 'utf8'));

  // Guard against the redundant shape where the file re-keys itself by year.
  if (data && typeof data[year] === 'object' && !data['t2:1']) {
    throw new Error(
      `pipeline/overlays/videos/${year}.json is keyed by year internally. ` +
        `The filename already carries the year — the file should map match keys directly.`,
    );
  }
  return data;
}
