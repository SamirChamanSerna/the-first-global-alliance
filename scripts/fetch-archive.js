// node scripts/fetch-archive.js [years…]
//
// Descarga las respuestas CRUDAS de api.first.global a data/raw/api/.
// No interpreta, no renombra ni transforma nada: eso es scripts/normalize.js.
// Un archivo crudo se puede volver a descargar; por eso no se edita a mano.
//
// Sin argumentos descarga los años con datos completos y los años de solo premios.
// Ver docs/discovery/02-data-sources.md para la matriz de confiabilidad.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'data', 'raw', 'api');
const API = 'https://api.first.global';

// 2024-2025: todo. 2017-2019 y 2022-2023: solo los premios son confiables.
// 2020 y 2021 no existen en la API (no hubo competencia) — ver 05-plan.md.
const FULL_YEARS = [2024, 2025, 2026];
const AWARDS_YEARS = [2017, 2018, 2019, 2022, 2023];

const years = process.argv.slice(2).map(Number).filter(Boolean);
const list = years.length ? years : [...new Set([...FULL_YEARS, ...AWARDS_YEARS])].sort((a, b) => a - b);

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

fs.mkdirSync(DIR, {recursive: true});

if (!fs.existsSync(path.join(DIR, 'teams.json')) || process.argv.includes('--teams')) {
  const teams = await get(`${API}/v1/teams`);
  fs.writeFileSync(path.join(DIR, 'teams.json'), JSON.stringify(teams, null, 1), 'utf8');
  console.log(`teams.json      ${teams.length} equipos`);
}

for (const y of list) {
  // excludeMatchDetails=false SIEMPRE: verificado contra la API que `field` y `played`
  // —lo único que el pipeline necesita además de los equipos— vienen en los dos casos,
  // así que pedir `true` no ahorraba nada y sí perdía el desglose (`details`) de los
  // partidos ya jugados. Sin él, `normalize` no puede rellenar `breakdown` y una
  // temporada en curso publicaba un 0 donde no había dato (regla 6: el hueco se declara,
  // nunca se rellena con un cero). El atributo se añadió cuando la API sí lo omitía.
  const snapshot = await get(`${API}/v1?year=${y}&excludeMatchDetails=false`);
  fs.writeFileSync(path.join(DIR, `${y}.json`), JSON.stringify(snapshot), 'utf8');
  const counts = Object.entries(snapshot)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : '?'}`)
    .join('  ');
  console.log(`${y}.json      ${counts}`);
}

console.log(`\nCrudo en ${path.relative(ROOT, DIR)} · siguiente paso: node scripts/normalize.js`);
