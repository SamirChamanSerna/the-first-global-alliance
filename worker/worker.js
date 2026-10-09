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
      _climbRed: m.details ? [m.details.redRobotOneBraceState, m.details.redRobotTwoBraceState, m.details.redRobotThreeBraceState] : null,
      _climbBlue: m.details ? [m.details.blueRobotOneBraceState, m.details.blueRobotTwoBraceState, m.details.blueRobotThreeBraceState] : null,
      // NUEVO: Se extrae el desglose matemático si el partido ya se jugó
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
      code,
      totalScore: s.pts,
      highestScore: s.highest,
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