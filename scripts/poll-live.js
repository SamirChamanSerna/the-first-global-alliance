// scripts/poll-live.js
// Poller de datos en vivo para la temporada 2026.
//
// Descarga el snapshot de api.first.global/v1?year=2026 y genera un `live.json`
// (30-40 KB: 340 partidos + 185 rankings) en `site/dist/live.json` que el cliente
// puede consultar sin saturar la API oficial. El ranking lo publica la API ya
// calculado, así que aquí no se recalcula nada.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_LIVE = path.join(ROOT, 'site', 'dist', 'live.json');
const PROCESSED_LIVE = path.join(ROOT, 'data', 'processed', 'live.json');
const API = 'https://api.first.global/v1?year=2026&excludeMatchDetails=false';

const STAGES = {
  t2: { stage: 'ranking', letter: 'q' },
  t3: { stage: 'round_robin', letter: 'rr' },
  t4: { stage: 'finals', letter: 'f' }
};

export async function fetchLiveSnapshot() {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`HTTP ${res.status} al consultar ${API}`);
  const data = await res.json();

  const matches = (data.matches || []).map((m) => {
    const st = STAGES[m.tournamentKey] || { letter: 'q', stage: 'ranking' };
    const side = (lo, hi) =>
      (m.participants || [])
        .filter((p) => p.station >= lo && p.station <= hi)
        .sort((a, b) => a.station - b.station)
        .map((p) => p.country);

    return {
      id: `2026_${st.letter}${m.id}`,
      played: !!m.played,
      rs: m.played ? m.redScore : null,
      bs: m.played ? m.blueScore : null,
      ast: m.actualStartTime || null,
      red: side(11, 14),
      blue: side(21, 24),
      // Desglose matemático del partido, solo si ya se jugó.
      bd: (m.played && m.details) ? [
        [m.details.wildfireInRedSuppressionUnit || 0, m.details.wildfireInBlueSuppressionUnit || 0],
        ['x' + (m.details.redClimbMultiplier || 1).toFixed(2), 'x' + (m.details.blueClimbMultiplier || 1).toFixed(2)],
        [Math.ceil((m.details.wildfireInRedSuppressionUnit || 0) * (m.details.redClimbMultiplier || 1)), Math.ceil((m.details.wildfireInBlueSuppressionUnit || 0) * (m.details.blueClimbMultiplier || 1))],
        [m.details.redPartnerClimbPoints || 0, m.details.bluePartnerClimbPoints || 0],
        [m.details.wildfireInExtinguisher || 0, m.details.wildfireInExtinguisher || 0],
        [m.details.coopertition || 0, m.details.coopertition || 0],
        [m.details.coopertitionKnockdownBonus || 0, m.details.coopertitionKnockdownBonus || 0]
      ] : null
    };
  });

  // Pass-through del ranking. `code` es el alpha-3 de la API (HPE, ANT…), que NO es el del
  // roster; `countryCode` es el alpha-2, el único puente fiable, y es lo que usa el cliente
  // para localizar la fila por su bandera (ver docs/discovery/06-join-keys.md).
  const rankings = (data.rankings || []).map((r) => ({
    code: r.team?.country ?? null,
    countryCode: r.team?.countryCode ?? null,
    rank: r.rank,
    rankingScore: r.rankingScore,
    highestScore: r.highestScore,
    climbPoints: r.climbPoints,
    played: r.played,
    wins: r.wins,
    losses: r.losses,
    ties: r.ties
  }));

  // Igual que el worker (worker/worker.js, el gemelo de este archivo): los dos tienen que
  // emitir el mismo payload o el sitio se comporta distinto en local que en producción.
  const roundRobin = (data.round_robin || []).map((r) => ({
    code: r.team?.country ?? null,
    countryCode: r.team?.countryCode ?? null,
    rank: r.rank,
    rankingScore: r.rankingScore,
    played: r.played
  }));

  const payload = {
    season: 2026,
    updatedAt: new Date().toISOString(),
    matchesCount: matches.length,
    playedCount: matches.filter((m) => m.played).length,
    matches,
    rankings,
    roundRobin
  };

  const jsonStr = JSON.stringify(payload);
  if (fs.existsSync(path.dirname(DIST_LIVE))) {
    fs.writeFileSync(DIST_LIVE, jsonStr, 'utf8');
  }
  if (fs.existsSync(path.dirname(PROCESSED_LIVE))) {
    fs.writeFileSync(PROCESSED_LIVE, jsonStr, 'utf8');
  }

  return payload;
}

// Ejecución directa por CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const isLoop = process.argv.includes('--watch') || process.argv.includes('--loop');
  const delay = 45000;

  async function run() {
    try {
      const p = await fetchLiveSnapshot();
      console.log(`[${new Date().toLocaleTimeString()}] live.json actualizado: ${p.matchesCount} partidos (${p.playedCount} jugados), ${p.rankings.length} rankings.`);
    } catch (err) {
      console.error(`[${new Date().toLocaleTimeString()}] Error actualizando live.json:`, err.message);
    }
    if (isLoop) setTimeout(run, delay);
  }

  run();
}
