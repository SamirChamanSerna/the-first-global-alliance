// Pruebas de regresión del pipeline con los datos reales del repositorio.
// Se ejecutan con `node --test tests/`; antes de probar, normalize regenera
// data/processed/. No tocan site/dist/.
import {before, test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'processed', rel), 'utf8')).data;

before(() => {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'normalize.js')], {cwd: ROOT, stdio: 'pipe'});
});

test('las diez temporadas existen y 2026 está archivada', () => {
  const seasons = read('seasons.json');
  assert.equal(seasons.length, 10);
  const y2026 = seasons.find((s) => s.y === 2026);
  assert.equal(y2026.mode, 'archived');
  assert.equal(y2026.teams, 185);
  assert.ok(seasons.every((s) => ['archived', 'live', 'awards-only'].includes(s.mode)));
});

test('2026 tiene los 359 partidos, las finales y el desglose de 10 filas', () => {
  const matches = read('2026/matches.json');
  assert.equal(matches.length, 359);
  assert.equal(matches.filter((m) => m.stage === 'finals').length, 3);
  const final = matches.find((m) => m.id === '2026_f1');
  assert.equal(final.breakdown.length, 10);
  assert.deepEqual(final.breakdown[1], ['Climb multiplier', 'x1.90', 'x1.90']);
});

test('el ranking de 2026 usa las cuatro columnas de la temporada', () => {
  const rankings = read('2026/rankings.json');
  assert.equal(rankings.length, 185);
  assert.equal(rankings[0].code, 'UZB');
  assert.equal(rankings[0].rank, 1);
  assert.deepEqual(rankings[0].cols.map(([label]) => label), ['Ranking score', 'Highest points', 'Climb points', 'Played']);
});

test('los premios de 2026 excluyen los individuales y de mentoría', () => {
  const awards = read('2026/awards.json');
  assert.equal(awards.length, 17);
  assert.ok(!awards.some((a) => /Mentorship|Caldas/.test(a.name)));
  assert.equal(read('2026/alliances.json').length, 8);
});

test('el catálogo de premios unifica los nombres que cambian entre temporadas', () => {
  const names = read('awards.json').map(([name]) => name);
  assert.ok(names.includes('FIRST Global Winning Alliance Award - Gold'));
  assert.ok(!names.includes('FIRST Global Winning Alliance Award'));
  assert.ok(names.includes('Judges Award'));
  assert.ok(!names.includes('Judges Award - Technical'));
  assert.ok(names.includes('Jackie Bezos Award for International Enthusiasm'));
  assert.ok(!names.includes('International Enthusiasm Award'));
});

test('2025 conserva los 381 partidos y su desglose de temporada', () => {
  const matches = read('2025/matches.json');
  assert.equal(matches.length, 381);
  const first = matches.find((m) => m.stage === 'ranking' && m.breakdown.length);
  assert.equal(first.breakdown.length, 12);
  assert.deepEqual(first.breakdown[3], ['Biodiversity distribution factor', '50%', '50%']);
});

test('2024 salta la fila de ranking sin equipo', () => {
  const rankings = read('2024/rankings.json');
  assert.equal(rankings.length, 180);
  assert.equal(read('2024/matches.json').length, 379);
});

test('2023 entra como temporada completa', () => {
  assert.equal(read('2023/matches.json').length, 338);
  assert.equal(read('2023/rankings.json').length, 191);
});

test('2019 conserva el récord manual y 2020/2021 sus premios', () => {
  const isr = read('2019/rankings.json').find((r) => r.code === 'ISR');
  assert.equal(isr.rank, 1);
  assert.equal(isr.w, 9);
  assert.equal(isr.l, 0);
  assert.equal(isr.t, 0);
  assert.equal(read('2020/awards.json').length, 10);
  assert.equal(read('2021/awards.json').length, 12);
});

test('las playlists tienen sus ocho temporadas con competición', () => {
  const playlists = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'processed', 'playlists.json'), 'utf8')).data;
  const withUrl = Object.values(playlists).filter((p) => p.url);
  assert.equal(withUrl.length, 8);
  assert.ok(withUrl.every((p) => p.thumbnail));
});
