const fs = require('fs');

// 1. UPDATE poll-live.js
let poll = fs.readFileSync('scripts/poll-live.js', 'utf8');
poll = poll.replace('excludeMatchDetails=true', 'excludeMatchDetails=false');
poll = poll.replace(/blue: side\(21, 24\)\r?\n\s+\};\r?\n\s+\}\);/,
lue: side(21, 24),
      _climbRed: m.details ? [m.details.redRobotOneBraceState, m.details.redRobotTwoBraceState, m.details.redRobotThreeBraceState] : null,
      _climbBlue: m.details ? [m.details.blueRobotOneBraceState, m.details.blueRobotTwoBraceState, m.details.blueRobotThreeBraceState] : null,
    };
  }););

poll = poll.replace(/const rankings = \(data\.rankings \|\| \[\]\)\.map\(\(r\) => \(\{[\s\S]*?\}\)\);/, 
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
  rankings.forEach((r, i) => r.rank = i + 1););
fs.writeFileSync('scripts/poll-live.js', poll);

// 2. UPDATE site/brand/live.js
let live = fs.readFileSync('site/brand/live.js', 'utf8');
live = live.replace(/if \(cells\[0\]\) cells\[0\]\.textContent = r\.rank;\s*if \(cells\[2\]\) cells\[2\]\.textContent = r\.rp;\s*if \(cells\[3\]\) cells\[3\]\.textContent = \\$\{r\.w\}[^]+\;/,
if (cells[0]) cells[0].textContent = r.rank;
                  if (cells[2]) cells[2].textContent = r.totalScore;
                  if (cells[3]) cells[3].textContent = r.highestScore;
                  if (cells[4]) cells[4].textContent = r.avgClimb;
                  if (cells[5]) cells[5].textContent = \\\\\\–\\\–\\\\\\;);

live = live.replace(/}\r?\n\s*}\);\r?\n\s*}\r?\n\s*}\r?\n\s*}\r?\n\s*} catch/,
}
              });
              const rows = Array.from(tbody.querySelectorAll('tr'));
              rows.sort((a, b) => (parseInt(a.cells[0]?.textContent, 10)||999) - (parseInt(b.cells[0]?.textContent, 10)||999));
              rows.forEach(row => tbody.appendChild(row));
            }
          }
        }
      } catch);
fs.writeFileSync('site/brand/live.js', live);
console.log('Restored live scripts!');
