// El ranking lo publica la API ya calculado y con sus desempates aplicados, así que el
// worker no recalcula nada: reenvía data.rankings tal cual. Reimplementar la media de los
// mejores partidos era justo el bug (sumaba todos los partidos jugados).
// `excludeMatchDetails=false` es necesario para el desglose (`bd`) de cada partido.
// La temporada viva se configura en wrangler.jsonc (`vars.SEASON_YEAR`). El
// Worker no lee el repositorio: este es el único sitio donde se cambia el año.
const apiUrl = (year) => `https://api.first.global/v1?year=${year}&excludeMatchDetails=false`;

const STAGES = {
  t2: { stage: 'ranking', letter: 'q' },
  t3: { stage: 'round_robin', letter: 'rr' },
  t4: { stage: 'finals', letter: 'f' }
};

async function fetchAndProcessLive(env) {
  const year = Number(env?.SEASON_YEAR) || 2026;
  const res = await fetch(apiUrl(year));
  if (!res.ok) return null;
  const data = await res.json();

  const matches = (data.matches || []).map((m) => {
    const st = STAGES[m.tournamentKey] || { letter: 'q', stage: 'ranking' };
    const side = (lo, hi) =>
      (m.participants || [])
        .filter((p) => p.station >= lo && p.station <= hi)
        .sort((a, b) => a.station - b.station)
        .map((p) => p.country);

    return {
      id: `${year}_${st.letter}${m.id}`,
      played: !!m.played,
      rs: m.played ? m.redScore : null,
      bs: m.played ? m.blueScore : null,
      ast: m.actualStartTime || null,
      red: side(11, 14),
      blue: side(21, 24),
      // Desglose matemático del partido, solo si ya se jugó. Este bloque es el de
      // 2026: al empezar otra temporada hay que actualizarlo junto a
      // data/raw/manual/breakdown/{year}.json y al gemelo scripts/poll-live.js.
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
  // para localizar la fila por su bandera (ver docs/api-notes.md).
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

  // Standings de la fase en curso (`round_robin`), reenviados tal cual los publica la API.
  // Son filas POR EQUIPO —las cuatro de una alianza repiten el mismo rank/rankingScore/
  // played— y el cliente las coloca en la tabla de alianzas cruzando por alpha-2, que es
  // el nombre del archivo de bandera de cada celda de equipo (ver docs/api-notes.md).
  // `wins/losses/ties` y `highestScore` llegan a 0 con 4 partidos jugados: no son dato.
  const roundRobin = (data.round_robin || []).map((r) => ({
    code: r.team?.country ?? null,
    countryCode: r.team?.countryCode ?? null,
    rank: r.rank,
    rankingScore: r.rankingScore,
    played: r.played
  }));

  const payload = {
    season: year,
    updatedAt: new Date().toISOString(),
    matchesCount: matches.length,
    playedCount: matches.filter((m) => m.played).length,
    matches,
    rankings,
    roundRobin
  };

  return JSON.stringify(payload);
}

export default {
  async scheduled(event, env, ctx) {
    try {
      const jsonStr = await fetchAndProcessLive(env);
      if (jsonStr) await env.LIVE_DATA.put('live_json', jsonStr);
    } catch (err) {
      // Deja rastro en `wrangler tail`; el último snapshot válido sigue en KV.
      console.error('live worker:', err);
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/live.json') {
      const liveJson = await env.LIVE_DATA.get('live_json');
      return new Response(liveJson || '{}', {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=15'
        }
      });
    }
    return new Response('Not Found', { status: 404 });
  }
};
