/**
 * HTTP client for api.first.global.
 *
 * The upstream is a small, volunteer-run, undocumented API. There is no ETag,
 * no Last-Modified and `Cache-Control: no-store`, so every call is a full
 * re-fetch and conditional requests are impossible. In exchange, nothing blocks
 * us — which is exactly why this client is deliberately conservative: a
 * descriptive User-Agent, a hard timeout, bounded retries with backoff, and a
 * minimum interval between requests.
 *
 * See docs/discovery/01-data-sources.md §10 for the access etiquette this
 * implements.
 */

const BASE = 'https://api.first.global';

const USER_AGENT =
  'TheFirstGlobalAlliance/0.1 (+https://github.com/SamirChamanSerna/the-first-global-alliance; data archive; contact via repository issues)';

const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const MIN_INTERVAL_MS = 200;

let lastRequestAt = 0;

export class UpstreamError extends Error {
  constructor(message, { status, url, body } = {}) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Keep a floor of MIN_INTERVAL_MS between outbound requests. */
async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

/**
 * Perform one GET and return `{ status, body, bytes, url }`.
 *
 * `body` is the raw response text — never parsed, never reformatted. Raw bytes
 * are the archive's evidence and must survive verbatim
 * (docs/discovery/06-extraction-pipeline.md §3.1).
 */
export async function get(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await throttle();

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
      });

      const body = await res.text();

      if (res.ok) {
        return { status: res.status, body, bytes: Buffer.byteLength(body), url: url.toString() };
      }

      // 4xx other than 429 is a client error: retrying will not change it.
      if (res.status < 500 && res.status !== 429) {
        throw new UpstreamError(`HTTP ${res.status} for ${url}`, {
          status: res.status,
          url: url.toString(),
          body: body.slice(0, 500),
        });
      }

      lastError = new UpstreamError(`HTTP ${res.status} for ${url}`, {
        status: res.status,
        url: url.toString(),
        body: body.slice(0, 500),
      });
    } catch (err) {
      if (err instanceof UpstreamError && err.status && err.status < 500 && err.status !== 429) {
        throw err;
      }
      lastError = err;
    }

    if (attempt < MAX_ATTEMPTS) {
      const backoff = 1_000 * 3 ** (attempt - 1); // 1s, 3s
      await sleep(backoff);
    }
  }

  throw new UpstreamError(`Gave up after ${MAX_ATTEMPTS} attempts: ${lastError?.message}`, {
    status: lastError?.status,
    url: url.toString(),
  });
}

/** GET and parse. Use only where the caller needs the object, not the bytes. */
export async function getJson(path, params) {
  const { body, status } = await get(path, params);
  try {
    return JSON.parse(body);
  } catch {
    throw new UpstreamError(`Response was not JSON: ${path}`, { status, body: body.slice(0, 200) });
  }
}

// ---------------------------------------------------------------------------
// Typed endpoint wrappers — the confirmed surface from discovery 01 §1.1.
// Note there is deliberately no `stats`, `events`, `schedule` or `seasons`
// endpoint upstream; those all 404.

/** Full season bundle. `details: false` uses excludeMatchDetails and is much lighter. */
export const season = (year, { details = false } = {}) =>
  get('/v1', { year, excludeMatchDetails: details ? undefined : true });

/** One match, richer shape than the bundle's (adds startTime, fieldNumber, result, details). */
export const match = (year, tournamentKey, id) =>
  get('/v1/matches', { year, tournamentKey, id });

/** All-time team registry. Incomplete — see discovery 02 §3.2. */
export const teams = () => get('/v1/teams');

/** One season's roster. */
export const teamsForYear = (year) => get('/v1/teams', { year });

/** Rankings across all tournament levels concatenated. */
export const rankings = (year) => get('/v1/rankings', { year });

/** Awards for a season. */
export const awards = (year) => get('/v1/awards', { year });

/** Alliances for a stage. tournamentKey is required or the API returns 400. */
export const alliances = (year, tournamentKey) =>
  get('/v1/alliances', { year, tournamentKey });

export const USER_AGENT_STRING = USER_AGENT;
