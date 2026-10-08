// site/brand/live.js
// Live Overlay (temporada 2026).
// Convierte horarios a la hora local del cliente, calcula ETA, filtra países/canchas y consulta /live.json sin recargar.

(function () {
  function init() {
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
    function formatEta(diffMs) {
      if (diffMs <= -3600000) {
        return '';
      }
      if (diffMs <= 0) {
        return '● In progress';
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
        const etaStr = formatEta(diff);

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

        // Actualizar partidos (scores y tono win/lose)
        data.matches.forEach((m) => {
          if (!m.played || m.rs === null || m.bs === null) return;
          const rows = document.querySelectorAll(`[data-match="${m.id}"]`);
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
          });
        });

        // Actualizar partidos activos en On Deck (5 canchas)
        const onDeckContainer = document.getElementById('on-deck-container');
        if (onDeckContainer) {
          const onDeckRows = onDeckContainer.querySelectorAll('.m');
          onDeckRows.forEach((row) => {
            const matchId = row.dataset.match;
            const liveMatch = data.matches.find((m) => m.id === matchId);
            if (liveMatch && liveMatch.played && liveMatch.rs !== null) {
              const field = row.dataset.field;
              const nextUpcoming = document.querySelector(`#live-match-list .m[data-field="${field}"]`);
              if (nextUpcoming) {
                row.replaceWith(nextUpcoming.cloneNode(true));
              }
            }
          });
        }

        // Actualizar estadísticas de equipo en la sección 2026
        const teamSection = document.querySelector('section.ev[data-season="2026"]');
        if (teamSection) {
          const teamMatch = window.location.pathname.match(/\/team\/([A-Z0-9_]+)/i);
          const teamCode = teamMatch ? teamMatch[1].toUpperCase() : null;
          if (teamCode) {
            const played = data.matches.filter(
              (m) => m.played && (m.red.includes(teamCode) || m.blue.includes(teamCode))
            );
            if (played.length > 0) {
              let w = 0, l = 0, t = 0, highest = 0, totalPts = 0;
              played.forEach((m) => {
                const isRed = m.red.includes(teamCode);
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
            }
          }
        }

        // Actualizar Rankings 2026
        if (data.rankings && data.rankings.length > 0) {
          const table = document.querySelector('table.dt');
          if (table && window.location.pathname.includes('/rankings/2026/')) {
            const tbody = table.querySelector('tbody');
            if (tbody) {
              data.rankings.forEach((r) => {
                const link = tbody.querySelector(`a[href*="/team/${r.code}/"]`);
                const tr = link ? link.closest('tr') : null;
                if (tr) {
                  const cells = tr.querySelectorAll('td');
                  if (cells[0]) cells[0].textContent = r.rank;
                  if (cells[2]) cells[2].textContent = r.rp;
                  if (cells[3]) cells[3].textContent = `${r.w}–${r.l}–${r.t}`;
                }
              });
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
