// node scripts/fetch-flags.js
//
// Espeja en site/flags/ el juego completo de banderas SVG.
//
//   1. flag-icons (MIT) — se descarga el set 4x3 ENTERO, no solo las que el sitio usa
//      hoy, para que una temporada futura (2026) tenga ya lo que necesite.
//   2. results.first.global — solo los códigos que flag-icons no tiene se copian tal
//      cual de ahí (el equipo de refugiados y los assets regionales).
//
// Por qué no se usa results.first.global para todo: son exportaciones de Inkscape a
// 1600x960 con escudos en detalle, 47 MB en total y hasta 1,3 MB por archivo — la
// página de equipos bajaría 45 MB. flag-icons pesa 2 MB y su bandera mediana es de
// 0,8 KB. Ver docs/api-notes.md.
//
// Idempotente: lo que ya está descargado no se vuelve a pedir.
// site/build.js copia estas a dist/ y solo genera un marcador para las que falten.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site', 'flags');
const RAW = path.join(ROOT, 'data', 'raw', 'api');
const CONCURRENCY = 8;

const FLAG_ICONS = '7.2.3';
const FI_CDN = `https://cdn.jsdelivr.net/npm/flag-icons@${FLAG_ICONS}/flags/4x3`;
const FI_LIST = `https://data.jsdelivr.com/v1/packages/npm/flag-icons@${FLAG_ICONS}?structure=flat`;
const FGC = 'https://results.first.global/static/flags/4x3';

// Assets de results.first.global que no son países y que flag-icons no cubre.
const REGIONAL = ['11_south-america', '12_oceania', '13_north-america', '14_europe'];

const saver = async (url, name) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  // Los 404 de results.first.global devuelven una página HTML, no una imagen.
  if (!body.includes('<svg')) throw new Error('la respuesta no es un SVG');
  fs.writeFileSync(path.join(OUT, `${name}.svg`), body, 'utf8');
};

async function run(queue, label) {
  const failed = [];
  let done = 0;
  const total = queue.length;
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      try { await saver(item.url, item.name); done++; }
      catch (e) { failed.push(`${item.name} (${e.message})`); }
    }
  }
  await Promise.all(Array.from({length: CONCURRENCY}, worker));
  console.log(`${label}: ${done}/${total} descargadas`);
  return failed;
}

/** Nombres de bandera que el sitio necesita hoy, tomados del roster (alpha-2). */
function neededBySite() {
  const teams = JSON.parse(fs.readFileSync(path.join(RAW, 'teams.json'), 'utf8'));
  return new Set(teams.map((t) => String(t.countryCode).toLowerCase()).filter(Boolean));
}

fs.mkdirSync(OUT, {recursive: true});
const have = (name) => fs.existsSync(path.join(OUT, `${name}.svg`));

// ---- 1. flag-icons: el set completo ----
console.log('Listando flag-icons…');
const listing = await (await fetch(FI_LIST)).json();
const fiNames = listing.files
  .map((f) => f.name)
  .filter((n) => n.startsWith('/flags/4x3/') && n.endsWith('.svg'))
  .map((n) => path.basename(n, '.svg'));

const fiQueue = fiNames.filter((n) => !have(n)).map((n) => ({name: n, url: `${FI_CDN}/${n}.svg`}));
console.log(`flag-icons: ${fiNames.length} banderas en el set, ${fiQueue.length} por descargar`);
const failed = await run(fiQueue, 'flag-icons');

// ---- 2. results.first.global: lo que flag-icons no tiene ----
const fiSet = new Set(fiNames);
const fallback = [...new Set([...neededBySite()].filter((n) => !fiSet.has(n)))].sort();
const all = [...new Set([...fallback, ...REGIONAL])].filter((n) => !have(n));
console.log(`\nresults.first.global: ${all.length} por descargar (${fallback.length} que el sitio necesita, ${REGIONAL.length} regionales)`);
const failedFgc = await run(all.map((n) => ({name: n, url: `${FGC}/${n}.svg`})), 'results.first.global');

const missing = [...failed, ...failedFgc];
const total = fs.readdirSync(OUT).filter((f) => f.endsWith('.svg')).length;
const bytes = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`\nsite/flags/ — ${total} banderas, ${(bytes / 1048576).toFixed(1)} MB`);
if (missing.length) {
  console.log(`\nSin descargar (${missing.length}) — el build generará un marcador gris para estas:`);
  missing.forEach((m) => console.log('  · ' + m));
}
console.log('\nsiguiente paso: node site/build.js');
