// node scripts/make-manual-templates.js
//
// Creates the empty CSV templates for hand-entered data.
// Schema, keys and column meanings: docs/discovery/06-join-keys.md
//
// Idempotent: an existing file is NEVER overwritten, so templates can be
// re-generated at any time without touching data someone already filled in.
// Exit code is 0 even when everything already exists.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'data', 'raw', 'manual');
const API = 'https://api.first.global';

// Years whose match/ranking/alliance data must be entered by hand:
// 2020 and 2021 had no physical competition (awards only), 2024-2025 come
// from the API, 2026 is live.
const MANUAL_YEARS = [2017, 2018, 2019, 2022, 2023];

// year → mode. archived | live | awards-only
const SEASONS = [
  [2017, 'archived'], [2018, 'archived'], [2019, 'archived'],
  [2020, 'awards-only'], [2021, 'awards-only'],
  [2022, 'archived'], [2023, 'archived'],
  [2024, 'archived'], [2025, 'archived'],
  [2026, 'live'],
];

const HEADERS = {
  // `name` es el nombre del JUEGO de esa temporada (p. ej. "Eco Equilibrium"), no el
  // del evento. `iso` es el alpha-3 del país anfitrión, que es lo que resuelve la
  // bandera. `reveal_video` es la URL del video de revelación.
  seasons: 'year,name,city,country,iso,dates,reveal_video,mode,teams',
  videos: 'match_id,video_url,start,end',
  teams: 'team_code,name,continent,website,instagram,twitter,facebook,contact',
  photos: 'year,team_code,photo_url',
  matches: 'year,id,stage,label,scheduled_time,field,red_1,red_2,red_3,red_4,blue_1,blue_2,blue_3,blue_4,red_score,blue_score,video_url',
  // El ranking de cada temporada puntúa cosas distintas (2017 no es como 2025), así que
  // la plantilla solo fija las tres columnas clave: los criterios de desempate se añaden
  // a mano después de `rank`, en el orden de esa competición, y su etiqueta legible va a
  // rankings.labels.json. El normalizador falla si falta alguna etiqueta.
  rankings: 'year,team_code,rank',
  alliances: 'year,stage,alliance_number,captain,pick1,pick2,pick3',
};

// Una celda vacía por columna, para que `mode` caiga en su sitio y no desplace el resto.
const row = (cells) => cells.map(cell).join(',');
// `teams` se deja vacío: normalmente el número de equipos se deriva de los rankeados.
// Solo se rellena en las temporadas donde no hay ni rankings ni partidos (2020-2021).
const seasonsCsv = () =>
  [HEADERS.seasons, ...SEASONS.map(([y, mode]) => row([y, '', '', '', '', '', '', mode, '']))].join('\n') + '\n';

/** RFC 4180: quote a cell when it holds a comma, a quote or a newline. */
const cell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * The team roster comes from the API, so the owner fills in continent/social
 * against a list that is guaranteed to use the canonical ISO alpha-3 codes.
 * `name` is a read-only reference column so a code is never mis-filled.
 * Photos are NOT here: they are per (team, year) and live in photos.csv.
 */
async function teamsCsv() {
  const res = await fetch(`${API}/v1/teams`);
  if (!res.ok) throw new Error(`GET /v1/teams → HTTP ${res.status}`);
  const teams = await res.json();
  const rows = teams
    .map((t) => ({ code: t.country, name: t.name }))
    .sort((a, b) => a.code.localeCompare(b.code))
    // 6 empty columns: continent, website, instagram, twitter, facebook, contact
    .map((t) => [cell(t.code), cell(t.name), ...Array(6).fill('')].join(','));
  return [HEADERS.teams, ...rows].join('\n') + '\n';
}

const templates = new Map([
  [path.join(DIR, 'seasons.csv'), seasonsCsv()],
  [path.join(DIR, 'videos.csv'), HEADERS.videos + '\n'],
  [path.join(DIR, 'photos.csv'), HEADERS.photos + '\n'],
  [path.join(DIR, 'teams.csv'), await teamsCsv()],
]);

for (const y of MANUAL_YEARS) {
  templates.set(path.join(DIR, String(y), 'matches.csv'), HEADERS.matches + '\n');
  templates.set(path.join(DIR, String(y), 'rankings.csv'), HEADERS.rankings + '\n');
  templates.set(path.join(DIR, String(y), 'alliances.csv'), HEADERS.alliances + '\n');
}

let created = 0;
let kept = 0;
for (const [file, content] of templates) {
  if (fs.existsSync(file)) {
    kept++;
    continue;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  created++;
}

console.log(`${created} templates created, ${kept} left untouched (already existed)`);
