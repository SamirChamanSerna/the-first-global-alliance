// site/brand/live.js
// Live Overlay (temporada 2026).
// Convierte horarios a la hora local del cliente, calcula ETA, filtra países/canchas y consulta /live.json sin recargar.

(function () {
  function init() {
    // 0. Buscador global (en cabecera y página /search/)
    const navForm = document.querySelector('.nav form');
    const navInput = document.querySelector('.nav input[type="search"]');

    if (navForm && navInput) {
      navForm.addEventListener('submit', (e) => {
        const val = navInput.value.trim();
        if (!val) {
          e.preventDefault();
          return;
        }

        // Si es un año exacto (e.g. 2024, 2026), redirigir a esa temporada
        if (/^20\d{2}$/.test(val)) {
          e.preventDefault();
          const cssLink = document.querySelector('link[rel="stylesheet"]');
          const pre = cssLink ? cssLink.getAttribute('href').replace(/site\.css.*$/, '') : './';
          window.location.href = `${pre}insights/${val}/index.html`;
          return;
        }

        // Si coincide exactamente con un equipo en el DOM
        const cleanVal = val.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        const teamLink = Array.from(document.querySelectorAll('a[href*="/team/"]')).find((a) => {
          const tText = (a.textContent || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
          return tText === cleanVal || a.getAttribute('href').includes(`/team/${cleanVal}/`);
        });

        if (teamLink) {
          e.preventDefault();
          window.location.href = teamLink.getAttribute('href');
          return;
        }
      });
    }

    // Lógica específica para /search/
    const searchPageInput = document.getElementById('search-page-input');
    const searchResults = document.getElementById('search-results');
    if (searchPageInput && searchResults) {
      function filterSearch(term) {
        const q = (term || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
        const rows = document.querySelectorAll('#search-results table.dt tbody tr');
        let visible = 0;
        rows.forEach((row) => {
          if (!q) {
            row.hidden = false;
            visible++;
            return;
          }
          const text = (row.textContent || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
          const match = text.includes(q);
          row.hidden = !match;
          if (match) visible++;
        });

        let noMsg = document.getElementById('search-no-results');
        if (visible === 0 && q) {
          if (!noMsg) {
            noMsg = document.createElement('p');
            noMsg.id = 'search-no-results';
            noMsg.className = 'note';
            noMsg.textContent = 'No results found.';
            searchResults.appendChild(noMsg);
          }
          noMsg.hidden = false;
        } else if (noMsg) {
          noMsg.hidden = true;
        }
      }

      const params = new URLSearchParams(window.location.search);
      const q = params.get('q') || '';
      if (q) {
        searchPageInput.value = q;
        filterSearch(q);
      }

      searchPageInput.addEventListener('input', () => {
        const val = searchPageInput.value.trim();
        filterSearch(val);
        try {
          const url = new URL(window.location);
          if (val) url.searchParams.set('q', val);
          else url.searchParams.delete('q');
          window.history.replaceState({}, '', url);
        } catch {}
      });
    }

    // Comprobar si la página actual muestra contenido de la temporada 2026
    const is2026 =
      document.querySelector('[data-season="2026"]') ||
      document.querySelector('[data-match^="2026_"]') ||
      window.location.pathname.includes('/2026/') ||
      window.location.pathname.includes('/gameday/');

    if (!is2026) return;

    // Añadir distintivo LIVE en la barra de título si no existe ya
    const bar = document.querySelector('.bar');
    if (bar && !document.querySelector('.live-badge')) {
      const badge = document.createElement('span');
      badge.className = 'live-badge';
      badge.innerHTML = '● LIVE';
      badge.title = 'Live tournament updates active';
      bar.appendChild(badge);
    }

    // Determina la ruta relativa adecuada a live.json usando el enlace del CSS
    const cssLink = document.querySelector('link[rel="stylesheet"]');
    const liveUrl = cssLink ? cssLink.getAttribute('href').replace(/site\.css.*$/, 'live.json') : './live.json';

    // 1. Filtro en tiempo real por búsqueda de partidos y países (#match-filter)
    const filterInput = document.getElementById('match-filter');
    const clean = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

    if (filterInput) {
      filterInput.addEventListener('input', () => {
        const q = clean(filterInput.value.trim());
        const rows = document.querySelectorAll('.m');
        rows.forEach((row) => {
          if (!q) {
            row.hidden = false;
            return;
          }
          const teams = clean(row.dataset.teams);
          const field = clean(row.dataset.field);
          const text = clean(row.textContent);
          const match = teams.includes(q) || field.includes(q) || text.includes(q);
          row.hidden = !match;
        });
      });
    }

    // 2. Formato de ETA
    function formatEta(diffMs, inProgress) {
      if (inProgress) return '● In progress';
      if (diffMs <= -3600000) {
        return '';
      }
      if (diffMs <= 0) {
        return 'Starting soon';
      }
      const totalMinutes = Math.round(diffMs / 60000);
      if (totalMinutes === 0) {
        return 'Starting soon';
      }
      if (totalMinutes < 60) {
        return `ETA in ${totalMinutes}m`;
      }
      const hours = Math.floor(totalMinutes / 60);
      const remMinutes = totalMinutes % 60;
      if (remMinutes === 0) {
        return `ETA in ${hours}h`;
      }
      return `ETA in ${hours}h ${remMinutes}m`;
    }

    // 3. Cálculo dinámico de ETA y conversión a hora local del usuario
    function updateETAs() {
      const rows = document.querySelectorAll('.m[data-time]');
      const now = Date.now();
      const isKst = (new Date().getTimezoneOffset() === -540);

      rows.forEach((row) => {
        const rs = row.querySelector('.rs');
        const bs = row.querySelector('.bs');
        if (rs && bs && rs.textContent.trim() !== '–' && bs.textContent.trim() !== '–') return;

        const timeStr = row.dataset.time;
        if (!timeStr) return;
        const targetTime = new Date(timeStr);
        const targetMs = targetTime.getTime();
        if (isNaN(targetMs)) return;

        const diff = targetMs - now;
        const field = row.dataset.field || '';
        const clock = row.dataset.clock || '';

        const localTimeStr = targetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const inProgress = row.dataset.inProgress === 'true';
        const etaStr = formatEta(diff, inProgress);

        const timeLabel = (!isKst && clock)
          ? `${localTimeStr} local (${clock} KST)`
          : `${clock || localTimeStr} KST`;

        const parts = [
          etaStr ? `<b class="eta">${etaStr}</b>` : '',
          timeLabel,
          field
        ].filter(Boolean);

        const small = row.querySelector('.lb small');
        if (small) {
          small.innerHTML = parts.join(' · ');
        }
      });
    }

    // 4. Consulta periódica de /live.json
    async function update() {
      try {
        const res = await fetch(liveUrl, { cache: 'no-cache' });
        if (!res.ok) return;
        const data = await res.json();
        if (!data || !data.matches) return;

        const playedList = data.matches.filter((m) => m.played && m.rs !== null && m.bs !== null);
        const unplayedList = data.matches.filter((m) => !m.played || m.rs === null || m.bs === null);

        // Actualizar KPIs de partidos en Insights 2026
        const kpiComp = document.getElementById('kpi-completed');
        const kpiUpc = document.getElementById('kpi-upcoming');
        if (kpiComp) kpiComp.textContent = playedList.length;
        if (kpiUpc) kpiUpc.textContent = data.matches.length - playedList.length;

        const liveMatchList = document.getElementById('live-match-list');
        const completedMatchList = document.getElementById('completed-match-list');
        const completedSection = document.getElementById('completed-section');

        // Actualizar partidos (scores, win/lose y mover de Próximos a Completados)
        data.matches.forEach((m) => {
          const rows = document.querySelectorAll(`[data-match="${m.id}"]`);
          if (!m.played || m.rs === null || m.bs === null) {
            if (m.ast) {
              rows.forEach((row) => row.dataset.inProgress = 'true');
            }
            return;
          }
          rows.forEach((row) => {
            const rTone = m.rs === m.bs ? 'lose' : m.rs > m.bs ? 'win' : 'lose';
            const bTone = m.rs === m.bs ? 'lose' : m.bs > m.rs ? 'win' : 'lose';

            const ra = row.querySelector('.ra');
            const ba = row.querySelector('.ba');
            if (ra) ra.className = 'ra ' + rTone;
            if (ba) ba.className = 'ba ' + bTone;

            const rs = row.querySelector('.rs');
            const bs = row.querySelector('.bs');
            if (rs) {
              rs.className = 'rs ' + rTone;
              rs.innerHTML = rTone === 'win' ? '<b class="w">' + m.rs + '</b>' : m.rs;
            }
            if (bs) {
              bs.className = 'bs ' + bTone;
              bs.innerHTML = bTone === 'win' ? '<b class="w">' + m.bs + '</b>' : m.bs;
            }

            const small = row.querySelector('.lb small');
            if (small) small.remove();

            // La fila «Final score» del desglose lleva las mismas dos cifras que el
            // marcador, y hasta ahora no la tocaba nadie: la tabla no usa .rs/.bs sino
            // td.rw/td.bw, y el marcador sí se actualizaba porque lleva data-match.
            const rw = row.querySelector('td.rw');
            const bw = row.querySelector('td.bw');
            if (rw) rw.textContent = m.rs;
            if (bw) bw.textContent = m.bs;

            // Si está dentro de la lista de Próximos (#live-match-list), mover a Completados
            if (liveMatchList && completedMatchList && liveMatchList.contains(row)) {
              completedMatchList.prepend(row);
              if (completedSection) completedSection.hidden = false;
            }
          });
        });

        // Actualizar partidos activos en On Deck (Fields 1–5) en Insights y GameDay
        const onDeckContainers = document.querySelectorAll('#on-deck-container');
        onDeckContainers.forEach((container) => {
          const onDeckRows = Array.from(container.querySelectorAll('.m'));
          onDeckRows.forEach((row) => {
            const matchId = row.dataset.match;
            const liveMatch = data.matches.find((m) => m.id === matchId);
            if (liveMatch && liveMatch.played && liveMatch.rs !== null) {
              const field = row.dataset.field;
              // Buscar en unplayedList el próximo partido de esa cancha
              const nextUpcomingData = unplayedList.find((um) => {
                const domEl = document.querySelector(`.m[data-match="${um.id}"]`);
                return domEl && domEl.dataset.field === field && !container.contains(domEl);
              });

              if (nextUpcomingData) {
                const sourceEl = document.querySelector(`.m[data-match="${nextUpcomingData.id}"]`);
                if (sourceEl) {
                  const clone = sourceEl.cloneNode(true);
                  row.replaceWith(clone);
                  return;
                }
              }
              // Si no quedan partidos próximos para esa cancha
              row.remove();
            }
          });
        });

        // Actualizar estadísticas de equipo en la sección 2026
        const teamSection = document.querySelector('section.ev[data-season="2026"]');
        if (teamSection) {
          const teamMatch = window.location.pathname.match(/\/team\/([A-Z0-9_]+)/i);
          const teamCode = teamMatch ? teamMatch[1].toUpperCase() : null;
          if (teamCode) {
            // El código del roster no siempre es el de la API (10 Hope es HPE en la
            // competición), así que la fila de ranking de live.json hace de puente. De paso
            // es de donde sale el puesto de la temporada viva: sin esto la caja de Rank se
            // quedaba en «No data» para siempre.
            const rk = (data.rankings || []).find(
              (x) => String(x.code ?? '').toUpperCase() === teamCode || String(x.countryCode ?? '').toUpperCase() === teamCode
            );
            const apiCode = rk?.code ?? teamCode;

            if (rk && rk.rank != null) {
              const rankBox = teamSection.querySelectorAll('.box b')[0];
              if (rankBox) rankBox.textContent = rk.rank;
            }

            // La fila de KPIs de carrera de la cabecera suma en el build las temporadas ya
            // cerradas; la viva se añade aquí, porque en el build todavía no la tiene.
            // `.boxes.c3` solo existe en la cabecera del equipo.
            const cBox = document.querySelectorAll('.boxes.c3 .box');

            // «Best rank» se calcula igual, solo con las cerradas: si el puesto de la viva
            // es mejor, se queda con él y con su año. Sin JS queda el de las cerradas.
            if (rk && rk.rank != null) {
              const bestB = cBox[3] && cBox[3].querySelector('b');
              const cur = bestB ? parseInt(String(bestB.textContent).replace('#', ''), 10) : NaN;
              if (bestB && (!Number.isFinite(cur) || rk.rank < cur)) {
                bestB.textContent = `#${rk.rank}`;
                const sub = cBox[3].querySelectorAll('small')[1];
                if (sub) sub.textContent = `${data.season} · of ${data.rankings.length}`;
              }
            }

            const played = data.matches.filter(
              (m) => m.played && (m.red.includes(apiCode) || m.blue.includes(apiCode))
            );
            if (played.length > 0) {
              let w = 0, l = 0, t = 0, highest = 0, totalPts = 0;
              played.forEach((m) => {
                const isRed = m.red.includes(apiCode);
                const own = isRed ? m.rs : m.bs;
                const opp = isRed ? m.bs : m.rs;
                if (own > opp) w++;
                else if (own < opp) l++;
                else t++;
                if (own > highest) highest = own;
                totalPts += own;
              });

              const recordBox = teamSection.querySelectorAll('.box b')[1];
              if (recordBox) recordBox.textContent = `${w}–${l}–${t}`;

              const kvrSpans = teamSection.querySelectorAll('.kvr span:last-child');
              if (kvrSpans[0]) kvrSpans[0].textContent = highest;
              if (kvrSpans[1]) kvrSpans[1].textContent = (totalPts / played.length).toFixed(1);

              // La temporada viva se suma al total de carrera (Matches / Record) del build.
              const recB = cBox[2] && cBox[2].querySelector('b');
              const base = (recB ? recB.textContent : '').split('–').map((v) => parseInt(v, 10));
              const from = base.length === 3 && base.every(Number.isFinite) ? base : [0, 0, 0];
              const cW = from[0] + w, cL = from[1] + l, cT = from[2] + t, cN = cW + cL + cT;

              const matchesB = cBox[0] && cBox[0].querySelector('b');
              if (matchesB) matchesB.textContent = cN;
              if (recB) recB.textContent = `${cW}–${cL}–${cT}`;
              const pct = cBox[2] && cBox[2].querySelectorAll('small')[1];
              if (pct && cN) pct.textContent = `${((100 * cW) / cN).toFixed(1)}%`;
            }
          }
        }

        // Actualizar Rankings 2026. La API ya publica el ranking oficial, con sus
        // desempates aplicados, así que aquí no se calcula nada: solo se rellenan las filas
        // que el build dejó en «No data». Nunca se crean filas.
        if (data.rankings && data.rankings.length > 0) {
          const table = document.querySelector('table.dt');
          if (table && window.location.pathname.includes('/rankings/2026/')) {
            const tbody = table.querySelector('tbody');
            if (tbody) {
              // El código de la API (HPE, ANT…) no es el del roster (10, ATG): el puente es
              // el alpha-2, que es justo el nombre del archivo de bandera de la fila. Mismo
              // criterio que scripts/lib/codes.js.
              const byFlag = new Map();
              tbody.querySelectorAll('tr').forEach((tr) => {
                const img = tr.querySelector('img.fl');
                if (!img) return;
                const stem = (img.getAttribute('src') || '').split('/').pop().replace(/\.svg$/i, '').toLowerCase();
                if (stem) byFlag.set(stem, tr);
              });
              const rowFor = (a2) => {
                if (!a2) return null;
                const direct = byFlag.get(a2);
                if (direct) return direct;
                // Los equipos especiales usan un asset con prefijo: 10 → 10_hope.
                for (const [stem, tr] of byFlag) if (stem.startsWith(a2 + '_')) return tr;
                return null;
              };

              data.rankings.forEach((r) => {
                const tr = rowFor(String(r.countryCode ?? '').toLowerCase().split('_')[0]);
                if (!tr) return; // sin fila no se inventa nada: se queda en «No data»
                const cells = tr.querySelectorAll('td');
                // `put` rechaza null para que no pueda acabar la palabra «null» en una celda.
                const put = (i, v) => { if (cells[i] && v != null) cells[i].textContent = v; };
                put(0, r.rank);         // #
                put(2, r.rankingScore); // Ranking score
                put(3, r.highestScore); // Highest points
                put(4, r.climbPoints);  // Climb points
                put(5, r.played);       // Played
                if (cells[6] && r.wins != null && r.losses != null && r.ties != null) {
                  cells[6].textContent = `${r.wins}–${r.losses}–${r.ties}`; // W-L-T
                }
              });

              // Reordenar por puesto. Las filas que siguen sin puesto se van al final y
              // conservan su orden alfabético: el centinela es Infinity, no un número, para
              // que ninguna fila con «No data» se cuele entre los líderes.
              const rankOf = (tr) => {
                const n = parseInt(tr.cells[0]?.textContent, 10);
                return Number.isNaN(n) ? Infinity : n;
              };
              [...tbody.rows]
                .sort((a, b) => { const x = rankOf(a), y = rankOf(b); return x === y ? 0 : x - y; })
                .forEach((tr) => tbody.appendChild(tr));
            }
          }
        }
      } catch {
        // Fallback silencioso
      }
    }

    // 5. Multi-stream / Multi-view controller en GameDay
    const grid = document.getElementById('gameday-grid');
    const streamToggleBtns = document.querySelectorAll('.stream-toggle[data-stream-id]');
    const presetBtns = document.querySelectorAll('[data-preset]');

    if (grid && streamToggleBtns.length) {
      const availableStreams = Array.from(streamToggleBtns).map((btn) => ({
        id: btn.dataset.streamId,
        key: btn.dataset.streamKey || '',
        field: btn.dataset.streamField || '',
        label: btn.dataset.streamLabel || btn.textContent.trim(),
        btn: btn,
      }));

      const fieldStreams = availableStreams.filter((s) => s.field || s.key.startsWith('field'));

      let activeStreams = [];

      function syncGrid() {
        if (activeStreams.length === 0 && availableStreams.length > 0) {
          activeStreams.push(availableStreams[0]);
        }
        grid.dataset.count = String(Math.min(activeStreams.length, 5));

        // Eliminar tarjetas que ya no están activas
        const currentCards = Array.from(grid.querySelectorAll('.player-card'));
        currentCards.forEach((card) => {
          const id = card.dataset.streamId;
          if (!activeStreams.some((s) => s.id === id)) {
            card.remove();
          }
        });

        // Añadir tarjetas nuevas (manteniendo las existentes sin recargar sus iframes)
        activeStreams.forEach((s) => {
          let card = grid.querySelector(`.player-card[data-stream-id="${s.id}"]`);
          if (!card) {
            card = document.createElement('div');
            card.className = 'player-card';
            card.dataset.streamId = s.id;
            if (s.key) card.dataset.streamKey = s.key;
            card.innerHTML =
              `<div class="player-head"><span>● ${s.label}</span><button class="player-close" title="Close stream" aria-label="Close stream" data-id="${s.id}">×</button></div>` +
              `<div class="player-frame"><iframe src="https://www.youtube.com/embed/${s.id}?autoplay=1" title="${s.label}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
            grid.appendChild(card);
          }
        });

        // Actualizar estado 'on' en los botones de transmisión
        availableStreams.forEach((s) => {
          const isActive = activeStreams.some((a) => a.id === s.id);
          s.btn.classList.toggle('on', isActive);
        });

        // Actualizar estado 'on' en los botones de preajuste
        presetBtns.forEach((pb) => {
          const pNum = parseInt(pb.dataset.preset, 10);
          pb.classList.toggle('on', activeStreams.length === pNum);
        });

        // Sincronizar parámetros de consulta en la URL
        try {
          const newUrl = new URL(window.location);
          const keys = activeStreams.map((s) => s.key || s.id);
          if (keys.length === 1) {
            newUrl.searchParams.set('stream', keys[0]);
            newUrl.searchParams.delete('streams');
          } else if (keys.length > 1) {
            newUrl.searchParams.set('streams', keys.join(','));
            newUrl.searchParams.delete('stream');
          } else {
            newUrl.searchParams.delete('stream');
            newUrl.searchParams.delete('streams');
          }
          window.history.replaceState({}, '', newUrl);
        } catch {}
      }

      // Inicialización desde la URL (?streams=... o ?stream=...)
      const urlParams = new URLSearchParams(window.location.search);
      const streamsParam = urlParams.get('streams');
      const streamParam = urlParams.get('stream');

      if (streamsParam) {
        const rawKeys = streamsParam.split(',').map((k) => k.trim().toLowerCase());
        activeStreams = rawKeys
          .map((k) =>
            availableStreams.find(
              (s) =>
                s.key.toLowerCase() === k ||
                s.field.toLowerCase() === k ||
                s.id.toLowerCase() === k
            )
          )
          .filter(Boolean);
      } else if (streamParam) {
        const k = streamParam.trim().toLowerCase();
        const found = availableStreams.find(
          (s) =>
            s.key.toLowerCase() === k ||
            s.field.toLowerCase() === k ||
            s.id.toLowerCase() === k
        );
        if (found) activeStreams = [found];
      }

      if (activeStreams.length === 0) {
        activeStreams = [availableStreams[0]];
      }

      syncGrid();

      // Interacción con botones de preajustes (1, 2, 3, 4, 5)
      presetBtns.forEach((pb) => {
        pb.addEventListener('click', (e) => {
          e.preventDefault();
          const count = parseInt(pb.dataset.preset, 10);
          if (count === 1) {
            activeStreams = [activeStreams[0] || fieldStreams[0] || availableStreams[0]];
          } else {
            activeStreams = fieldStreams.slice(0, count);
            if (activeStreams.length < count) {
              const remaining = availableStreams.filter((s) => !activeStreams.includes(s));
              activeStreams = activeStreams.concat(remaining.slice(0, count - activeStreams.length));
            }
          }
          syncGrid();
        });
      });

      // Interacción al pulsar un stream individual
      availableStreams.forEach((s) => {
        s.btn.addEventListener('click', (e) => {
          e.preventDefault();
          const isAlreadyActive = activeStreams.some((a) => a.id === s.id);
          if (isAlreadyActive) {
            if (activeStreams.length > 1) {
              activeStreams = activeStreams.filter((a) => a.id !== s.id);
            }
          } else {
            if (activeStreams.length === 1) {
              activeStreams = [s];
            } else {
              if (activeStreams.length >= 5) {
                activeStreams.shift();
              }
              activeStreams.push(s);
            }
          }
          syncGrid();
        });
      });

      // Delegación de clic para botones de cerrar (×) en cada tarjeta
      grid.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('.player-close');
        if (closeBtn) {
          e.preventDefault();
          const id = closeBtn.dataset.id || closeBtn.closest('.player-card')?.dataset.streamId;
          if (id) {
            if (activeStreams.length > 1) {
              activeStreams = activeStreams.filter((s) => s.id !== id);
            } else {
              const next = availableStreams.find((s) => s.id !== id) || availableStreams[0];
              activeStreams = [next];
            }
            syncGrid();
          }
        }
      });
    }

    updateETAs();
    update();

    setInterval(() => {
      if (!document.hidden) updateETAs();
    }, 30000);

    setInterval(() => {
      if (!document.hidden) update();
    }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
