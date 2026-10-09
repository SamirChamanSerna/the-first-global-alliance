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
      _climbRed: m.details ? [m.details.redRobotOneBraceState, m.details.redRobotTwoBraceState, m.details.redRobotThreeBraceState] : null,
      _climbBlue: m.details ? [m.details.blueRobotOneBraceState, m.details.blueRobotTwoBraceState, m.details.blueRobotThreeBraceState] : null,
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
  const matchStats = {};
  matches.forEach(m => {
    if (!m.played || m.rs === null) return;
    if (!m.id.includes('_q')) return;
    const processSide = (side, own, other, climbs) => {
      side.forEach((c, idx) => {
        const z = matchStats[c] ??= {w: 0, l: 0, t: 0, n: 0, pts: 0, highest: 0, climbTotal: 0, climbCount: 0};
        z.n++; z.pts += own;
        if (own > z.highest) z.highest = own;
        if (own > other) z.w++; else if (own < other) z.l++; else z.t++;
        if (climbs && climbs[idx] !== undefined) {
           z.climbTotal += (climbs[idx] || 0);
           z.climbCount++;
        }
      });
    };
    processSide(m.red, m.rs, m.bs, m._climbRed);
    processSide(m.blue, m.bs, m.rs, m._climbBlue);
  });
  const rankings = Object.entries(matchStats).map(([code, s]) => {
    return {
      code, totalScore: s.pts, highestScore: s.highest,
      avgClimb: s.climbCount ? Number((s.climbTotal / s.climbCount).toFixed(2)) : 0,
      w: s.w, l: s.l, t: s.t
    };
  });
  rankings.sort((a, b) => b.totalScore - a.totalScore || b.highestScore - a.highestScore || b.avgClimb - a.avgClimb || a.code.localeCompare(b.code));
  rankings.forEach((r, i) => r.rank = i + 1);

  const payload = {
    season: 2026,
    updatedAt: new Date().toISOString(),
    matchesCount: matches.length,
    playedCount: matches.filter((m) => m.played).length,
    matches,
    rankings
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
