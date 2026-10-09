// node scripts/normalize.js
//
// data/raw/ → data/processed/  (la forma que consume site/templates/data.js)
//
// Reglas (docs/discovery/03-raw-data-standard.md, 06-join-keys.md):
//   · team_code = ISO alpha-3. NUNCA teamKey: cambia de un año a otro.
//   · Un dato ausente se omite; nunca se escribe 0 ni "". El hueco lo cubre la
//     plantilla con su estado vacío explícito.
//   · La validación falla en voz alta: mejor romper el build que publicar una celda mal.
//
// Años completos: 2024-2025. Años de solo premios: 2017-2019, 2022-2023.
// Los partidos de 2017-2023 son entrada manual. 2020-2021 no existen en la API.
// Ver docs/discovery/02-data-sources.md.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readSnapshots, buildAliases} from './lib/codes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw');
const OUT = path.join(ROOT, 'data', 'processed');

const SCHEMA_VERSION = 1;
const FULL_YEARS = [2024, 2025, 2026];
const AWARDS_YEARS = [2017, 2018, 2019, 2022, 2023];
const ALL_YEARS = [...new Set([...FULL_YEARS, ...AWARDS_YEARS])].sort((a, b) => a - b);
const STAGES = {t2: {stage: 'ranking', letter: 'q'}, t3: {stage: 'round_robin', letter: 'rr'}, t4: {stage: 'finals', letter: 'f'}};
const STAGE_NAMES = ['ranking', 'round_robin', 'finals'];
// Una URL escrita a mano acaba en un href/src, así que solo se acepta http(s):
// un esquema javascript: o data: sería un vector. Se declara aquí arriba porque lo
// usan tanto seasons.csv (reveal_video) como photos.csv, y una const usada antes de
// su declaración rompería el script entero por TDZ.
const HTTP_URL = /^https?:\/\//i;

const die = (msg) => { throw new Error(msg); };

// ---------------------------------------------------------------- CSV

/** Parser RFC 4180 mínimo: comillas dobles, comas y saltos dentro de comillas. */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); cell = ''; rows.push(row); row = []; }
    else if (c !== '\r') cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

const toObjects = (rows) => {
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
};

const readText = (rel) => {
  const f = path.join(RAW, rel);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};
const readJson = (rel) => { const t = readText(rel); return t ? JSON.parse(t) : null; };
const readCsv = (rel) => { const t = readText(rel); return t ? toObjects(parseCsv(t)) : []; };

// ---------------------------------------------------------------- roster

const roster = readJson('api/teams.json') ?? die('Falta data/raw/api/teams.json — ejecuta node scripts/fetch-archive.js');
// Los códigos de país no son consistentes entre fuentes ni entre años: `alias`
// traduce lo que aparece en la competición al código del roster, que es la única
// clave del sitio. Ver scripts/lib/codes.js.
const alias = buildAliases(roster, readSnapshots(path.join(RAW, 'api')));
// `alias` solo conoce los códigos que aparecen en los snapshots de la competición, así
// que un CSV escrito a mano con el alpha-3 ISO vigente (SAU, TWN, BHR, WSM, NPL…)
// quedaría fuera. El listado ISO cierra ese hueco con el MISMO puente de
// 06-join-keys.md — alpha-3 → alpha-2 → roster —, no con una tabla nueva.
const isoList = readJson('api/iso-regions.json');
const a3toA2 = Object.fromEntries((isoList ?? []).map((c) => [String(c['alpha-3']).toUpperCase(), String(c['alpha-2']).toLowerCase()]));
const rosterByA2 = Object.fromEntries(roster.map((t) => [String(t.countryCode).toLowerCase().split('_')[0], t.country]));
const canon = (c) => (c ? alias[c] ?? rosterByA2[a3toA2[c]] ?? c : c);

// Los premios identifican países por nombre y por alpha-2 (nunca por alpha-3).
// Los códigos especiales del roster llevan sufijo ("10_hope"); los de la competición no.
const a2key = (v) => String(v ?? '').toUpperCase().split('_')[0];
const byAlpha2 = {}, byNumeric = {}, byName = {};
for (const t of roster) {
  if (/^[A-Za-z]{2}$/.test(t.countryCode)) byAlpha2[t.countryCode.toUpperCase()] = t.country;
  byNumeric[a2key(t.countryCode)] = t.country;
  byName[t.name.replace(/^Team /, '').toLowerCase()] = t.country;
}
const resolveTeam = (o) => {
  if (!o) return null;
  const key = a2key(o.countryCode);
  return byAlpha2[key] ?? byNumeric[key] ?? byName[String(o.country ?? '').toLowerCase()] ?? null;
};

// ---------------------------------------------------------------- temporadas y equipos

const seasonRows = readCsv('manual/seasons.csv');
if (!seasonRows.length) die('data/raw/manual/seasons.csv está vacío');

const seasons = seasonRows
  .map((r) => ({
    y: Number(r.year),
    name: r.name,        // nombre del juego de esa temporada
    city: r.city,
    country: r.country,
    iso: r.iso,          // alpha-3 del país anfitrión: resuelve la bandera
    dates: r.dates,
    // Solo se acepta http(s): una URL con otro esquema (javascript:, data:) acabaría
    // en un href, y este campo lo rellena una persona a mano en un CSV.
    reveal: HTTP_URL.test((r.reveal_video ?? '').trim()) ? r.reveal_video.trim() : '',
    mode: r.mode || 'archived',
    // Nº de equipos participantes cuando NO se puede derivar de los datos: en 2020 y
    // 2021 no hay partidos ni rankings (competición virtual) y el dato solo lo tiene una
    // persona. Vacío = se deriva de los equipos rankeados, que es el caso normal.
    teamsRaw: (r.teams ?? '').trim(),
  }))
  .sort((a, b) => b.y - a.y); // más reciente primero: es el orden que espera el sitio
for (const s of seasons) {
  if (!Number.isInteger(s.y)) die(`seasons.csv: año inválido "${s.y}"`);
  if (!['archived', 'live', 'awards-only'].includes(s.mode)) die(`seasons.csv: mode inválido "${s.mode}" (fila ${s.y})`);
  if (s.teamsRaw !== '' && !/^\d+$/.test(s.teamsRaw)) {
    die(`seasons.csv: teams inválido en ${s.y} ("${s.teamsRaw}") — deja la celda vacía o escribe un entero`);
  }
}

const continentOf = Object.fromEntries(readCsv('manual/teams.csv').map((r) => [r.team_code, r.continent]));

// Nombre para mostrar: la API da "Team Mexico" en el roster y "Mexico" en los
// rankings. Se prefiere el primero que aparezca en un ranking.
const displayNames = {};
const rememberName = (code, name) => {
  if (!code || !name || displayNames[code]) return;
  displayNames[code] = String(name).replace(/^Team /, '').trim();
};

// ---------------------------------------------------------------- vídeos y streams
//
// Dos entradas manuales, las dos por temporada:
//   · `manual/{year}/streams.csv` — el enlace de CADA campo en CADA día. Es lo que
//     alimenta el GameDay (siempre el día más reciente) y el enlace de reserva de los
//     partidos de ese día.
//   · `manual/{year}/{year}.json` — la salida del extractor de vídeo: por partido, el
//     stream del campo con el segundo exacto en el que empieza. Solo es una parte de
//     los partidos; los que falten se quedan con el enlace del campo, que es un estado
//     declarado, no un hueco silencioso.
//
// El id de YouTube es lo que necesita el reproductor del GameDay (`/embed/{id}`).
// Se exige que la URL sea de YouTube y traiga id: una URL sin id acabaría en un iframe
// roto, y es preferible que el build lo diga a publicarlo.
const YT_ID = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/;

/** Enlaces por (día, campo) de una temporada, tal como los escribe el CSV. */
function readStreams(year) {
  const rows = readCsv(`manual/${year}/streams.csv`);
  if (!rows.length) return null;
  const days = new Map();
  for (const [i, r] of rows.entries()) {
    const n = i + 2; // +1 por la cabecera, +1 porque el índice empieza en 0
    const day = Number(r.day), field = Number(r.field), url = (r.youtube_url ?? '').trim();
    const fail = (msg) => die(`streams.csv de ${year} (fila ${n}): ${msg}`);
    if (r.year !== String(year)) fail(`el año es "${r.year}" y el archivo está en la carpeta de ${year}`);
    if (!Number.isInteger(day) || day < 1) fail(`día inválido "${r.day}"`);
    if (!Number.isInteger(field) || field < 1 || field > 5) fail(`campo inválido "${r.field}" (1–5)`);
    if (!HTTP_URL.test(url)) fail(`URL vacía o sin http(s) — "${r.youtube_url ?? ''}"`);
    if (!YT_ID.test(url)) fail(`"${url}" no es una URL de YouTube con id`);
    const fields = days.get(day) ?? new Map();
    if (fields.has(field)) fail(`el campo ${field} del día ${day} está repetido`);
    fields.set(field, {id: YT_ID.exec(url)[1], url});
    days.set(day, fields);
  }
  // El día más alto es el que se está jugando: el GameDay se actualiza solo al añadir
  // las filas del día siguiente, sin ningún interruptor que mantener a mano.
  const latest = Math.max(...days.keys());
  return {
    year,
    latest,
    days: [...days.keys()].sort((a, b) => a - b).map((day) => ({
      day,
      fields: Object.fromEntries([...days.get(day).keys()].sort((a, b) => a - b).map((f) => [`Field ${f}`, days.get(day).get(f)])),
    })),
  };
}

/** Vídeo exacto por partido, desde la salida del extractor, indexado por `match_number`
 *  del bloque `RANK` (que es el número del partido `{year}_qN`). Se ignoran las
 *  detecciones sin equipos (`stage: "UNKNOWN"`, extracciones fallidas: no hay nada con
 *  lo que unirlas a un partido). La comprobación de que cada número exista se hace al
 *  final, con `check`, junto al resto de la validación. */
function readExactVideos(year) {
  const raw = readJson(`manual/${year}/${year}.json`);
  if (!raw) return null;
  const map = new Map();
  let unusable = 0;
  for (const e of raw) {
    const url = (e.video?.url ?? '').trim();
    if (e.stage !== 'RANK' || !Number.isInteger(e.match_number) || !HTTP_URL.test(url)) { unusable++; continue; }
    map.set(e.match_number, {url, entry: e.id});
  }
  return {year, map, unusable};
}

const streamsByYear = {};
const exactByYear = {};
for (const y of FULL_YEARS) {
  const s = readStreams(y);
  if (s) streamsByYear[y] = s;
  const e = readExactVideos(y);
  if (e) exactByYear[y] = e;
}

// Un solo aviso por temporada, resumido: el detalle de cada detección fallida está en
// el propio JSON del extractor, y repetirlo 44 veces no aporta nada al operador.
for (const e of Object.values(exactByYear)) {
  if (e.unusable) console.log(`aviso: ${e.unusable} entrada(s) de ${e.year}/${e.year}.json sin partido al que unirse — se omiten`);
}

// Día de competición = posición de la fecha entre las que aparecen en el snapshot, en
// orden. Es el único puente entre un partido y el stream de su día: `streams.csv` cuenta
// días, la API da fechas. Se comprobó contra el extractor: los 74 vídeos exactos son de
// partidos del 2026-10-08 y su id es justo el stream del día 1 de su campo.
const daysOf = (matches) => {
  const dates = [...new Set(matches.map((m) => (m.scheduledTime ?? '').slice(0, 10)).filter(Boolean))].sort();
  return new Map(dates.map((d, i) => [d, i + 1]));
};

// ---------------------------------------------------------------- partidos

/** Hora local del evento, tal como la declara la API ("...T11:15:00-05:00" → "11:15").
 *  Se lee de la cadena a propósito: new Date() la convertiría a la zona de quien compila. */
const timeOf = (iso) => {
  const m = /T(\d{2}):(\d{2})/.exec(iso ?? '');
  return m ? `${m[1]}:${m[2]}` : '';
};

function buildMatches(year, snapshot) {
  const days = daysOf(snapshot.matches ?? []);
  const streams = streamsByYear[year];
  const exact = exactByYear[year]?.map ?? new Map();
  return (snapshot.matches ?? []).map((m) => {
    const st = STAGES[m.tournamentKey] ?? die(`Año ${year}: tournamentKey desconocido "${m.tournamentKey}"`);
    const side = (lo, hi) => m.participants
      .filter((p) => p.station >= lo && p.station <= hi)
      .sort((a, b) => a.station - b.station)
      .map((p) => canon(p.country));
    const red = side(11, 14), blue = side(21, 24);
    if (!red.length || !blue.length) die(`Año ${year}: partido ${m.id} sin equipos`);
    // `played` es siempre true en un snapshot completo; si algún día no lo es, un
    // partido sin jugar deja rs/bs en null — nunca 0, que sería un resultado falso.
    const played = m.played === undefined ? true : !!m.played;
    const field = m.field === undefined ? '' : `Field ${m.field}`;
    // Stream del campo EN EL DÍA DE ESTE PARTIDO, no el del día que se juega hoy: un
    // partido del día 1 enlaza al stream del día 1. Se resuelve aquí para que la
    // plantilla no tenga que saber de qué día es cada partido.
    const day = days.get((m.scheduledTime ?? '').slice(0, 10));
    const stream = streams?.days.find((d) => d.day === day)?.fields[field]?.url ?? null;
    const video = st.stage === 'ranking' ? (exact.get(m.id)?.url ?? null) : null;
    return {
      id: `${year}_${st.letter}${m.id}`,
      y: year,
      stage: st.stage,
      label: m.name,
      field,
      time: timeOf(m.scheduledTime),
      scheduledTime: m.scheduledTime ?? null,
      red, blue,
      rs: played ? m.redScore : null,
      bs: played ? m.blueScore : null,
      _climbRed: m.details ? [m.details.redRobotOneBraceState, m.details.redRobotTwoBraceState, m.details.redRobotThreeBraceState] : null,
      _climbBlue: m.details ? [m.details.redRobotOneBraceState, m.details.redRobotTwoBraceState, m.details.redRobotThreeBraceState] : null,
      // El desglose es específico de cada juego: sin mapa por temporada solo va el total.
      breakdown: breakdownOf(year, m),
      // `video` = enlace exacto del partido (con el segundo de inicio). `stream` = enlace
      // del campo, que es la reserva cuando no hay vídeo exacto. Sin ninguno de los dos
      // el partido no tiene nada que enlazar, y es un estado: el botón ▶ no se pinta.
      video,
      stream,
    };
  });
}

function breakdownOf(year, m) {
  if (!m.details) return [];

  if (year === 2026) {
    const d = m.details;
    const rSupp = d.wildfireInRedSuppressionUnit || 0;
    const bSupp = d.wildfireInBlueSuppressionUnit || 0;
    const rMult = d.redClimbMultiplier || 1.0;
    const bMult = d.blueClimbMultiplier || 1.0;
    const ext = d.wildfireInExtinguisher || 0;
    const coop = d.coopertition || 0;
    const knock = d.coopertitionKnockdownBonus || 0;
    const rPart = d.redPartnerClimbPoints || 0;
    const bPart = d.bluePartnerClimbPoints || 0;

    return [
      ['Suppression Unit', rSupp, bSupp],
      ['Climb Multiplier', `x${rMult.toFixed(2)}`, `x${bMult.toFixed(2)}`],
      ['Multiplied Suppression', Math.ceil(rSupp * rMult), Math.ceil(bSupp * bMult)],
      ['Partner Climb', rPart, bPart],
      ['Extinguisher (Global)', ext, ext],
      ['Coopertition (Global)', coop, coop],
      ['Knockdown (Global)', knock, knock],
    ];
  }

  const map = readJson(`manual/breakdown.${year}.json`);
  if (!map) return [];
  return Object.entries(map)
    .filter(([field]) => m.details[field] !== undefined)
    .map(([field, spec]) => [spec.label, m.details[field]?.[0] ?? null, m.details[field]?.[1] ?? null]);
}

// ---------------------------------------------------------------- rankings
//
// El CSV manda para TODAS las temporadas, incluidas 2024-2025: la API no devuelve
// todos los criterios de desempate y además cambian cada año. Las columnas que siguen
// a `rank` son las de esa competición, en su orden, y sus etiquetas legibles viven en
// data/raw/manual/rankings.labels.json (mismo criterio que breakdown.{year}.json).
//
// Wins/Losses/Ties no son una columna más: alimentan la columna fija W-L-T. Solo 2019
// los trae en el CSV; en 2024-2025 se derivan de los partidos, como ya se hacía con
// `avg`. Donde no hay ni columnas ni partidos quedan ausentes, y la columna no se
// pinta: la regla 6 pide declarar el hueco, no rellenarlo con un 0.

/** Filas de ranking de la API. Ya NO son la fuente de los números: se conservan solo
 *  por su efecto sobre `displayNames`, porque traen el nombre largo del país
 *  ("Team United States of America") que el roster no tiene. */
function apiRankings(snapshot, matches) {
  const scored = {};
  for (const m of matches) {
    if (m.stage !== 'ranking' || m.rs === null) continue;
    for (const c of m.red) (scored[c] ??= []).push(m.rs);
    for (const c of m.blue) (scored[c] ??= []).push(m.bs);
  }
  return (snapshot.rankings ?? []).map((r) => {
    const team = canon(r.team?.country);
    if (!team) return null; // hay filas sin equipo (p. ej. 2024, rank 181)
    rememberName(team, r.team.name);
    const scores = scored[team] ?? [];
    const pts = scores.reduce((a, b) => a + b, 0);
    return {code: team, rank: r.rank, avg: scores.length ? Number((pts / scores.length).toFixed(1)) : null};
  }).filter(Boolean);
}

/** W-L-T y puntuación media derivados de los partidos de clasificación, por equipo.
 *  Un empate no entra en el promedio (ver `mg` en pages.js): cuenta en W-L-T, no en avg. */
function matchStats(year, matches, allCodes) {
  const st = {};
  if (year === 2026 && allCodes) {
    for (const c of allCodes) {
      st[c] = {w: 0, l: 0, t: 0, n: 0, pts: 0, scores: [], highest: 0, climbTotal: 0, climbCount: 0};
    }
  }
  for (const m of matches) {
    if (m.stage !== 'ranking' || m.rs === null) continue;
    for (const [own_side, own, other, climbs] of [[m.red, m.rs, m.bs, m._climbRed], [m.blue, m.bs, m.rs, m._climbBlue]]) {
      own_side.forEach((c, idx) => {
        const z = (st[c] ??= {w: 0, l: 0, t: 0, n: 0, pts: 0, scores: [], highest: 0, climbTotal: 0, climbCount: 0});
        z.n++; z.pts += own; z.scores.push(own);
        if (own > z.highest) z.highest = own;
        if (own > other) z.w++; else if (own < other) z.l++; else z.t++;
        if (climbs && climbs[idx] !== undefined) {
          z.climbTotal += (climbs[idx] || 0);
          z.climbCount++;
        }
      });
    }
  }
  for (const z of Object.values(st)) z.avg = z.scores.length ? Number((z.pts / z.scores.length).toFixed(1)) : null;
  return st;
}

/** Wins/Losses/Ties del CSV no se pintan como columna: son la columna fija W-L-T. */
const WLT_COL = {Wins: 'w', Losses: 'l', Ties: 't'};

/** S[y][] desde manual/{year}/rankings.csv. `stats` (2024-2025) rellena W-L-T y avg. */
function rankingsFromCsv(year, stats) {
  return readCsv(`manual/${year}/rankings.csv`).map((r, i) => {
    const n = i + 2;
    const code = canon(r.team_code), rank = Number(r.rank);
    check(codes.has(code), `rankings.csv ${year} (fila ${n}): "${r.team_code}" fuera del roster${code !== r.team_code ? ` (resuelto a "${code}")` : ''}`);
    check(Number.isInteger(rank), `rankings.csv ${year} (fila ${n}): puesto inválido "${r.rank}"`);
    const row = {code, rank, cols: []};
    for (const [col, v] of Object.entries(r)) {
      if (col === 'year' || col === 'team_code' || col === 'rank') continue;
      const num = Number(v);
      check(v !== '' && Number.isFinite(num), `rankings.csv ${year} (fila ${n}): "${col}" no es un número ("${v}")`);
      if (WLT_COL[col]) { row[WLT_COL[col]] = num; continue; }
      const label = RANK_LABELS[col];
      check(!!label, `rankings.csv ${year}: la columna "${col}" no tiene etiqueta — añádela a data/raw/manual/rankings.labels.json`);
      row.cols.push([label ?? col, num]);
    }
    const s = stats[code];
    if (s) {
      row.w ??= s.w; row.l ??= s.l; row.t ??= s.t; row.n ??= s.n; row.avg = s.avg;
    }
    if (row.w !== undefined && row.n === undefined) row.n = row.w + row.l + row.t;
    return row;
  }).sort((a, b) => a.rank - b.rank);
}

/** Columnas del ranking de una temporada viva, en el orden de la tabla. */
const COLS_LIVE = ['Ranking score', 'Highest points', 'Climb points', 'Played'];

/** Filas de una temporada viva, que todavía no tiene ranking publicado. NO se calcula
 *  nada: la API devuelve `rankings: []` y ningún partido jugado, así que fabricar la
 *  tabla producía una fila por equipo con todo a 0 y puestos inventados por orden
 *  alfabético. Se emite una fila por equipo INSCRITO —los que aparecen en el calendario,
 *  que son exactamente los que rankea la API— con el hueco declarado: `rank` y las celdas
 *  a null, que la plantilla pinta como «No data» (regla 6); así el HTML ya trae nombre,
 *  código y bandera. El overlay en vivo (site/brand/live.js) rellena esas filas con el
 *  ranking de la API; nunca crea ninguna. Los equipos del roster que no compiten no
 *  entran: una lista de ranking no es la plantilla de inscritos. */
function pendingRankings(matches) {
  return [...new Set(matches.flatMap((m) => [...m.red, ...m.blue]))]
    .sort((a, b) => (teams[a]?.name ?? a).localeCompare(teams[b]?.name ?? b, 'en') || a.localeCompare(b, 'en'))
    .map((code) => ({
      code,
      rank: null,
      cols: COLS_LIVE.map((label) => [label, null]),
      // La columna W-L-T existe para esta temporada aunque el récord no se sepa todavía:
      // `w` presente y a null es lo que la mantiene en `hasWlt` (null !== undefined).
      w: null, l: null, t: null
    }));
}

/** Equipos de una temporada: el total que muestra una página de temporada (el de la
 *  historia completa no significa nada ahí). Se usa el número de equipos rankeados,
 *  que es el campo oficial (2024: 180, 2025: 181).
 *  Ojo: en 2025 JAM y CMR jugaron round robin y finales pero la API no les da fila de
 *  ranking, así que el número de equipos que pisaron la cancha es 183. Si se prefiere
 *  ese criterio, contar la unión de participantes de partidos y rankings. */
const teamsIn = (matches, rankings) =>
  rankings.length || new Set(matches.flatMap((m) => [...m.red, ...m.blue])).size;

// ---------------------------------------------------------------- alianzas

/** AL[y] = alianzas de playoffs ordenadas por número: el índice + 1 es la alianza.
 *  Son las del round robin, de las que salen los finalistas. */
function buildAlliances(snapshot) {
  return (snapshot.alliances_round_robin ?? [])
    .slice()
    .sort((a, b) => a.captain.allianceRank - b.captain.allianceRank)
    .map((a) => [a.captain, a.pick1, a.pick2, a.pick3].filter(Boolean).map((m) => {
      const c = canon(m.team.country);
      rememberName(c, m.team.name);
      return c;
    }));
}

// ---------------------------------------------------------------- premios

/** ty: 'a' alianza (un tono para todos) · 'p' podio · 'n' sin lugar.
 *  La API no lo declara: se deduce. Solo los premios de alianza lo llevan en el nombre. */
const awardType = (a) => (/alliance/i.test(a.name) ? 'a' : a.gold || a.silver || a.bronze ? 'p' : 'n');

const TIER_SLOT = {gold: 'gold', silver: 'silver', bronze: 'bronze'};

// La API escribe el mismo premio de formas distintas según el año. Sin unificar, el
// overview los pinta como dos bloques y reparte a los ganadores entre ambos.
const AWARD_ALIASES = {
  'Al-Khwarizmi Award for Outstanding Supporter': 'Al Khwarizmi Award for Outstanding Supporter',
  'Outstanding Mentor': 'Outstanding Mentor Award',
};
const awardName = (n) => AWARD_ALIASES[n] ?? n;

/** El premio de alianza pone al capitán en el hueco de su tono (gold, silver o
 *  bronze, según el premio) y al resto de la alianza en `other[]` con esa `class`. */
function tierOfAward(a, ty) {
  if (ty !== 'a') return undefined;
  return a.other?.[0]?.class
    ?? (/gold/i.test(a.name) ? 'gold' : /silver/i.test(a.name) ? 'silver' : /bronze/i.test(a.name) ? 'bronze' : 'gold');
}

let unresolvedAwardEntries = 0;

// Un premio puede ir a una persona o a una institución, no a un equipo. La API adjunta a
// cada destinatario su país —el del mentor, el de la entidad— y `resolveTeam` lo convierte
// en esa selección, que acaba con una medalla que no ganó: Túnez sumaba cuatro por el
// premio al mentor y una por el de patrocinadores. Se descartan por evidencia del dato
// crudo, no por una lista de nombres escrita a mano:
//   · la entrada nombra al destinatario (`recipientName`) → es una persona o entidad;
//   · la descripción del premio dice a quién va («Awarded to an individual / mentors /
//     institutions, sponsors, or governments»). Hace falta además del `recipientName`
//     porque en 2018 y 2022 la API no nombró a nadie y dio solo el país.
// Los premios de equipo se declaran como tales («Awarded to teams…») y no entran aquí.
const NO_TEAM_DESC = /awarded to (?:an? )?(?:individual|mentors?|institutions?|sponsors?|governments?|young women)/i;
const isTeamAward = (a) => !NO_TEAM_DESC.test(a.description ?? '');
const isTeamEntry = (o) => !!o && !o.recipientName;
const nonTeamAwards = [];

function buildAwards(snapshot) {
  return (snapshot.awards ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .filter((a) => { if (isTeamAward(a)) return true; nonTeamAwards.push(a.name); return false; })
    .map((a) => {
      const ty = awardType(a);
      const code = (o) => {
        if (!isTeamEntry(o)) return null; // persona o entidad: no es un equipo
        const c = resolveTeam(o);
        if (!c) unresolvedAwardEntries++;
        return c;
      };
      const w = ty === 'a'
        ? [code(a[TIER_SLOT[tierOfAward(a, ty)]]), ...(a.other ?? []).map(code)]
        : ty === 'p'
          ? [code(a.gold), code(a.silver), code(a.bronze)]
          : [...(a.other ?? []).map(code), code(a.gold)];
      return {name: awardName(a.name), desc: a.description ?? '', ty, tier: tierOfAward(a, ty), w: w.filter(Boolean)};
    });
}

/** Catálogo AW: la unión de todos los años, en el orden del año más reciente.
 *  Forma [name, desc, ty] o [name, desc, ty, tier] — igual que el fixture. */
function buildCatalogue(byYear) {
  const seen = new Map();
  for (const y of [...ALL_YEARS].sort((a, b) => b - a)) {
    for (const a of byYear[y]?.awards ?? []) if (!seen.has(a.name)) seen.set(a.name, a);
  }
  return [...seen.values()].map((a) => (a.tier ? [a.name, a.desc, a.ty, a.tier] : [a.name, a.desc, a.ty]));
}

// ---------------------------------------------------------------- montaje

const perYear = {};
for (const y of ALL_YEARS) {
  const snapshot = readJson(`api/${y}.json`) ?? die(`Falta data/raw/api/${y}.json — ejecuta node scripts/fetch-archive.js`);
  const full = FULL_YEARS.includes(y);
  const matches = full ? buildMatches(y, snapshot) : [];
  perYear[y] = {
    matches,
    rankings: [], // se rellena en la sección de validación, cuando ya existen `codes`/`check`
    alliances: full ? buildAlliances(snapshot) : [],
    awards: buildAwards(snapshot),
  };
  // De la API solo se conservan los nombres largos de país (efecto sobre displayNames);
  // los números de ranking salen del CSV. Ver `apiRankings`.
  if (full) apiRankings(snapshot, matches);
}

const teams = {}, flags = {};
for (const t of roster) {
  teams[t.country] = {name: displayNames[t.country] ?? t.name.replace(/^Team /, ''), continent: continentOf[t.country] ?? ''};
  // El repositorio de banderas del proyecto está indexado por alpha-2 (`mx`), no por
  // alpha-3 (`mex`). El equipo de refugiados no tiene país: su asset es `10_hope`.
  flags[t.country] = t.countryCode;
}

// El roster de la API son selecciones nacionales; teams.csv puede añadir equipos que
// la API no lista. Hoy son los seis continentales de 2017-2018, que la competición
// codifica 11..16 — el mismo número que el asset de bandera (`14_europe` y compañía).
// Sin esto no tendrían página, bandera ni enlace desde la tabla de rankings.
const EXTRA_FLAG = {'11': '11_south-america', '12': '12_oceania', '13': '13_north-america', '14': '14_europe', '15': '15_asia', '16': '16_africa'};
for (const r of readCsv('manual/teams.csv')) {
  const c = r.team_code;
  if (!c || teams[c]) continue;
  teams[c] = {name: r.name, continent: r.continent ?? ''};
  // 15_asia y 16_africa todavía no existen: el build dibuja su marcador gris.
  flags[c] = EXTRA_FLAG[c] ?? c;
}

// Los países anfitriones no siempre fieldan equipo, así que pueden faltar del roster
// (EAU, Suiza y Grecia no están) y su bandera no resolvería. Se completan desde el
// listado ISO, que sí trae el alpha-2 de todos los países. `isoList` se lee arriba,
// junto al puente de códigos.
if (isoList) {
  const byAlpha3 = Object.fromEntries(isoList.map((c) => [String(c['alpha-3']).toUpperCase(), String(c['alpha-2']).toLowerCase()]));
  for (const s of seasons) {
    const k = (s.iso || '').toUpperCase();
    if (k && !flags[k] && byAlpha3[k]) flags[k] = byAlpha3[k];
  }
}

// ---------------------------------------------------------------- validación

const codes = new Set(Object.keys(teams));
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const streamMismatches = [];

// Rankings: el CSV es la fuente para las temporadas archivadas (2024-2025 incluidas), y
// sus criterios de desempate cambian cada año. La temporada viva es la excepción: su
// ranking lo publica la API, así que aquí solo se emiten las filas con el hueco declarado.
// Se construyen aquí porque `rankingsFromCsv` valida contra `codes` y usa `check`.
const RANK_LABELS = readJson('manual/rankings.labels.json') ?? {};
const statsByYear = {};
const modeOf = Object.fromEntries(seasons.map((s) => [s.y, s.mode]));
for (const [y, d] of Object.entries(perYear)) {
  const year = Number(y);
  const stats = matchStats(year, d.matches, codes);
  statsByYear[year] = stats;
  d.rankings = modeOf[year] === 'live' ? pendingRankings(d.matches) : rankingsFromCsv(year, stats);

  const seen = new Set(), ranks = new Set();
  let colCount = null;
  for (const r of d.rankings) {
    check(!seen.has(r.code), `${year}: ranking duplicado de ${r.code}`);
    seen.add(r.code);
    colCount ??= r.cols.length;
    check(r.cols.length === colCount, `${year}: ${r.code} trae ${r.cols.length} columnas y el resto ${colCount}`);
    // Una temporada viva puede no tener puestos todavía (`rank: null`): se comprueba la
    // forma y, cuando la API los publique, también la contigüidad 1..N sobre los que sí
    // los tienen.
    if (r.rank === null) continue;
    check(!ranks.has(r.rank), `${year}: puesto ${r.rank} repetido`);
    ranks.add(r.rank);
  }
  for (let i = 1; i <= ranks.size; i++) check(ranks.has(i), `${year}: falta el puesto ${i} (${ranks.size} filas)`);

  // Vídeos: cada entrada del extractor tiene que apuntar a un partido que exista. Si la
  // numeración del extractor se desplazara, sin esta comprobación la temporada se
  // publicaría sin un solo vídeo y nadie se enteraría.
  const byId = new Map(d.matches.map((m) => [m.id, m]));
  for (const [n, e] of exactByYear[year]?.map ?? []) {
    check(byId.has(`${year}_q${n}`), `${year}.json: la entrada ${e.entry} apunta al partido ${year}_q${n}, que no existe`);
  }
  // Y el cruce que delata un mapeo de días roto: el vídeo exacto de un partido tiene que
  // ser el stream que streams.csv declara para SU día y SU campo. No es un error fatal
  // —el vídeo exacto se publica igual, es el bueno—, pero sí la señal de que uno de los
  // dos archivos está mal, así que se avisa.
  for (const m of d.matches) {
    if (!m.video || !m.stream) continue;
    const exactId = YT_ID.exec(m.video)?.[1], streamId = YT_ID.exec(m.stream)?.[1];
    if (exactId && streamId && exactId !== streamId) streamMismatches.push(`${m.id} (${m.field})`);
  }
}

// El roster manda: es el código que ve quien rellena teams.csv y el de las URLs.
// Total de equipos por temporada, para las páginas de temporada. Se calcula DESPUÉS de
// los rankings: hasta que el CSV no entra, 2017-2023 contaban 0 equipos. En 2020-2021
// no hay ni rankings ni partidos (competición virtual), así que el número lo aporta
// seasons.csv a mano; sin él, esas dos temporadas se quedan en «No data».
for (const s of seasons) {
  const d = perYear[s.y];
  s.teams = s.teamsRaw !== '' ? Number(s.teamsRaw) : d ? teamsIn(d.matches, d.rankings) : 0;
  delete s.teamsRaw;
}

for (const [y, d] of Object.entries(perYear)) {
  const ids = new Set();
  for (const m of d.matches) {
    check(!ids.has(m.id), `${y}: match_id duplicado ${m.id}`);
    ids.add(m.id);
    check(STAGE_NAMES.includes(m.stage), `${y}: stage inválido en ${m.id}`);
    for (const c of [...m.red, ...m.blue]) check(codes.has(c), `${y}: ${m.id} referencia ${c}, fuera del roster`);
    check((m.rs === null) === (m.bs === null), `${y}: ${m.id} con un marcador y el otro vacío`);
    check(m.red.length === m.blue.length, `${y}: ${m.id} con alianzas de distinto tamaño`);
    check(m.red.length === (m.stage === 'ranking' ? 3 : 4),
      `${y}: ${m.id} (${m.stage}) con ${m.red.length} equipos por alianza`);
  }
  for (const r of d.rankings) check(codes.has(r.code), `${y}: ranking de ${r.code}, fuera del roster`);
  const nums = new Set();
  for (const a of d.alliances) {
    check(a.length === 4, `${y}: alianza de ${a.length} equipos, se esperan 4`);
    for (const c of a) check(codes.has(c), `${y}: alianza con ${c}, fuera del roster`);
    check(!nums.has(a.join()), `${y}: alianza duplicada`); nums.add(a.join());
  }
  for (const a of d.awards) for (const c of a.w) check(codes.has(c), `${y}: premio "${a.name}" con ${c}, fuera del roster`);
}

// ---------------------------------------------------------------- fotos
//
// Una foto por equipo Y temporada: los integrantes cambian cada año, así que la
// imagen es del equipo de ESA edición, no del equipo en general (spec §8 y §9).
// Se falla en voz alta, no se descarta la fila como con reveal_video: aquí la fila
// es una afirmación explícita de que esa URL es la foto, y descartarla en silencio
// dejaría un marcador vacío sin que nadie se enterara.
const photos = {};
const photoYears = new Set(seasons.map((s) => s.y));
const seenPhotos = new Set();
for (const [i, r] of readCsv('manual/photos.csv').entries()) {
  const n = i + 2; // +1 por la cabecera, +1 porque el índice empieza en 0
  const y = Number(r.year), raw = r.team_code, c = canon(raw), u = (r.photo_url ?? '').trim();
  const dup = `${y}|${c}`;
  const ok = Number.isInteger(y) && photoYears.has(y) && codes.has(c) && HTTP_URL.test(u) && !seenPhotos.has(dup);
  check(Number.isInteger(y) && photoYears.has(y), `photos.csv (fila ${n}): año inválido "${r.year}"`);
  check(codes.has(c), `photos.csv (fila ${n}): "${raw || '(vacío)'}" fuera del roster${c !== raw ? ` (resuelto a "${c}")` : ''}`);
  check(HTTP_URL.test(u), `photos.csv (fila ${n}): URL vacía o sin http(s) — "${r.photo_url ?? ''}"`);
  check(!seenPhotos.has(dup), `photos.csv (fila ${n}): ${c} ${y} repetido — hay dos filas para el mismo equipo y año`);
  seenPhotos.add(dup);
  if (ok) (photos[y] ??= {})[c] = u;
}

if (unresolvedAwardEntries) {
  console.warn(`aviso: ${unresolvedAwardEntries} destinatario(s) de premio sin país resoluble — se omiten`);
}

// Se lista lo descartado para que la regla sea auditable: si la API añade un premio a
// personas sin que su descripción lo diga, se verá aquí en vez de colarse como medalla.
if (nonTeamAwards.length) {
  const names = [...new Set(nonTeamAwards)];
  console.log(`premios no dirigidos a equipos (personas o instituciones), omitidos: ` +
    `${names.length} — ${names.join(' · ')}`);
}

if (streamMismatches.length) {
  console.warn(`aviso: ${streamMismatches.length} partido(s) cuyo vídeo exacto no es el stream declarado para su día y campo — ` +
    `revisa streams.csv o el mapeo de días: ${streamMismatches.slice(0, 5).join(' · ')}`);
}

if (problems.length) {
  console.error(`\n${problems.length} problema(s):`);
  problems.slice(0, 20).forEach((p) => console.error('  · ' + p));
  if (problems.length > 20) console.error(`  … y ${problems.length - 20} más`);
  process.exit(1);
}

// ---------------------------------------------------------------- escritura

const header = {schemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), generator: 'scripts/normalize.js'};
const write = (rel, data) => {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(f, JSON.stringify({...header, data}, null, 1), 'utf8');
};

fs.rmSync(OUT, {recursive: true, force: true});
write('seasons.json', seasons);
write('teams.json', teams);
write('flags.json', flags);
write('photos.json', photos);
write('awards.json', buildCatalogue(perYear));
for (const [y, d] of Object.entries(perYear)) {
  if (streamsByYear[y]) write(`${y}/streams.json`, streamsByYear[y]);
  write(`${y}/matches.json`, d.matches);
  write(`${y}/rankings.json`, d.rankings);
  write(`${y}/alliances.json`, d.alliances);
  write(`${y}/awards.json`, d.awards);
}

console.log(`data/processed/ — ${seasons.length} temporadas, ${codes.size} equipos, ${seenPhotos.size} fotos`);
for (const y of ALL_YEARS) {
  const d = perYear[y];
  const withVideo = d.matches.filter((m) => m.video).length, withStream = d.matches.filter((m) => m.stream).length;
  const vids = d.matches.length ? ` — ${withVideo} con vídeo exacto, ${withStream} con enlace del campo` : '';
  console.log(`  ${y}: ${d.matches.length} partidos, ${d.rankings.length} rankings, ${d.alliances.length} alianzas, ${d.awards.length} premios${vids}`);
}
console.log('siguiente paso: node site/build.js');
