/**
 * Progressive enhancement, and nothing else.
 *
 * Every page is complete before this file runs: the data is in the HTML and the
 * layout is pure CSS. This script has exactly three jobs, and each of them only
 * NARROWS or RESTYLES what is already on screen. Remove it and the site still
 * works — the theme follows the operating system, the match list shows every
 * match, and /search/ lists every team.
 *
 * It reads no labels from here: the summary strings it writes are handed to it
 * as data attributes by the templates, which get them from brand.js.
 */

(function () {
  'use strict';

  // ── theme ─────────────────────────────────────────────────────────────────
  // The inline head script applies the stored choice before first paint; this
  // only records a new one. The storage key must match the one in layout.js.
  var buttons = document.querySelectorAll('.seg [data-t]');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function () {
      document.documentElement.dataset.theme = this.dataset.t;
      try { localStorage.setItem('th', this.dataset.t); } catch (e) {}
    });
  }

  // ── year selector in the section menu ─────────────────────────────────────
  // A `<select>` cannot navigate on its own. Without this it is simply inert,
  // and the section anchors beside it still work.
  var yearSelect = document.querySelector('[data-year-select]');
  if (yearSelect) {
    yearSelect.addEventListener('change', function () {
      if (this.value) window.location.href = this.value;
    });
  }

  // ── match list: filter by field ───────────────────────────────────────────
  var filters = document.querySelector('[data-filters]');
  if (filters) {
    var summary = document.querySelector('[data-filter-summary]');
    var matches = [].slice.call(document.querySelectorAll('.m[data-field]'));
    var stages = [].slice.call(document.querySelectorAll('.stg'));

    var applyField = function (value) {
      var shown = 0;

      matches.forEach(function (row) {
        var visible = value === 'all' || String(row.dataset.field) === String(value);
        row.hidden = !visible;
        if (visible) shown++;
      });

      // A stage heading with no visible match under it is noise.
      stages.forEach(function (stage) {
        var any = false;
        var el = stage.nextElementSibling;
        while (el && el.classList.contains('m')) {
          if (!el.hidden) { any = true; break; }
          el = el.nextElementSibling;
        }
        stage.hidden = !any;
      });

      if (summary) {
        summary.hidden = value === 'all';
        summary.textContent = shown + ' ' + (summary.dataset.labelMatches || '') +
          ' ' + (summary.dataset.labelShown || '');
      }
    };

    var fieldButtons = filters.querySelectorAll('[data-field]');
    for (var j = 0; j < fieldButtons.length; j++) {
      fieldButtons[j].addEventListener('click', function () {
        for (var k = 0; k < fieldButtons.length; k++) {
          fieldButtons[k].setAttribute('aria-pressed', String(fieldButtons[k] === this));
        }
        applyField(this.dataset.field);
      });
    }
  }

  // ── team search ───────────────────────────────────────────────────────────
  var input = document.querySelector('[data-search]');
  if (input) {
    var rows = [].slice.call(document.querySelectorAll('[data-search-row]'));
    var searchSummary = document.querySelector('[data-search-summary]');

    var fold = function (value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
    };

    var applyQuery = function () {
      var query = fold(input.value);
      var shown = 0;

      rows.forEach(function (row) {
        var match = !query || (row.dataset.key || '').indexOf(query) !== -1;
        row.hidden = !match;
        if (match) shown++;
      });

      if (searchSummary) {
        searchSummary.hidden = !query;
        searchSummary.textContent = shown + ' ' + (searchSummary.dataset.labelTeams || '') +
          ' ' + (searchSummary.dataset.labelShown || '');
      }
    };

    // The navbar form submits here as ?q=…, so the page opens pre-filtered.
    try {
      var fromUrl = new URLSearchParams(window.location.search).get('q');
      if (fromUrl) input.value = fromUrl;
    } catch (e) {}

    input.addEventListener('input', applyQuery);
    applyQuery();
  }
})();
