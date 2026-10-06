#!/usr/bin/env node
/**
 * Vendor the visual contract.
 *
 * docs/web-style-guide/Demo-team-match/ is the single source of truth for
 * colour, type, shape and component CSS. Its files are copied into site/ so the
 * build can serve them and the templates can import them.
 *
 * tokens.css and components.css are copied VERBATIM and must never be edited in
 * place — `--check` fails when a copy drifts from the guide. Everything the
 * guide defines but the demo does not implement lives in site/css/guide.css,
 * which is ours and is not touched here.
 *
 * brand.js is seeded once and then owned by the repo: it is the identity file
 * (name, nav, medals, every fixed UI string), meant to be edited per project.
 *
 * Usage: node scripts/sync-style-guide.mjs [--check]
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUIDE = path.join(ROOT, 'docs', 'web-style-guide', 'Demo-team-match');

/** Copied verbatim, drift-checked against the guide. */
const VERBATIM = [
  ['tokens.css', 'site/brand/tokens.css'],
  ['components.css', 'site/css/components.css'],
];

/** Seeded on first run, then owned by the repo (holds the brand's own strings). */
const SEEDED = [['brand.js', 'site/templates/brand.js']];

/**
 * Derived from the guide's icon. The guide's `brand.js` states the rule for a
 * navbar mark — square viewBox, `currentColor`, no colours of its own — and
 * `tfga-icon.svg` meets none of them: it is 600×523 (and clips the artwork by
 * ~11 units a side), it is solid fill rather than stroke, and it hardcodes
 * black. So the mark is re-framed and recoloured here, mechanically, and the
 * path data is left exactly as drawn.
 */
const ICON = 'tfga-icon.svg';
const LOGO_OUT = 'site/templates/logo.js';

const check = process.argv.includes('--check');

const readIf = (p) => readFile(p, 'utf8').then((s) => s, () => null);

/**
 * Bounding box of a path's coordinates, in path space.
 *
 * Control points are included, so the result is a conservative superset of the
 * ink — which is what a frame wants: it can be a hair too generous, never too
 * tight. Handles the commands this artwork uses (M m L l H h V v C c Z z).
 */
function pathBounds(d) {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const points = [];
  let i = 0;
  let cx = 0, cy = 0, startX = 0, startY = 0, cmd = null;
  const num = () => parseFloat(tokens[i++]);
  const mark = (x, y) => points.push([x, y]);

  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    if (!cmd) break;
    const rel = cmd === cmd.toLowerCase();

    switch (cmd.toUpperCase()) {
      case 'M': {
        const x = num(), y = num();
        cx = rel ? cx + x : x; cy = rel ? cy + y : y;
        startX = cx; startY = cy;
        mark(cx, cy);
        cmd = rel ? 'l' : 'L'; // further pairs are linetos
        break;
      }
      case 'L': { const x = num(), y = num(); cx = rel ? cx + x : x; cy = rel ? cy + y : y; mark(cx, cy); break; }
      case 'H': { const x = num(); cx = rel ? cx + x : x; mark(cx, cy); break; }
      case 'V': { const y = num(); cy = rel ? cy + y : y; mark(cx, cy); break; }
      case 'C': {
        const a = num(), b = num(), c = num(), e = num(), f = num(), g = num();
        mark(rel ? cx + a : a, rel ? cy + b : b);
        mark(rel ? cx + c : c, rel ? cy + e : e);
        const x = rel ? cx + f : f, y = rel ? cy + g : g;
        mark(x, y);
        cx = x; cy = y;
        break;
      }
      case 'Z': { cx = startX; cy = startY; break; }
      default: throw new Error(`${ICON}: unsupported path command "${cmd}"`);
    }
  }

  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** The guide's icon, re-framed square and set in currentColor. */
async function renderLogo() {
  const raw = await readFile(path.join(GUIDE, ICON), 'utf8');

  const transform = raw.match(/\stransform="([^"]+)"/)?.[1];
  const scale = Number(transform?.match(/scale\(([\d.]+)/)?.[1]);
  const ty = Number(transform?.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/)?.[2]);
  if (!transform || !scale || Number.isNaN(ty)) {
    throw new Error(`${ICON}: expected a translate+scale group, found none`);
  }

  const paths = [...raw.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
  if (!paths.length) throw new Error(`${ICON}: no paths found`);

  const bounds = paths.map(pathBounds).reduce((a, b) => [
    Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3]),
  ]);

  // The artwork's own box, in the coordinates the viewBox will use.
  const x0 = bounds[0] * scale;
  const x1 = bounds[2] * scale;
  const y0 = ty - bounds[3] * scale;
  const y1 = ty - bounds[1] * scale;

  const side = Math.max(x1 - x0, y1 - y0) * 1.02; // 1% breathing room
  const minX = (x0 + x1) / 2 - side / 2;
  const minY = (y0 + y1) / 2 - side / 2;
  const round = (n) => Math.round(n * 10) / 10;

  const viewBox = [round(minX), round(minY), round(side), round(side)].join(' ');
  const body = paths.map((d) => `<path d="${d}"/>`).join('');

  return `/**
 * GENERATED by scripts/sync-style-guide.mjs from the guide's ${ICON}. Do not edit.
 *
 * Change the mark by changing the guide's asset and re-running \`npm run style\`.
 * Two mechanical changes only, so the mark can live in a bar that changes colour:
 *
 *   - the viewBox is squared around the artwork's own bounds. The source is
 *     600x523 and its viewBox clips the mark by about 11 units on each side.
 *   - it is filled with currentColor instead of black, so it takes the colour of
 *     the bar it sits in (--brand-on against --brand) and survives dark mode.
 *
 * The path data is untouched.
 */
export const LOGO_SVG =
  '<svg class="logo" viewBox="${viewBox}" aria-hidden="true"><g transform="${transform}" fill="currentColor" stroke="none">${body}</g></svg>';
`;
}

let problems = 0;

for (const [from, to] of VERBATIM) {
  const src = await readFile(path.join(GUIDE, from), 'utf8');
  const dest = path.join(ROOT, to);
  const current = await readIf(dest);

  if (current === src) {
    console.log(`ok      ${to}`);
    continue;
  }
  if (check) {
    problems++;
    console.error(`DRIFT   ${to} does not match the guide (${from})`);
    continue;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, src, 'utf8');
  console.log(`${current === null ? 'new    ' : 'sync   '} ${to}`);
}

for (const [from, to] of SEEDED) {
  const dest = path.join(ROOT, to);
  if ((await readIf(dest)) !== null) {
    console.log(`owned   ${to} (seeded; no longer synced)`);
    continue;
  }
  if (check) {
    problems++;
    console.error(`MISSING ${to} — run the script without --check`);
    continue;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, await readFile(path.join(GUIDE, from), 'utf8'), 'utf8');
  console.log(`seed    ${to}`);
}

// The navbar mark, derived from the guide's icon rather than copied.
{
  const generated = await renderLogo();
  const dest = path.join(ROOT, LOGO_OUT);
  if ((await readIf(dest)) === generated) {
    console.log(`ok      ${LOGO_OUT}`);
  } else if (check) {
    problems++;
    console.error(`DRIFT   ${LOGO_OUT} — regenerate from ${ICON} with the script`);
  } else {
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, generated, 'utf8');
    console.log(`derive  ${LOGO_OUT}`);
  }
}

if (problems) {
  console.error(`\n${problems} file(s) out of sync with the style guide`);
  process.exit(1);
}
