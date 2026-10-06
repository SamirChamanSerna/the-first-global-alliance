#!/usr/bin/env node
/**
 * Every internal link must resolve to a file the build actually produced.
 *
 * A site assembled from payloads that each carry their own `href` fields can
 * ship a link to a route nobody generates — the payload is valid, the route is
 * not, and nothing else notices. This walks dist/ and fails on the first class
 * of dead link: an internal URL with no file behind it.
 *
 * External URLs, `mailto:` and same-page anchors (`#…`) are not its business.
 *
 * Usage: node scripts/check-links.mjs
 */

import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const exists = (p) => access(p).then(() => true, () => false);

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

if (!(await exists(DIST))) {
  // Link checking needs the build output. On a clean tree there is nothing to
  // check, and saying so is better than a stack trace.
  console.log('skip  dist/ does not exist — run `npm run build` to check links');
  process.exit(0);
}

const files = await htmlFiles(DIST);
const broken = new Map();
const checked = new Set();

for (const file of files) {
  const html = await readFile(file, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    const url = m[1];
    if (checked.has(url)) continue;
    checked.add(url);

    const candidates = [
      path.join(DIST, url),
      path.join(DIST, url, 'index.html'),
      path.join(DIST, `${url.replace(/\/$/, '')}.html`),
    ];

    let found = false;
    for (const candidate of candidates) {
      if (await exists(candidate)) {
        found = true;
        break;
      }
    }
    if (!found) broken.set(url, path.relative(DIST, file));
  }
}

if (broken.size) {
  console.error(`${broken.size} internal link(s) point at nothing:\n`);
  for (const [url, from] of broken) console.error(`  ${url}  (first seen in ${from})`);
  process.exit(1);
}

console.log(`ok    ${checked.size} internal URL(s) across ${files.length} page(s) resolve`);
