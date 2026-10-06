#!/usr/bin/env node
/**
 * A local static server for `dist/`.
 *
 * Why this exists: the built site uses absolute paths (`/assets/app.css`,
 * `/teams/af/`), exactly as it will in production. Opening `dist/index.html`
 * from the filesystem therefore loads no CSS, no flags and no navigation — it
 * looks broken when it is not. Serving it over HTTP reproduces the real thing.
 *
 * It deliberately mirrors the hosting rules the site depends on
 * (docs/plan/01-architecture.md §5), so what you see locally is what deploys:
 *
 *   /path/          → /path/index.html
 *   /path/to/file   → the file
 *   anything else   → 404.html, with a 404 status
 *
 * No dependencies, no build step — same as everything else in this project.
 *
 * Usage: node scripts/serve.mjs [--port 8080] [--open]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const argv = process.argv.slice(2);
const port = argv.includes('--port') ? Number(argv[argv.indexOf('--port') + 1]) : 8080;
const shouldOpen = argv.includes('--open');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const exists = (p) => stat(p).then(() => true, () => false);

/** Refuse any path that escapes dist/, however it was encoded. */
function resolveSafe(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const abs = path.resolve(DIST, '.' + decoded);
  return abs.startsWith(DIST) ? abs : null;
}

async function send(res, file, status = 200) {
  const body = await readFile(file);
  res.writeHead(status, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': body.length,
    // Matches production closely enough to catch a stale-asset mistake.
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = req.url ?? '/';
  const target = resolveSafe(url);

  if (!target) {
    res.writeHead(400).end('Bad request');
    return;
  }

  try {
    // Directory → its index.html
    if (await exists(target)) {
      const info = await stat(target);
      if (info.isDirectory()) {
        const index = path.join(target, 'index.html');
        if (await exists(index)) return await send(res, index);
      } else {
        return await send(res, target);
      }
    }

    // `/teams/af` without the trailing slash → the same page
    if (!url.endsWith('/') && (await exists(`${target}.html`))) {
      return await send(res, `${target}.html`);
    }

    const fallback = path.join(DIST, '404.html');
    if (await exists(fallback)) return await send(res, fallback, 404);

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Server error: ${err.message}`);
  }
});

if (!(await exists(DIST))) {
  console.error('dist/ does not exist. Run `npm run build` first.');
  process.exit(1);
}

server.listen(port, () => {
  const url = `http://localhost:${port}/`;
  console.log(`Serving dist/ at ${url}`);
  console.log('Press Ctrl+C to stop.\n');
  if (shouldOpen) {
    const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    execFile(cmd, args, () => {});
  }
});
