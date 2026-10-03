#!/usr/bin/env node
/**
 * Create the GitHub backlog from docs/plan/05-backlog.md.
 *
 * The backlog document is the single source of truth — this script never
 * duplicates its content, it parses it. Edit the markdown, re-run, and the
 * new issues appear. Idempotent: an issue whose title already exists is skipped,
 * so re-running after an edit only creates what is missing.
 *
 * Usage:
 *   node scripts/create-issues.mjs --dry-run        # print, touch nothing
 *   GH_TOKEN=ghp_... node scripts/create-issues.mjs # create
 *
 * The token needs `repo` scope (classic) or Issues:write + Contents:read
 * (fine-grained). Unauthenticated runs work but are limited to 60 requests/hour,
 * which is not enough for a full run.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKLOG = path.join(ROOT, 'docs', 'plan', '05-backlog.md');

const DRY_RUN = process.argv.includes('--dry-run');
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';

// ---------------------------------------------------------------------------
// Repository

async function resolveRepo() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const { execSync } = await import('node:child_process');
  const url = execSync('git remote get-url origin', { cwd: ROOT }).toString().trim();
  const m = url.match(/github\.com[:/]([^/]+)\/([^/\s]+?)(?:\.git)?$/);
  if (!m) throw new Error(`Cannot parse a GitHub repo out of origin: ${url}`);
  return `${m[1]}/${m[2]}`;
}

// ---------------------------------------------------------------------------
// Markdown parsing

/** `### \`[F0.1]\` Some title` -> `[F0.1] Some title` */
function parseHeading(line) {
  return line
    .replace(/^###\s+/, '')
    .replace(/`/g, '')
    .trim();
}

/** `**Labels:** \`a\` \`b\` · **Estimate:** S · **Depends on:** —` */
function parseMeta(line) {
  const labels = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const estimate = line.match(/\*\*Estimate:\*\*\s*([A-Z]+)/)?.[1] ?? null;
  return { labels, estimate };
}

function parseBacklog(md) {
  // The label definitions table: `| \`label\` | meaning |`
  const labelDefs = new Map();
  for (const line of md.split('\n')) {
    const m = line.match(/^\|\s*`([a-z][a-z0-9:-]+)`\s*\|\s*(.+?)\s*\|\s*$/);
    if (m && m[1].includes(':')) labelDefs.set(m[1], m[2]);
  }
  // Explicitly, because not every label appears as its own table row.
  for (const l of [
    'phase:foundation', 'phase:pipeline', 'phase:frontend',
    'phase:secondary', 'phase:polish', 'phase:live',
    'area:infra', 'area:data', 'area:ui', 'area:content', 'area:a11y',
    'priority:p0', 'priority:p1', 'priority:p2',
    'deferred',
  ]) {
    if (!labelDefs.has(l)) labelDefs.set(l, l);
  }

  // Blocks start at a `### ` heading whose text looks like `[XX.n] Title`.
  const blocks = [];
  const lines = md.split('\n');
  let current = null;

  for (const line of lines) {
    const heading = line.startsWith('### ') ? parseHeading(line) : null;
    const isIssue = heading && /^\[[A-Z]\d+\.?\d*\]/.test(heading);

    if (isIssue) {
      if (current) blocks.push(current);
      current = { title: heading, metaLine: null, bodyLines: [] };
      continue;
    }
    if (line.startsWith('---') && current && current.bodyLines.length) {
      // End of the current issue block.
      continue;
    }
    if (!current) continue;
    if (line.startsWith('**Labels:**')) {
      current.metaLine = line;
      continue;
    }
    current.bodyLines.push(line);
  }
  if (current) blocks.push(current);

  const issues = blocks.map((b) => {
    const { labels, estimate } = b.metaLine ? parseMeta(b.metaLine) : { labels: [], estimate: null };
    const body = b.bodyLines.join('\n').trim();
    return { title: b.title, labels, estimate, body };
  });

  // Milestones mirror the roadmap phases, taken from the phase label.
  const phaseToMilestone = {
    'phase:foundation': 'F0 — Foundation',
    'phase:pipeline': 'F1 — Data pipeline',
    'phase:frontend': 'F2 — Frontend core',
    'phase:secondary': 'F3 — Secondary pages',
    'phase:polish': 'F4 — Media & polish',
    'phase:live': 'F5 — Live layer',
  };

  return { issues, labelDefs, phaseToMilestone };
}

// ---------------------------------------------------------------------------
// GitHub client

function makeClient(repo) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'tga-backlog-sync',
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };

  async function call(method, endpoint, payload) {
    const res = await fetch(`https://api.github.com${endpoint}`, {
      method,
      headers: payload ? { ...headers, 'Content-Type': 'application/json' } : headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${method} ${endpoint} -> ${res.status} ${text.slice(0, 300)}`);
    }
    return res.status === 204 ? null : res.json();
  }

  return {
    listLabels: () => call('GET', `/repos/${repo}/labels?per_page=100`).then((r) => r ?? []),
    createLabel: (name, description) =>
      call('POST', `/repos/${repo}/labels`, { name, description: description.slice(0, 100), color: labelColor(name) }),
    listMilestones: () => call('GET', `/repos/${repo}/milestones?state=all&per_page=100`).then((r) => r ?? []),
    createMilestone: (title) => call('POST', `/repos/${repo}/milestones`, { title }),
    listIssues: async () => {
      const all = [];
      for (let page = 1; page <= 10; page++) {
        const batch = await call('GET', `/repos/${repo}/issues?state=all&per_page=100&page=${page}`);
        if (!batch?.length) break;
        all.push(...batch);
      }
      return all;
    },
    createIssue: (payload) => call('POST', `/repos/${repo}/issues`, payload),
  };
}

/** Stable pseudo-random colour so re-runs produce the same label colours. */
function labelColor(name) {
  if (name.startsWith('phase:')) return '5319e7';
  if (name.startsWith('area:')) return '1d76db';
  if (name === 'priority:p0') return 'b60205';
  if (name === 'priority:p1') return 'd93f0b';
  if (name === 'priority:p2') return 'fbca04';
  if (name === 'deferred') return 'bfd4f2';
  return 'ededed';
}

// ---------------------------------------------------------------------------

async function main() {
  const md = await readFile(BACKLOG, 'utf8');
  const { issues, labelDefs, phaseToMilestone } = parseBacklog(md);
  const repo = await resolveRepo();

  console.log(`repo: ${repo}`);
  console.log(`parsed ${issues.length} issues from docs/plan/05-backlog.md\n`);

  if (!issues.length) throw new Error('Parsed zero issues — the backlog format probably changed.');

  if (DRY_RUN) {
    for (const i of issues) {
      const ms = i.labels.map((l) => phaseToMilestone[l]).find(Boolean) ?? '—';
      console.log(`  ${i.title}`);
      console.log(`    labels: ${i.labels.join(' ') || '(none)'}   milestone: ${ms}   estimate: ${i.estimate ?? '—'}`);
    }
    const used = new Set(issues.flatMap((i) => i.labels));
    console.log(`\nlabels to ensure: ${[...used].sort().join(', ')}`);
    console.log('\nDry run — nothing was created.');
    return;
  }

  if (!TOKEN) {
    console.warn('!! No GH_TOKEN set. Unauthenticated writes will fail and reads are capped at 60/h.\n');
  }

  const gh = makeClient(repo);

  // 1. Labels
  const existingLabels = new Set((await gh.listLabels()).map((l) => l.name));
  for (const name of [...labelDefs.keys()].sort()) {
    if (existingLabels.has(name)) continue;
    console.log(`+ label ${name}`);
    await gh.createLabel(name, labelDefs.get(name));
  }

  // 2. Milestones
  const milestones = new Map((await gh.listMilestones()).map((m) => [m.title, m.number]));
  for (const title of [...new Set(Object.values(phaseToMilestone))]) {
    if (milestones.has(title)) continue;
    console.log(`+ milestone ${title}`);
    const created = await gh.createMilestone(title);
    milestones.set(title, created.number);
  }

  // 3. Issues — idempotent on title
  const existingTitles = new Set((await gh.listIssues()).map((i) => i.title));
  let created = 0;
  let skipped = 0;

  for (const issue of issues) {
    if (existingTitles.has(issue.title)) {
      skipped++;
      continue;
    }
    const milestoneTitle = issue.labels.map((l) => phaseToMilestone[l]).find(Boolean);
    const payload = {
      title: issue.title,
      body: issue.body,
      labels: issue.labels,
      ...(milestoneTitle && milestones.has(milestoneTitle)
        ? { milestone: milestones.get(milestoneTitle) }
        : {}),
    };
    if (TOKEN) await new Promise((r) => setTimeout(r, 250)); // stay well inside rate limits
    const res = await gh.createIssue(payload);
    console.log(`+ #${res.number} ${issue.title}`);
    created++;
  }

  console.log(`\ndone — ${created} created, ${skipped} already present.`);
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
