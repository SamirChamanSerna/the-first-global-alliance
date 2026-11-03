// node scripts/normalize.js
//
// data/raw/ → data/processed/  (la forma que consume site/templates/data.js)
//
// A partir de ahora TODO se lee en JSON. Cada temporada tiene un snapshot con la
// misma forma que /v1?year=YYYY:
//   · 2023-2026: data/raw/api/{year}.json, descargado de la API.
//   · 2017-2022: data/raw/manual/snapshots/{year}.json, generado desde la fuente
//     manual porque la API no es fiable para esas temporadas.
// El resto de entradas manuales (metadatos, fotos, rankings, desgloses, streams,
// premios) vive en data/raw/manual/ como JSON. Ver data/raw/manual/README.md.
//
// Reglas:
//   · team_code = ISO alpha-3 del roster. NUNCA teamKey: cambia cada año.
//   · Un dato ausente se omite; nunca se escribe 0 ni "". El hueco lo cubre la
//     plantilla con su estado vacío explícito.
//   · La validación falla en voz alta: mejor romper el build que publicar una celda mal.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readSnapshots, buildAliases} from './lib/codes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw');
const OUT = path.join(ROOT, 'data', 'processed');

const SCHEMA_VERSION = 2;
const STAGES = {t2: {stage: 'ranking', letter: 'q'}, t3: {stage: 'round_robin', letter: 'rr'}, t4: {stage: 'finals', letter: 'f'}};
const STAGE_NAMES = ['ranking', 'round_robin', 'finals'];
const HTTP_URL = /^https?:\/\//i;
const YT_ID = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/;

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const die = (msg) => { throw new Error(msg); };

const readJson = (rel) => {
  const f = path.join(RAW, rel);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};
const has = (rel) => fs.existsSync(path.join(RAW, rel));

// ---------------------------------------------------------------- roster y códigos

const apiRoster = readJson('api/teams.json') ?? die('Falta data/raw/api/teams.json — ejecuta node scripts/fetch-archive.js');
const isoList = readJson('api/iso-regions.json');
const a3toA2 = Object.fromEntries((isoList ?? []).map((c) => [String(c['alpha-3']).toUpperCase(), String(c['alpha-2']).toLowerCase()]));
const rosterByA2 = Object.fromEntries(apiRoster.map((t) => [String(t.countryCode).toLowerCase().split('_')[0], t.country]));
// Los códigos de la competición no son los del roster (HPE/10, ATG/ANT…). El
// alpha-2 es el único puente fiable; ver scripts/lib/codes.js.
const alias = buildAliases(apiRoster, readSnapshots(path.join(RAW, 'api')));
const canonApi = (c) => (c ? alias[c] ?? rosterByA2[a3toA2[String(c).toUpperCase()]] ?? c : c);

const manualTeams = readJson('manual/teams.json') ?? die('Falta data/raw/manual/teams.json');

const teams = {};
const flags = {};
const codes = new Set(Object.keys(manualTeams));
for (const [code, t] of Object.entries(manualTeams)) {
  teams[code] = {name: t.name, continent: t.continent ?? ''};
  flags[code] = t.countryCode ?? code;
}

// Los premios identifican países por nombre y alpha-2 (nunca por alpha-3).
const a2key = (v) => String(v ?? '').toUpperCase().split('_')[0];
const nameKey = (v) => String(v ?? '').replace(/[`']/g, '’').toLowerCase();
const byAlpha2 = {}, byNumeric = {}, byName = {};
for (const [code, t] of Object.entries(manualTeams)) {
  const key = a2key(t.countryCode);
  if (/^[A-Z]{2}$/.test(key)) byAlpha2[key] = code;
  byNumeric[key] = code;
  byName[nameKey(t.name)] = code;
}
const resolveTeam = (o) => {
  if (!o) return null;
  const key = a2key(o.countryCode);
  return byAlpha2[key] ?? byNumeric[key] ?? byName[nameKey(o.country)] ?? null;
};

// ---------------------------------------------------------------- temporadas

const rawSeasons = readJson('manual/seasons.json') ?? die('Falta data/raw/manual/seasons.json');
const seasons = rawSeasons
  .map((s) => ({
    y: Number(s.year),
    name: s.name ?? '',
    city: s.city ?? '',
    country: s.country ?? '',
    iso: s.iso ?? '',
    dates: s.dates ?? '',
    reveal: HTTP_URL.test((s.revealVideo ?? '').trim()) ? s.revealVideo.trim() : '',
    mode: s.mode || 'archived',
    // `source` dice de dónde sale el snapshot: API real o fuente manual.
    source: s.source === 'api' ? 'api' : 'manual',
    teamsRaw: s.teams ?? null,
  }))
  .sort((a, b) => b.y - a.y);

for (const s of seasons) {
  if (!Number.isInteger(s.y)) die(`seasons.json: año inválido "${s.y}"`);
  if (!['archived', 'live', 'awards-only'].includes(s.mode)) die(`seasons.json: mode inválido "${s.mode}" (${s.y})`);
  if (!['api', 'manual'].includes(s.source)) die(`seasons.json: source inválido "${s.source}" (${s.y})`);
  if (s.teamsRaw !== null && (!Number.isInteger(s.teamsRaw) || s.teamsRaw < 0)) {
    die(`seasons.json: teams inválido en ${s.y} ("${s.teamsRaw}") — déjalo en null o escribe un entero`);
  }
}
const yearSet = new Set(seasons.map((s) => s.y));
check(yearSet.size === seasons.length, 'seasons.json: año repetido');

// Las banderas de los países anfitriones que no fieldan equipo se completan desde
// el listado ISO; sin esto la bandera de la sede no resuelve.
if (isoList) {
  for (const s of seasons) {
    const k = (s.iso || '').toUpperCase();
    if (k && !flags[k] && a3toA2[k]) flags[k] = a3toA2[k];
  }
}

// ---------------------------------------------------------------- mapas por temporada

const fieldMaps = {};
const breakdownMaps = {};
for (const s of seasons) {
  fieldMaps[s.y] = readJson(`manual/rankings/${s.y}.json`);
  breakdownMaps[s.y] = readJson(`manual/breakdown/${s.y}.json`);
}

// ---------------------------------------------------------------- streams y vídeos

function readStreams(year) {
  const raw = readJson(`manual/streams/${year}.json`);
  if (!raw) return null;
  check(raw.year === year, `streams/${year}.json: el año es "${raw.year}"`);
  const days = (raw.days ?? []).map((d) => {
    const fields = {};
    for (const [field, s] of Object.entries(d.fields ?? {})) {
      const n = Number(field.replace(/[^0-9]/g, ''));
      const url = (s?.url ?? '').trim();
      check(Number.isInteger(n) && n >= 1 && n <= 5, `streams/${year}.json: campo inválido "${field}"`);
      check(HTTP_URL.test(url) && YT_ID.test(url), `streams/${year}.json: URL de YouTube inválida — "${url}"`);
      const id = YT_ID.exec(url)?.[1];
      if (id) fields[`Field ${n}`] = {id, url};
    }
    return {day: Number(d.day), fields};
  }).sort((a, b) => a.day - b.day);
  check(days.length > 0, `streams/${year}.json: no tiene días`);
  const latest = days.length ? Math.max(...days.map((d) => d.day)) : null;
  return {year, latest, days};
}

const streamsByYear = {};
for (const s of seasons) {
  const st = readStreams(s.y);
  if (st) streamsByYear[s.y] = st;
}

/** Vídeo exacto por partido, desde la salida del extractor. Se ignoran las
 *  detecciones sin equipos: no hay nada con lo que unirlas a un partido. */
function readExactVideos(year) {
  const raw = readJson(`manual/videos/${year}.json`);
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

const exactByYear = {};
for (const s of seasons) {
  const e = readExactVideos(s.y);
  if (e) exactByYear[s.y] = e;
}
for (const e of Object.values(exactByYear)) {
  if (e.unusable) console.log(`aviso: ${e.unusable} entrada(s) de videos/${e.year}.json sin partido al que unirse — se omiten`);
}

// ---------------------------------------------------------------- partidos

/** Día de competición = posición de la fecha entre las que aparecen en el snapshot. */
const daysOf = (matches) => {
  const dates = [...new Set(matches.map((m) => (m.scheduledTime ?? '').slice(0, 10)).filter(Boolean))].sort();
  return new Map(dates.map((d, i) => [d, i + 1]));
};

/** Hora local del evento, tal como la declara la API ("...T11:15:00-05:00" → "11:15"). */
const timeOf = (iso) => {
  const m = /T(\d{2}):(\d{2})/.exec(iso ?? '');
  return m ? `${m[1]}:${m[2]}` : '';
};

function formatValue(v, format) {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  switch (format) {
    case 'multiplier': return `x${n.toFixed(2)}`;
    case 'ceil': return Math.ceil(n);
    case 'fixed2': return n.toFixed(2);
    case 'percent': return `${Math.round(n * 100)}%`;
    default: return v;
  }
}

/** Filas del desglose de UNA temporada, según data/raw/manual/breakdown/{year}.json.
 *  La API publica campos escalares separados (redX/blueX), no tuplas [rojo, azul],
 *  así que el mapa declara el par, los globales y el formato de cada fila. */
function breakdownOf(year, m) {
  const map = breakdownMaps[year];
  if (!map || !m.details) return [];
  const d = m.details;
  return (map.rows ?? []).map((row) => {
    if (!m.played) return [row.label, '-', '-'];
    let red, blue;
    if (row.global) {
      const v = formatValue(d[row.global], row.format);
      red = row.column === 'blue' ? '-' : v;
      blue = row.column === 'red' ? '-' : v;
    } else {
      let rv = d[row.red], bv = d[row.blue];
      if (row.multiply) {
        rv = (rv ?? 0) * (d[row.multiply.red] ?? 1);
        bv = (bv ?? 0) * (d[row.multiply.blue] ?? 1);
      }
      red = formatValue(rv, row.format);
      blue = formatValue(bv, row.format);
    }
    return [row.label, red, blue];
  });
}

function buildMatches(year, snapshot) {
  const days = daysOf(snapshot.matches ?? []);
  const streams = streamsByYear[year];
  const exact = exactByYear[year]?.map ?? new Map();
  const canon = canonApi;
  return (snapshot.matches ?? []).map((m) => {
    const st = STAGES[m.tournamentKey] ?? die(`Año ${year}: tournamentKey desconocido "${m.tournamentKey}"`);
    const side = (lo, hi) => (m.participants ?? [])
      .filter((p) => p.station >= lo && p.station <= hi)
      .sort((a, b) => a.station - b.station)
      .map((p) => canon(p.country));
    const red = side(11, 14), blue = side(21, 24);
    if (!red.length || !blue.length) die(`Año ${year}: partido ${m.id} sin equipos`);
    const played = m.played === undefined ? true : !!m.played;
    const field = m.field === undefined || m.field === null ? '' : `Field ${m.field}`;
    const day = days.get((m.scheduledTime ?? '').slice(0, 10));
    const stream = streams?.days.find((d) => d.day === day)?.fields[field]?.url ?? null;
    const video = st.stage === 'ranking' ? exact.get(m.id)?.url ?? null : null;
    const details = m.details ?? null;
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
      _climbRed: details ? [details.redRobotOneBraceState, details.redRobotTwoBraceState, details.redRobotThreeBraceState] : null,
      _climbBlue: details ? [details.blueRobotOneBraceState, details.blueRobotTwoBraceState, details.blueRobotThreeBraceState] : null,
      breakdown: breakdownOf(year, m),
      video,
      stream,
    };
  });
}

// ---------------------------------------------------------------- rankings

/** W-L-T y puntuación media derivados de los partidos de clasificación. */
function matchStats(matches) {
  const st = {};
  for (const m of matches) {
    if (m.stage !== 'ranking' || m.rs === null) continue;
    for (const [side, own, other, climbs] of [[m.red, m.rs, m.bs, m._climbRed], [m.blue, m.bs, m.rs, m._climbBlue]]) {
      side.forEach((c, idx) => {
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

/** Filas de ranking desde el snapshot, con las columnas que declara el mapa. */
function rankingsFromSnapshot(year, snapshot, stats) {
  const rows = snapshot.rankings ?? [];
  if (!rows.length) return [];
  const map = fieldMaps[year] ?? die(`Falta data/raw/manual/rankings/${year}.json`);
  const out = [];
  for (const r of rows) {
    const raw = r.team?.country ?? null;
    // Algunas temporadas traen una fila de ranking sin equipo (2024, rank 181).
    if (!raw) continue;
    const code = canonApi(String(raw));
    check(codes.has(code), `${year}: ranking de ${raw} (${code}), fuera del roster`);
    const rank = Number(r.rank);
    check(Number.isInteger(rank), `${year}: puesto inválido "${r.rank}" (${code})`);
    const row = {code, rank, cols: map.fields.map((f) => [f.label, r[f.field] ?? null])};
    const s = stats[code];
    if (s) {
      row.w = s.w; row.l = s.l; row.t = s.t; row.n = s.n; row.avg = s.avg;
    } else if (r.wins != null || r.losses != null || r.ties != null) {
      row.w = r.wins ?? 0; row.l = r.losses ?? 0; row.t = r.ties ?? 0; row.n = row.w + row.l + row.t;
    }
    out.push(row);
  }
  return out.sort((a, b) => a.rank - b.rank);
}

/** Filas de una temporada viva, todavía sin ranking publicado: una fila por equipo
 *  inscrito, con el hueco declarado. El overlay de live.js las rellena; nunca crea filas. */
function pendingRankings(year, matches) {
  const labels = fieldMaps[year]?.fields.map((f) => f.label) ?? ['Ranking score', 'Highest points', 'Played'];
  return [...new Set(matches.flatMap((m) => [...m.red, ...m.blue]))]
    .sort((a, b) => (teams[a]?.name ?? a).localeCompare(teams[b]?.name ?? b, 'en') || a.localeCompare(b, 'en'))
    .map((code) => ({
      code,
      rank: null,
      cols: labels.map((label) => [label, null]),
      w: null, l: null, t: null,
    }));
}

// ---------------------------------------------------------------- alianzas

const allianceMismatches = [];

function buildAlliances(snapshot) {
  const canon = canonApi;
  const standing = new Map();
  for (const r of snapshot.round_robin ?? []) if (r.team?.country) standing.set(canon(r.team.country), r);
  return (snapshot.alliances_round_robin ?? [])
    .slice()
    .sort((a, b) => a.captain.allianceRank - b.captain.allianceRank)
    .map((a) => {
      const teamsInAlliance = [a.captain, a.pick1, a.pick2, a.pick3].filter(Boolean).map((m) => canon(m.team.country));
      const rows = teamsInAlliance.map((c) => standing.get(c)).filter(Boolean);
      const s = rows[0];
      if (s && rows.some((r) => r.rank !== s.rank)) {
        allianceMismatches.push(`${a.name ?? teamsInAlliance[0]} (${rows.map((r) => r.rank).join('/')})`);
      }
      return {
        teams: teamsInAlliance,
        rank: s?.rank || null,
        score: s ? s.rankingScore : null,
        played: s ? s.played : null,
      };
    });
}

// ---------------------------------------------------------------- premios

const awardType = (a) => (/alliance/i.test(a.name) ? 'a' : a.gold || a.silver || a.bronze ? 'p' : 'n');
const TIER_SLOT = {gold: 'gold', silver: 'silver', bronze: 'bronze'};
const AWARD_ALIASES = {
  'Al-Khwarizmi Award for Outstanding Supporter': 'Al Khwarizmi Award for Outstanding Supporter',
  'Outstanding Mentor': 'Outstanding Mentor Award',
  // La API cambia el nombre del mismo premio entre temporadas. Sin unificarlo, el
  // catálogo de Insights parte los equipos en varios bloques y cada uno parece
  // pequeño: p. ej. «Winning Alliance Award» y «… - Gold» son el mismo premio.
  'FIRST Global Winning Alliance Award': 'FIRST Global Winning Alliance Award - Gold',
  'FIRST Global Finalist Alliance - Runner Up': 'FIRST Global Finalist Alliance - Silver',
  'FIRST Global Finalist Alliance - Second Runner Up': 'FIRST Global Finalist Alliance - Bronze',
  'International Enthusiasm Award': 'Jackie Bezos Award for International Enthusiasm',
  'Judges Award - Technical': 'Judges Award',
  'Judges Award - Non-Technical': 'Judges Award',
  'FIRST Global Innovator Award': 'FIRST Global Innovator Award, in honor of Fred Smith',
};
const awardName = (n) => AWARD_ALIASES[n] ?? n;

function tierOfAward(a, ty) {
  if (ty !== 'a') return undefined;
  return a.other?.[0]?.class
    ?? (/gold/i.test(a.name) ? 'gold' : /silver/i.test(a.name) ? 'silver' : /bronze/i.test(a.name) ? 'bronze' : 'gold');
}

let unresolvedAwardEntries = 0;
const NO_TEAM_DESC = /awarded to (?:an? )?(?:individual|mentors?|institutions?|sponsors?|governments?|young women)/i;
const isTeamAward = (a) => !NO_TEAM_DESC.test(a.description ?? '');
const isTeamEntry = (o) => !!o && !o.recipientName;
const nonTeamAwards = [];

/** Premios de la API → contrato del sitio. Se descartan los que van a personas o
 *  instituciones: no son medallas de equipo. */
function buildAwards(snapshot) {
  return (snapshot.awards ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .filter((a) => { if (isTeamAward(a)) return true; nonTeamAwards.push(a.name); return false; })
    .map((a) => {
      const ty = awardType(a);
      const code = (o) => {
        if (!isTeamEntry(o)) return null;
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

/** Premios manuales (2020, 2021, 2026) → contrato del sitio. El esquema manual
 *  conserva los premios individuales y de mentoría, pero el sitio solo pinta
 *  equipos: se muestran sin ganadores y no suman medallas. */
const manualAwardWarnings = [];
function buildManualAwards(year) {
  const raw = readJson(`manual/awards/${year}.json`) ?? [];
  // Los premios manuales usan códigos ISO alpha-3 (ZWE, PHL…) o los del roster.
  // El puente alpha-2 de canonApi los lleva al código canónico del sitio.
  const code = (c) => (c ? canonApi(String(c)) : null);
  const teamList = (a) => (a.teams ?? []).map(code).filter(Boolean);
  return raw
    // Mismo criterio que los premios de la API: los que van a personas o
    // instituciones no son medallas de equipo y no se publican.
    .filter((a) => a.type !== 'individual' && a.type !== 'mentorship' && !NO_TEAM_DESC.test(a.description ?? ''))
    .map((a) => {
      const base = {name: a.award, desc: a.description ?? ''};
      // Las alianzas de 2021 no tienen tono (ganan por categoría): se pintan como
      // premio concedido, no con una medalla inventada.
      if (a.type === 'alliance') return {...base, ty: 'a', tier: a.tier || 'awarded', w: teamList(a)};
      if (a.type === 'podium') {
        const w = [a.winners?.gold, a.winners?.silver, a.winners?.bronze].map(code).filter(Boolean);
        if (w.length !== 3) manualAwardWarnings.push(`${year}: "${a.award}" no tiene oro, plata y bronce`);
        return {...base, ty: 'p', w};
      }
      if (a.type === 'non-tiered') return {...base, ty: 'n', w: teamList(a)};
      manualAwardWarnings.push(`${year}: "${a.award}" tiene un tipo desconocido ("${a.type}")`);
      return {...base, ty: 'n', w: []};
    });
}

/** Catálogo AW: la unión de todos los años, en el orden del año más reciente. */
function buildCatalogue(byYear) {
  const seen = new Map();
  for (const y of [...yearSet].sort((a, b) => b - a)) {
    for (const a of byYear[y]?.awards ?? []) if (!seen.has(a.name)) seen.set(a.name, a);
  }
  return [...seen.values()].map((a) => (a.tier ? [a.name, a.desc, a.ty, a.tier] : [a.name, a.desc, a.ty]));
}

// ---------------------------------------------------------------- montaje por temporada

const perYear = {};
for (const s of seasons) {
  const snapshot = readJson(s.source === 'api' ? `api/${s.y}.json` : `manual/snapshots/${s.y}.json`)
    ?? die(`Falta el snapshot de ${s.y} (${s.source})`);
  const matches = buildMatches(s.y, snapshot);
  const stats = matchStats(matches);
  const rankings = s.mode === 'live' ? pendingRankings(s.y, matches) : rankingsFromSnapshot(s.y, snapshot, stats);
  perYear[s.y] = {
    matches,
    rankings,
    alliances: buildAlliances(snapshot),
    awards: has(`manual/awards/${s.y}.json`) ? buildManualAwards(s.y) : buildAwards(snapshot),
  };
}

// ---------------------------------------------------------------- validación

for (const s of seasons) {
  const d = perYear[s.y];
  const seen = new Set(), ranks = new Set();
  let colCount = null;
  for (const r of d.rankings) {
    check(!seen.has(r.code), `${s.y}: ranking duplicado de ${r.code}`);
    seen.add(r.code);
    colCount ??= r.cols.length;
    check(r.cols.length === colCount, `${s.y}: ${r.code} trae ${r.cols.length} columnas y el resto ${colCount}`);
    if (r.rank === null) continue;
    check(!ranks.has(r.rank), `${s.y}: puesto ${r.rank} repetido`);
    ranks.add(r.rank);
  }
  for (let i = 1; i <= ranks.size; i++) check(ranks.has(i), `${s.y}: falta el puesto ${i} (${ranks.size} filas)`);

  const ids = new Set();
  for (const m of d.matches) {
    check(!ids.has(m.id), `${s.y}: match_id duplicado ${m.id}`);
    ids.add(m.id);
    check(STAGE_NAMES.includes(m.stage), `${s.y}: stage inválido en ${m.id}`);
    for (const c of [...m.red, ...m.blue]) check(codes.has(c), `${s.y}: ${m.id} referencia ${c}, fuera del roster`);
    check((m.rs === null) === (m.bs === null), `${s.y}: ${m.id} con un marcador y el otro vacío`);
    check(m.red.length === m.blue.length, `${s.y}: ${m.id} con alianzas de distinto tamaño`);
    check(m.red.length === (m.stage === 'ranking' ? 3 : 4), `${s.y}: ${m.id} (${m.stage}) con ${m.red.length} equipos por alianza`);
  }
  for (const r of d.rankings) check(codes.has(r.code), `${s.y}: ranking de ${r.code}, fuera del roster`);
  for (const a of d.alliances) {
    check(a.teams.length === 4, `${s.y}: alianza de ${a.teams.length} equipos, se esperan 4`);
    for (const c of a.teams) check(codes.has(c), `${s.y}: alianza con ${c}, fuera del roster`);
  }
  for (const a of d.awards) for (const c of a.w) check(codes.has(c), `${s.y}: premio "${a.name}" con ${c}, fuera del roster`);

  // Cada entrada del extractor tiene que apuntar a un partido que exista.
  const byId = new Map(d.matches.map((m) => [m.id, m]));
  for (const [n, e] of exactByYear[s.y]?.map ?? []) {
    check(byId.has(`${s.y}_q${n}`), `videos/${s.y}.json: la entrada ${e.entry} apunta a ${s.y}_q${n}, que no existe`);
  }
  // El vídeo exacto de un partido debe ser el stream de SU día y SU campo.
  for (const m of d.matches) {
    if (!m.video || !m.stream) continue;
    const exactId = YT_ID.exec(m.video)?.[1], streamId = YT_ID.exec(m.stream)?.[1];
    if (exactId && streamId && exactId !== streamId) {
      check(false, `${s.y}: ${m.id} (${m.field}) tiene un vídeo que no es el stream de su día y campo`);
    }
  }
}

// ---------------------------------------------------------------- fotos

const photos = {};
let photoCount = 0;
for (const [year, byTeam] of Object.entries(readJson('manual/photos.json') ?? {})) {
  const y = Number(year);
  check(yearSet.has(y), `photos.json: año inválido "${year}"`);
  for (const [rawCode, url] of Object.entries(byTeam)) {
    const code = canonApi(rawCode);
    photoCount++;
    check(codes.has(code), `photos.json: "${rawCode}" (${code}) fuera del roster (${year})`);
    check(HTTP_URL.test(String(url)), `photos.json: URL vacía o sin http(s) — ${rawCode} ${year}`);
    check(!photos[y]?.[code], `photos.json: ${code} ${y} repetido`);
    (photos[y] ??= {})[code] = url;
  }
}

// ---------------------------------------------------------------- avisos

if (unresolvedAwardEntries) console.warn(`aviso: ${unresolvedAwardEntries} destinatario(s) de premio sin país resoluble — se omiten`);
if (nonTeamAwards.length) {
  const names = [...new Set(nonTeamAwards)];
  console.log(`premios no dirigidos a equipos (personas o instituciones), omitidos: ${names.length} — ${names.join(' · ')}`);
}
for (const w of manualAwardWarnings) console.warn(`aviso: ${w}`);
if (allianceMismatches.length) {
  console.warn(`aviso: ${allianceMismatches.length} alianza(s) cuyos equipos traen puestos distintos en round_robin — ` +
    `se usa el del primero: ${allianceMismatches.slice(0, 5).join(' · ')}`);
}

if (problems.length) {
  console.error(`\n${problems.length} problema(s):`);
  problems.slice(0, 20).forEach((p) => console.error('  · ' + p));
  if (problems.length > 20) console.error(`  … y ${problems.length - 20} más`);
  process.exit(1);
}

// ---------------------------------------------------------------- números de temporada

for (const s of seasons) {
  const d = perYear[s.y];
  s.teams = s.teamsRaw !== null ? s.teamsRaw : d.rankings.length || new Set(d.matches.flatMap((m) => [...m.red, ...m.blue])).size;
  delete s.teamsRaw;
}

// ---------------------------------------------------------------- escritura

const header = {schemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), generator: 'scripts/normalize.js'};
const write = (rel, data) => {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(f, JSON.stringify({...header, data}, null, 1), 'utf8');
};

fs.rmSync(OUT, {recursive: true, force: true});
write('seasons.json', seasons.map((s) => ({
  y: s.y, name: s.name, city: s.city, country: s.country, iso: s.iso, dates: s.dates,
  reveal: s.reveal, mode: s.mode, teams: s.teams,
})));
write('teams.json', teams);
write('flags.json', flags);
write('photos.json', photos);
write('awards.json', buildCatalogue(perYear));
write('playlists.json', readJson('manual/playlists.json') ?? {});
for (const [y, d] of Object.entries(perYear)) {
  if (streamsByYear[y]) write(`${y}/streams.json`, streamsByYear[y]);
  write(`${y}/matches.json`, d.matches);
  write(`${y}/rankings.json`, d.rankings);
  write(`${y}/alliances.json`, d.alliances);
  write(`${y}/awards.json`, d.awards);
}

console.log(`data/processed/ — ${seasons.length} temporadas, ${codes.size} equipos, ${photoCount} fotos`);
for (const s of seasons) {
  const d = perYear[s.y];
  const withVideo = d.matches.filter((m) => m.video).length, withStream = d.matches.filter((m) => m.stream).length;
  const vids = d.matches.length ? ` — ${withVideo} con vídeo exacto, ${withStream} con enlace del campo` : '';
  console.log(`  ${s.y}: ${d.matches.length} partidos, ${d.rankings.length} rankings, ${d.alliances.length} alianzas, ${d.awards.length} premios${vids}`);
}
console.log('siguiente paso: node site/build.js');
