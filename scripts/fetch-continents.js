// node scripts/fetch-continents.js
//
// Rellena `continent` en data/raw/manual/teams.json.
//
// El continente no existe en api.first.global y el sitio lo necesita para agrupar
// /teams/ en cinco regiones. Se toma del listado ISO 3166-1 del repositorio
// lukes/ISO-3166-Countries-with-Regional-Codes (cuyas `region` son exactamente
// Africa / Americas / Asia / Europe / Oceania).
//
// Solo escribe `continent`: el resto de cada equipo (nombre, redes, contacto y la
// clave de bandera) se preserva tal cual.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEAMS = path.join(ROOT, 'data', 'raw', 'manual', 'teams.json');
const CACHE = path.join(ROOT, 'data', 'raw', 'api', 'iso-regions.json');
const SOURCE = 'https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json';

const REGIONS = new Set(['Africa', 'Americas', 'Asia', 'Europe', 'Oceania']);

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

if (!fs.existsSync(TEAMS)) throw new Error('Falta data/raw/manual/teams.json');

const teams = JSON.parse(fs.readFileSync(TEAMS, 'utf8'));
const {byAlpha2, byAlpha3} = await regions();

// El puente fiable es alpha-2: el roster trae códigos alpha-3 obsoletos (ANT no
// existe en el ISO vigente, pero su alpha-2 «ag» sí). Ver scripts/lib/codes.js.
//
// El listado tiene dos países sin región resoluble y hay que fijarlos a mano:
// Taiwán (`TW`) aparece con la `region` vacía, y Kosovo (`XK`) no tiene alpha-2 en
// ISO 3166-1. Sin esto, Chinese Taipei y Kosovo se quedan sin continente y
// desaparecen del directorio /teams/.
const OVERRIDE = {TW: 'Asia', XK: 'Europe'};

const regionOf = (code, t) => {
  const a2 = String(t.countryCode ?? '').toUpperCase().split('_')[0];
  return byAlpha2[a2] ?? byAlpha3[String(code).toUpperCase()] ?? OVERRIDE[a2] ?? '';
};

let filled = 0;
const unresolved = [];

for (const [code, t] of Object.entries(teams)) {
  const region = regionOf(code, t);
  if (!region) {
    if (!t.continent) unresolved.push(`${code} — ${t.name}`);
    continue;
  }
  if (t.continent !== region) {
    t.continent = region;
    filled++;
  }
}

fs.writeFileSync(TEAMS, JSON.stringify(teams, null, 1) + '\n', 'utf8');

console.log(`teams.json — ${filled} continente(s) escrito(s), ${Object.keys(teams).length} equipos`);
if (unresolved.length) {
  console.log(`\nSin continente resoluble (${unresolved.length}) — rellénalos a mano en teams.json:`);
  unresolved.forEach((u) => console.log('  · ' + u));
}
console.log('\nsiguiente paso: node scripts/normalize.js && node site/build.js');
