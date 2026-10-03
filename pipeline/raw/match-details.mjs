/**
 * Storage for per-match scoring breakdowns.
 *
 * One file per season, not one file per match.
 *
 * The API returns details one match at a time, so the naive store is ~380 tiny
 * files per season — 1,098 across 2023–2025. That is unusable in git: every
 * `git status` lists them all, and a season's diff is unreadable. Consolidating
 * to one file per season keeps the data identical and makes the diff a diff.
 *
 * Keys are `<tournamentKey>:<id>` — the match_id from
 * docs/plan/02-data-contract.md §4, minus the year, which the parent file names.
 *
 * Each value is the MATCH OBJECT. `GET /v1/matches?…&id=N` wraps its single
 * result in a one-element array; that wrapper carries no information and is
 * dropped here, so a reader gets the match directly. Use `unwrapMatch()`.
 *
 * NOTE ON FIDELITY: consolidated entries are PARSED objects, not the raw response
 * text. Content is preserved exactly; upstream key order and whitespace are not.
 * That is a deliberate trade for a file a human can read and diff. The season
 * bundles under `raw/api/<year>/season.json` remain verbatim, because there is
 * only one of each and no readability problem to solve.
 */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = path.join(ROOT, 'pipeline', 'raw', 'api');

export const detailsPath = (year) => path.join(RAW, String(year), 'match-details.json');

export const matchKey = (tournamentKey, id) => `${tournamentKey}:${id}`;

/**
 * The `/v1/matches` endpoint answers with `[{…}]` for a single id. Unwrap it.
 * Throws on an unexpected shape rather than returning something half-right.
 */
export function unwrapMatch(payload) {
  if (Array.isArray(payload)) {
    if (payload.length !== 1) {
      throw new Error(`Expected exactly one match in the response, got ${payload.length}`);
    }
    return payload[0];
  }
  if (payload && typeof payload === 'object') return payload;
  throw new Error(`Unrecognised match payload: ${JSON.stringify(payload)?.slice(0, 80)}`);
}

/**
 * Read a season's consolidated details.
 * Returns `{ year, meta, responses: {} }` — an empty store when the file is absent.
 */
export async function readMatchDetails(year) {
  try {
    const parsed = JSON.parse(await readFile(detailsPath(year), 'utf8'));
    return { year, meta: parsed.meta ?? {}, responses: parsed.responses ?? {} };
  } catch {
    return { year, meta: {}, responses: {} };
  }
}

/**
 * Write a season's consolidated details, deterministically:
 * keys are sorted, so the same input always produces the same bytes and an
 * unchanged response never shows up as a diff.
 *
 * Written via a temporary file and renamed, so an interrupted run cannot leave a
 * truncated JSON file where the archive used to be.
 */
export async function writeMatchDetails(year, responses, meta = {}) {
  const sorted = {};
  for (const key of Object.keys(responses).sort(compareMatchKeys)) {
    sorted[key] = responses[key];
  }

  const payload = {
    meta: {
      year,
      source: `GET /v1/matches?year=${year}&tournamentKey=<tN>&id=<N>`,
      count: Object.keys(sorted).length,
      ...meta,
    },
    responses: sorted,
  };

  await mkdir(path.dirname(detailsPath(year)), { recursive: true });
  const tmp = detailsPath(year) + '.tmp';
  await writeFile(tmp, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  await rename(tmp, detailsPath(year));
  return Object.keys(sorted).length;
}

/** Sort by stage then numeric id, so t2:9 precedes t2:10 (a plain string sort would not). */
export function compareMatchKeys(a, b) {
  const [stageA, idA] = a.split(':');
  const [stageB, idB] = b.split(':');
  if (stageA !== stageB) return stageA.localeCompare(stageB);
  return Number(idA) - Number(idB);
}
