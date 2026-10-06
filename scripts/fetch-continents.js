// node scripts/fetch-continents.js
//
// Rellena la columna `continent` de data/raw/manual/teams.csv.
//
// El continente no existe en api.first.global y el sitio lo necesita para agrupar
// /teams/ en cinco regiones. Se toma del listado ISO 3166-1 del repositorio
// lukes/ISO-3166-Countries-with-Regional-Codes (cuyas `region` son exactamente
// Africa / Americas / Asia / Europe / Oceania).
//
// Solo escribe esa columna: el resto de teams.csv (fotos, redes, contacto) es
// entrada manual y se preserva tal cual.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEAMS = path.join(ROOT, 'data', 'raw', 'manual', 'teams.csv');
const CACHE = path.join(ROOT, 'data', 'raw', 'api', 'iso-regions.json');
const SOURCE = 'https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json';

const REGIONS = new Set(['Africa', 'Americas', 'Asia', 'Europe', 'Oceania']);
const COL = 'continent';

/** RFC 4180: entrecomilla si hay coma, comilla o salto. */
const cell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function parseCsv(text) {
  const rows = [];
  let row = [], v = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { v += '"'; i++; } else q = false; } else v += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(v); v = ''; }
    else if (c === '\n') { row.push(v); v = ''; rows.push(row); row = []; }
    else if (c !== '\r') v += c;
  }
  row.push(v);
  rows.push(row);
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

async function regions() {
  if (!fs.existsSync(CACHE)) {
    const res = await fetch(SOURCE);
    if (!res.ok) throw new Error(`${SOURCE} → HTTP ${res.status}`);
    fs.mkdirSync(path.dirname(CACHE), {recursive: true});
    fs.writeFileSync(CACHE, await res.text(), 'utf8');
  }
  const data = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const byAlpha2 = {}, byAlpha3 = {};
  for (const c of data) {
    if (REGIONS.has(c.region)) {
      if (c['alpha-2']) byAlpha2[c['alpha-2'].toUpperCase()] = c.region;
      if (c['alpha-3']) byAlpha3[c['alpha-3'].toUpperCase()] = c.region;
    }
  }
  return {byAlpha2, byAlpha3};
}

if (!fs.existsSync(TEAMS)) throw new Error(`Falta ${path.relative(ROOT, TEAMS)} — ejecuta node scripts/make-manual-templates.js`);

const roster = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'raw', 'api', 'teams.json'), 'utf8'));
const {byAlpha2, byAlpha3} = await regions();

// El puente fiable es alpha-2: el roster trae códigos alpha-3 obsoletos (ANT no
// existe en el ISO vigente, pero su alpha-2 «ag» sí). Ver scripts/lib/codes.js.
const regionOf = (t) => byAlpha2[String(t.countryCode).toUpperCase()] ?? byAlpha3[t.country.toUpperCase()] ?? '';

const rows = parseCsv(fs.readFileSync(TEAMS, 'utf8'));
const head = rows[0].map((h) => h.trim());
const iCode = head.indexOf('team_code');
const iCol = head.indexOf(COL);
if (iCode < 0 || iCol < 0) throw new Error(`teams.csv: faltan las columnas team_code o ${COL}`);

const known = new Map(rows.slice(1).map((r) => [r[iCode], r]));
let filled = 0;
const unresolved = [];

for (const t of roster) {
  const row = known.get(t.country);
  if (!row) { unresolved.push(`${t.country} (no está en teams.csv)`); continue; }
  const region = regionOf(t);
  if (!region) { unresolved.push(`${t.country} — ${t.name}`); continue; }
  if (row[iCol] !== region) { row[iCol] = region; filled++; }
}

fs.writeFileSync(TEAMS, [head, ...rows.slice(1)].map((r) => r.map(cell).join(',')).join('\n') + '\n', 'utf8');

console.log(`teams.csv — ${filled} continente(s) escrito(s), ${known.size} equipos`);
if (unresolved.length) {
  console.log(`\nSin continente resoluble (${unresolved.length}) — rellénalos a mano en teams.csv:`);
  unresolved.forEach((u) => console.log('  · ' + u));
}
console.log('\nsiguiente paso: node scripts/normalize.js && node site/build.js');
