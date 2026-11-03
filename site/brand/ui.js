// site/brand/ui.js
// Mejoras de interfaz que NO dependen de una temporada en vivo: el buscador
// global de la cabecera y el filtro de la página /search/. Se carga siempre.
// site/brand/live.js solo se carga cuando hay una temporada en modo live.
(function () {
  function init() {
    // Buscador global (en cabecera y página /search/)
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
        const cleanVal = val.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
        const teamLink = Array.from(document.querySelectorAll('a[href*="/team/"]')).find((a) => {
          const tText = (a.textContent || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
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
        const q = (term || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
        const rows = document.querySelectorAll('#search-results table.dt tbody tr');
        let visible = 0;
        rows.forEach((row) => {
          if (!q) {
            row.hidden = false;
            visible++;
            return;
          }
          const text = (row.textContent || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
