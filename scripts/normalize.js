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
const FULL_YEARS = [2024, 2025];
const AWARDS_YEARS = [2017, 2018, 2019, 2022, 2023];
const ALL_YEARS = [...new Set([...FULL_YEARS, ...AWARDS_YEARS])].sort((a, b) => a - b);
const STAGES = {t2: {stage: 'ranking', letter: 'q'}, t3: {stage: 'round_robin', letter: 'rr'}, t4: {stage: 'finals', letter: 'f'}};
const STAGE_NAMES = ['ranking', 'round_robin', 'finals'];

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
const canon = (c) => (c ? alias[c] ?? c : c);

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
  .map((r) => ({y: Number(r.year), name: r.name, city: r.city, country: r.country, iso: r.iso, dates: r.dates, mode: r.mode || 'archived'}))
  .sort((a, b) => b.y - a.y); // más reciente primero: es el orden que espera el sitio
for (const s of seasons) {
  if (!Number.isInteger(s.y)) die(`seasons.csv: año inválido "${s.y}"`);
  if (!['archived', 'live', 'awards-only'].includes(s.mode)) die(`seasons.csv: mode inválido "${s.mode}" (fila ${s.y})`);
}

const continentOf = Object.fromEntries(readCsv('manual/teams.csv').map((r) => [r.team_code, r.continent]));

// Nombre para mostrar: la API da "Team Mexico" en el roster y "Mexico" en los
// rankings. Se prefiere el primero que aparezca en un ranking.
const displayNames = {};
const rememberName = (code, name) => {
  if (!code || !name || displayNames[code]) return;
  displayNames[code] = String(name).replace(/^Team /, '').trim();
};

// ---------------------------------------------------------------- partidos

/** Hora local del evento, tal como la declara la API ("...T11:15:00-05:00" → "11:15").
 *  Se lee de la cadena a propósito: new Date() la convertiría a la zona de quien compila. */
const timeOf = (iso) => {
  const m = /T(\d{2}):(\d{2})/.exec(iso ?? '');
  return m ? `${m[1]}:${m[2]}` : '';
};

function buildMatches(year, snapshot) {
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
    return {
      id: `${year}_${st.letter}${m.id}`,
      y: year,
      stage: st.stage,
      label: m.name,
      field: m.field === undefined ? '' : `Field ${m.field}`,
      time: timeOf(m.scheduledTime),
      red, blue,
      rs: played ? m.redScore : null,
      bs: played ? m.blueScore : null,
      // El desglose es específico de cada juego: sin mapa por temporada solo va el total.
      breakdown: breakdownOf(year, m),
      video: false, // los enlaces de video son manuales (data/raw/manual/videos.csv)
    };
  });
}

/** Mapa por temporada {campo: {label, side}} — ver 03-raw-data-standard.md.
 *  Sin mapa no hay filas de detalle y el desglose muestra solo el total. */
function breakdownOf(year, m) {
  const map = readJson(`manual/breakdown.${year}.json`);
  if (!map || !m.details) return [];
  return Object.entries(map)
    .filter(([field]) => m.details[field] !== undefined)
    .map(([field, spec]) => ({label: spec.label, red: m.details[field]?.[0] ?? null, blue: m.details[field]?.[1] ?? null}));
}

// ---------------------------------------------------------------- rankings

function buildRankings(year, snapshot, matches) {
  const scored = {};
  for (const m of matches) {
    if (m.stage !== 'ranking' || m.rs === null) continue;
    for (const c of m.red) (scored[c] ??= []).push(m.rs);
    for (const c of m.blue) (scored[c] ??= []).push(m.bs);
  }
  // La API devuelve los rankings en orden de teamKey (≈ alfabético). El sitio los
  // muestra tal cual, así que se ordenan aquí por puesto.
  return (snapshot.rankings ?? []).map((r) => {
    const team = canon(r.team?.country);
    if (!team) return null; // hay filas sin equipo (p. ej. 2024, rank 181)
    rememberName(team, r.team.name);
    // `pts` y `avg` no vienen en la API: se derivan de los marcadores de los partidos.
    const scores = scored[team] ?? [];
    const pts = scores.reduce((a, b) => a + b, 0);
    return {
      code: team, rank: r.rank,
      w: r.wins, l: r.losses, t: r.ties, n: r.played,
      pts,
      rp: r.rankingScore,
      avg: scores.length ? Number((pts / scores.length).toFixed(1)) : null,
    };
  }).filter(Boolean).sort((a, b) => a.rank - b.rank);
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

function buildAwards(snapshot) {
  return (snapshot.awards ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((a) => {
      const ty = awardType(a);
      const code = (o) => { const c = resolveTeam(o); if (o && !c) unresolvedAwardEntries++; return c; };
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
    rankings: full ? buildRankings(y, snapshot, matches) : [],
    alliances: full ? buildAlliances(snapshot) : [],
    awards: buildAwards(snapshot),
  };
}

// El roster manda: es el código que ve quien rellena teams.csv y el de las URLs.
// Total de equipos por temporada, para las páginas de temporada.
for (const s of seasons) {
  const d = perYear[s.y];
  s.teams = d ? teamsIn(d.matches, d.rankings) : 0;
}

const teams = {}, flags = {};
for (const t of roster) {
  teams[t.country] = {name: displayNames[t.country] ?? t.name.replace(/^Team /, ''), continent: continentOf[t.country] ?? ''};
  // El repositorio de banderas del proyecto está indexado por alpha-2 (`mx`), no por
  // alpha-3 (`mex`). El equipo de refugiados no tiene país: su asset es `10_hope`.
  flags[t.country] = t.countryCode;
}

// ---------------------------------------------------------------- validación

const codes = new Set(Object.keys(teams));
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

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

if (unresolvedAwardEntries) {
  console.warn(`aviso: ${unresolvedAwardEntries} destinatario(s) de premio sin país resoluble ` +
    '(p. ej. el premio al mentor se otorga a personas, no a equipos) — se omiten');
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
write('awards.json', buildCatalogue(perYear));
for (const [y, d] of Object.entries(perYear)) {
  write(`${y}/matches.json`, d.matches);
  write(`${y}/rankings.json`, d.rankings);
  write(`${y}/alliances.json`, d.alliances);
  write(`${y}/awards.json`, d.awards);
}

console.log(`data/processed/ — ${seasons.length} temporadas, ${codes.size} equipos`);
for (const y of ALL_YEARS) {
  const d = perYear[y];
  console.log(`  ${y}: ${d.matches.length} partidos, ${d.rankings.length} rankings, ${d.alliances.length} alianzas, ${d.awards.length} premios`);
}
console.log('siguiente paso: node site/build.js');
