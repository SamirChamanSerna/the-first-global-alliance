#!/usr/bin/env node
/**
 * Prove the emit is deterministic — byte-identical output for identical input.
 *
 * WHY THIS IS A TEST AND NOT A HABIT
 *
 * The derived trees (`data/`, `pipeline/normalized/`) are NOT committed to git.
 * That is only safe because they can be reconstructed exactly: `npm run
 * pipeline` in CI reproduces what a developer would have rebuilt locally. If
 * determinism ever breaks, the rebuild silently diverges from every previous
 * build, and because nothing was committed there is no diff to notice it with.
 *
 * That failure mode is invisible. So it gets a test.
 *
 * It checks three things:
 *   1. Two consecutive pipeline runs produce identical bytes.
 *   2. No output file contains a timestamp. A build clock baked into an artifact
 *      makes every run differ; the output must describe the data, not the run.
 *   3. Key ordering inside a file is stable, which is what makes a real change
 *      show up as a small diff instead of a whole-file rewrite.
 *
 * Usage: node scripts/test-determinism.mjs
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TREES = ['data', 'pipeline/normalized'];

/** Walk a tree, returning sorted repo-relative file paths. */
async function walk(rel) {
  const abs = path.join(ROOT, rel);
  const out = [];

  async function visit(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // tree absent — reported separately
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else out.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  }

  await visit(abs);
  return out.sort();
}

async function hashAll(files) {
  const hashes = new Map();
  for (const rel of files) {
    const buf = await readFile(path.join(ROOT, rel));
    hashes.set(rel, createHash('sha256').update(buf).digest('hex'));
  }
  return hashes;
}

/** ISO-ish timestamps and epoch values that must not appear in output. */
const TIMESTAMP_PATTERNS = [
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
  /\b\d{10,13}\b/,
];

/** Field names that would indicate a build clock leaked into an artifact. */
const TIMESTAMP_KEYS = /"(generated_at|built_at|emitted_at|builtAt|generatedAt|timestamp)"\s*:/;

async function main() {
  console.log('determinism test\n');

  // ── 1. snapshot, rebuild, compare ─────────────────────────────────────────
  const before = new Map();
  for (const tree of TREES) {
    const files = await walk(tree);
    if (!files.length) {
      console.error(`FAIL: ${tree}/ is empty. Run \`npm run pipeline\` first.`);
      process.exit(1);
    }
    before.set(tree, await hashAll(files));
    console.log(`  ${tree.padEnd(22)} ${String(files.length).padStart(5)} files snapshotted`);
  }

  console.log('\n  rebuilding…');
  await run('node', ['pipeline/normalize/cli.mjs'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  await run('node', ['pipeline/emit/cli.mjs'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });

  let failures = 0;
  const report = (msg) => {
    console.log(`  FAIL  ${msg}`);
    failures++;
  };

  for (const tree of TREES) {
    const after = await hashAll(await walk(tree));
    const expected = before.get(tree);

    const missing = [...expected.keys()].filter((f) => !after.has(f));
    const added = [...after.keys()].filter((f) => !expected.has(f));
    const changed = [...expected.keys()].filter((f) => after.has(f) && after.get(f) !== expected.get(f));

    if (missing.length) report(`${tree}: ${missing.length} file(s) disappeared on rebuild — e.g. ${missing.slice(0, 3).join(', ')}`);
    if (added.length) report(`${tree}: ${added.length} unexpected new file(s) — e.g. ${added.slice(0, 3).join(', ')}`);
    if (changed.length) report(`${tree}: ${changed.length} file(s) differ between two identical runs — e.g. ${changed.slice(0, 3).join(', ')}`);

    if (!missing.length && !added.length && !changed.length) {
      const total = [...after.values()].reduce((n) => n + 1, 0);
      console.log(`  ok    ${tree.padEnd(22)} ${total} files byte-identical after rebuild`);
    }
  }

  // ── 2. no timestamp may be baked into an artifact ─────────────────────────
  const dataFiles = await walk('data');
  const offenders = [];

  for (const rel of dataFiles) {
    const text = await readFile(path.join(ROOT, rel), 'utf8');

    if (TIMESTAMP_KEYS.test(text)) {
      offenders.push(`${rel} — contains a build-clock field`);
      continue;
    }
    // `scheduled_time` and `start_time` legitimately contain match dates, so
    // only keys that are not match data are inspected.
    if (/"(created|updated|modified|published)_?at"\s*:/.test(text)) {
      offenders.push(`${rel} — contains a run timestamp field`);
    }
  }

  if (offenders.length) {
    for (const o of offenders.slice(0, 5)) report(`timestamp: ${o}`);
    if (offenders.length > 5) report(`timestamp: ${offenders.length - 5} more`);
  } else {
    console.log(`  ok    no build clock in ${dataFiles.length} published files`);
  }

  // ── 3. line endings and encoding ──────────────────────────────────────────
  let crlf = 0;
  let noTrailingNewline = 0;

  for (const rel of dataFiles) {
    const buf = await readFile(path.join(ROOT, rel));
    const text = buf.toString('utf8');
    if (text.includes('\r\n')) crlf++;
    if (!text.endsWith('\n')) noTrailingNewline++;
    if (buf.includes(0xef) && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      report(`${rel} — has a UTF-8 BOM`);
    }
  }

  if (crlf) report(`${crlf} file(s) use CRLF; the pipeline pins LF`);
  else console.log('  ok    all files are LF');
  if (noTrailingNewline) report(`${noTrailingNewline} file(s) lack a trailing newline`);
  else console.log('  ok    all files end with a newline');

  // ── result ────────────────────────────────────────────────────────────────
  console.log();
  if (failures) {
    console.error(`${failures} determinism failure(s).`);
    console.error('The derived trees are not committed — until this passes, a rebuild cannot be trusted to match.');
    process.exit(1);
  }
  console.log('PASS — the pipeline is deterministic.');
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
