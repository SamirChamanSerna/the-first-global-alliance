// ÚNICA fuente de datos de las plantillas.
//
// Lee data/processed/ — los datos reales, generados por scripts/normalize.js.
// Si no existe, cae al fixture site/mock/mock.js y el build produce el sitio de
// prueba. Es a propósito: el sitio se puede construir y revisar sin datos reales.
//
// Forma de los datos (idéntica en ambos casos): docs/discovery/03-raw-data-standard.md
// Claves y convenciones: docs/discovery/06-join-keys.md
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as fixture from '../mock/mock.js';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'processed');

const read = (file) => {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
    // Los archivos procesados llevan cabecera: {schemaVersion, generatedAt, generator, data}.
    return j && !Array.isArray(j) && 'data' in j ? j.data : j;
  } catch {
    return null;
  }
};

/**
 * Arma las estructuras que consume pages.js desde data/processed/.
 * Devuelve null si los datos reales no están completos: es preferible construir
 * el sitio de prueba que publicar un archivo a medias.
 *
 * Archivos esperados:
 *   seasons.json            [{y, name, city, country, iso, dates, mode}]
 *   teams.json              {CODE: {name, continent}}
 *   photos.json             {"2025": {CODE: url}}   una foto por equipo y temporada
 *   awards.json             [[name, desc, ty, tier], …]   catálogo de premios
 *   {year}/matches.json     [{id, stage, label, …, red[], blue[], rs, bs, breakdown[],
 *                             video, stream}]   `video` = enlace exacto del partido (o
 *                           null) y `stream` = enlace del campo de su día (o null)
 *   {year}/streams.json     {year, latest, days:[{day, fields:{"Field N": {id, url}}}]}
 *                           enlaces de cada campo y día; `latest` es el día en juego
 *   {year}/rankings.json    [{code, rank, cols: [[etiqueta, valor]…], w?, l?, t?, n?, avg?}]
 *                           `cols` son los criterios de desempate DE ESA temporada, en su
 *                           orden, con la etiqueta que fija rankings.labels.json. `w/l/t`
 *                           (y `n`, `avg`) solo existen si esa temporada trae récord.
 *   {year}/alliances.json   [{teams: [CODE, …], rank, score, played}, …]   las alianzas de
 *                           playoffs en orden; `rank`/`score`/`played` son su puesto en la
 *                           fase de round robin y valen null mientras la API no lo publique
 *   {year}/awards.json      [{name, desc, ty, tier, w[]}]
 */
function load() {
  const seasons = read('seasons.json');
  if (!Array.isArray(seasons) || !seasons.length) return null;

  const teams = read('teams.json');
  if (!teams) return null;

  const M = {}, S = {}, A = {}, AL = {}, ST = {};
  for (const s of seasons) {
    M[s.y] = read(`${s.y}/matches.json`) ?? [];
    S[s.y] = read(`${s.y}/rankings.json`) ?? [];
    AL[s.y] = read(`${s.y}/alliances.json`) ?? [];
    A[s.y] = read(`${s.y}/awards.json`) ?? [];
    // Enlaces de los streams, por temporada. Solo la temporada viva los tiene hoy, y el
    // GameDay los necesita para construir sus botones de campo.
    ST[s.y] = read(`${s.y}/streams.json`) ?? null;
  }
  // Sin ningún partido en ninguna temporada los datos procesados no sirven: es
  // preferible construir el sitio de prueba que publicar un archivo a medias.
  // (Una temporada suelta sin partidos sí es normal: 2020-2021 o un año sin empezar.)
  if (!seasons.some((s) => M[s.y].length)) return null;

  const T = {};
  for (const [code, v] of Object.entries(teams)) T[code] = [v.name, v.continent];

  // Las fotos son opcionales: un processed/ sin photos.json sigue sirviendo y las
  // páginas caen a su marcador. Hacerlas obligatorias mandaría al fixture cualquier
  // data/processed/ generado antes de que existiera este archivo.
  return {seasons, T, codes: Object.keys(T), M, S, A, AL, ST, AW: read('awards.json') ?? [], PH: read('photos.json') ?? {}};
}

const real = load();

/** 'processed' = datos reales · 'fixture' = datos de prueba. El build lo imprime. */
export const source = real ? 'processed' : 'fixture';

const d = real ?? fixture;
export const seasons = d.seasons;
export const T = d.T;
export const codes = d.codes;
export const M = d.M;
export const S = d.S;
export const A = d.A;
export const AL = d.AL;
export const AW = d.AW;
export const PH = d.PH ?? {};
/** Enlaces de los streams por temporada (día → campo). El fixture trae un juego mínimo
 *  para que la barra de campos del GameDay también se vea sin datos reales. */
export const ST = d.ST ?? {};

/**
 * Código de país → nombre del archivo de bandera. El repositorio real de banderas
 * está indexado por alpha-2 (`mx.svg`, no `mex.svg`) y el equipo de refugiados usa
 * el asset especial `10_hope`. Sin datos reales el nombre es el propio código, que
 * es lo que genera el fixture: `/flags/mex.svg`.
 */
const flagNames = read('flags.json') ?? {};
export const flagFile = (code) => flagNames[code] ?? code;
