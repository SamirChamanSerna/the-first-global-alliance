// El ranking lo publica la API ya calculado y con sus desempates aplicados, así que el
// worker no recalcula nada: reenvía data.rankings tal cual. Reimplementar la media de los
// mejores partidos era justo el bug (sumaba todos los partidos jugados).
// `excludeMatchDetails=false` es necesario para el desglose (`bd`) de cada partido.
const API = 'https://api.first.global/v1?year=2026&excludeMatchDetails=false';

const STAGES = {
  t2: { stage: 'ranking', letter: 'q' },
  t3: { stage: 'round_robin', letter: 'rr' },
  t4: { stage: 'finals', letter: 'f' }
};

async function fetchAndProcessLive() {
  const res = await fetch(API);
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

  const payload = {
    season: 2026,
    updatedAt: new Date().toISOString(),
    matchesCount: matches.length,
    playedCount: matches.filter((m) => m.played).length,
    matches,
    rankings
  };

  return JSON.stringify(payload);
}

export default {
  async scheduled(event, env, ctx) {
    const jsonStr = await fetchAndProcessLive();
    if (jsonStr) {
      await env.LIVE_DATA.put('live_json', jsonStr);
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
