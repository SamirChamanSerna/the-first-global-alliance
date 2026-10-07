// PLANTILLAS de las 11 pantallas del sitio.
// Cada pantalla es una composición de bloques HTML reutilizables (blocks.js),
// garantizando consistencia de diseño y cero HTML con estilos inline.

import { brand, t } from '../brand/brand.js';
import {
  hero,
  flag,
  teamLink,
  pip,
  box,
  boxes,
  kvr,
  dd,
  dt,
  matchList,
  matchRow,
  awardBlock,
  awardKey,
  scoreboard,
  breakdown,
  videoThumb,
  videoFallback,
  videoCard
} from './blocks.js';
import { urls, outPath } from './urls.js';
import { seasons, T, codes, M, S, A, AL, AW } from './data.js';

// Lista de años de todas las temporadas y año más reciente
const allYears = seasons.map((s) => s.y);
const latestYear = allYears[0];
const getSeason = (year) => seasons.find((s) => s.y == year);

// Temporadas con competencia física. Las de solo premios (2020, 2021) no tienen partidos,
// rankings ni alianzas: no generan páginas de temporada ni entran en las métricas de partidos.
// Sus premios sí se conservan (conteos, catálogo de premios, /awards/). Ver docs/discovery/05.
const competitionYears = seasons.filter((s) => s.mode !== 'awards-only').map((s) => s.y);
const isAwardsOnlySeason = (year) => getSeason(year)?.mode === 'awards-only';

// Barra de título de sección con título y controles auxiliares opcionales
const headerBar = (heading, extraControls = '') =>
  `<div class="bar"><h1>${heading}</h1>${extraControls}</div>`;

// Selector de temporadas con menú desplegable sobre una lista concreta de años
const seasonDropdown = (currentLabel, urlGenerator, yearsList, overviewOption) =>
  dd(currentLabel, [
    ...(overviewOption ? [overviewOption] : []),
    ...yearsList.map((y) => [urlGenerator(y), y])
  ]);

const allSeasonsDropdown = (currentLabel, urlGenerator, overviewOption) =>
  seasonDropdown(currentLabel, urlGenerator, allYears, overviewOption);

// Enlace de equipo con código ISO y nombre oficial
const teamLinkWithCode = (code) => teamLink(code, `${code} ${T[code][0]}`);
const teamNameLink = (code) => teamLink(code, T[code][0]);

// Determina el nivel de un premio: alianza ('a'), podio ('p') o no posicionado ('awarded')
const getAwardTier = (award, winnerIndex) => {
  if (award.ty === 'a') return award.tier;
  if (award.ty === 'p') return ['gold', 'silver', 'bronze'][winnerIndex];
  return 'awarded';
};

// Obtiene los premios ganados por un equipo en una temporada específica
const getTeamAwardsForYear = (year, teamCode) =>
  A[year].flatMap((award) =>
    award.w.map((winnerCode, idx) =>
      winnerCode === teamCode ? { name: award.name, tier: getAwardTier(award, idx) } : null
    ).filter(Boolean)
  );

// Cuenta las medallas ganadas por un equipo en una temporada específica
const countMedalsForYear = (year, teamCode) => {
  const medalCounts = { gold: 0, silver: 0, bronze: 0, honorable: 0 };
  const teamAwards = getTeamAwardsForYear(year, teamCode);
  teamAwards.forEach((item) => {
    const key = item.tier === 'awarded' ? 'honorable' : item.tier;
    medalCounts[key]++;
  });
  return medalCounts;
};

// Cuenta el total histórico de medallas ganadas por un equipo
const countTotalMedals = (teamCode) => {
  const totalCounts = { gold: 0, silver: 0, bronze: 0, honorable: 0 };
  allYears.forEach((year) => {
    const yearCounts = countMedalsForYear(year, teamCode);
    Object.keys(totalCounts).forEach((key) => {
      totalCounts[key] += yearCounts[key];
    });
  });
  return totalCounts;
};

const totalMedalsCount = (countsObj) =>
  Object.values(countsObj).reduce((acc, curr) => acc + curr, 0);

// Lista de premios formateada para la vista de equipo
const renderAwardsList = (year, teamCode) => {
  const awards = getTeamAwardsForYear(year, teamCode);
  return (
    awards.map((award) => kvr(award.name, pip(award.tier))).join('') ||
    `<div class="muted">${t('noAwards')}</div>`
  );
};

// Muestra la alianza a la que perteneció el equipo en los playoffs de una temporada
const renderAllianceInfo = (year, teamCode) => {
  const alliances = AL[year] || [];
  const allianceIndex = alliances.findIndex((group) => group.includes(teamCode));
  if (allianceIndex < 0) {
    return kvr(t('alliance'), t('noPlayoff'));
  }
  const memberLinks = alliances[allianceIndex]
    .map((code) => `<a href="${urls.team(code)}">${code}</a>`)
    .join(' ');
  return kvr(`${t('alliance')} ${allianceIndex + 1}`, memberLinks);
};

const TIER_ORDER = { gold: 0, silver: 1, bronze: 2, honorable: 3, awarded: 4 };

// Celdas de ganadores de un premio para la página de una temporada
const buildSeasonAwardCells = (award) => {
  if (award.ty === 'a') {
    return [[award.w.map(teamNameLink).join(', '), award.tier]];
  }
  return award.w.map((code, idx) => [teamNameLink(code), getAwardTier(award, idx)]);
};

// Celdas de ganadores de un premio para la página histórica (Overview)
const buildOverviewAwardCells = (awardName) => {
  const winnersMap = {};
  allYears.forEach((year) => {
    const award = A[year].find((item) => item.name === awardName);
    if (!award) return;
    award.w.forEach((code, idx) => {
      const tier = getAwardTier(award, idx);
      const entry = winnersMap[code] || (winnersMap[code] = { count: 0, bestTier: tier });
      entry.count++;
      if (TIER_ORDER[tier] < TIER_ORDER[entry.bestTier]) {
        entry.bestTier = tier;
      }
    });
  });

  return Object.entries(winnersMap)
    .sort((a, b) => TIER_ORDER[a[1].bestTier] - TIER_ORDER[b[1].bestTier] || b[1].count - a[1].count)
    .map(([code, entry]) => [
      teamNameLink(code) + (entry.count > 1 ? ` ×${entry.count}` : ''),
      entry.bestTier
    ]);
};

// Renderiza el bloque contenedor de premios
const renderAwardBlocks = (year) => {
  const awardsData = year ? A[year] : AW.map(([name, desc]) => ({ name, desc }));
  const renderedBlocks = awardsData.map((award) =>
    awardBlock(
      award.name,
      award.desc,
      year ? buildSeasonAwardCells(award) : buildOverviewAwardCells(award.name)
    )
  );
  return `<div class="aws">${renderedBlocks.join('')}</div>`;
};

const renderPipsSummary = (countsObj) =>
  Object.entries(countsObj)
    .map(([tierKey, count]) => `${pip(tierKey)} ×${count}`)
    .join(' ');

// Métricas estadísticas: promedio y desviación estándar
const average = (numbers) => numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
const stdDev = (numbers) => {
  const mean = average(numbers);
  return Math.sqrt(average(numbers.map((v) => (v - mean) ** 2)));
};

// Identifica el partido con la mayor puntuación de una lista
const getHighestScoringMatch = (matchesList) => {
  if (!matchesList.length) return null;
  return matchesList.reduce((bestMatch, currentMatch) =>
    Math.max(currentMatch.rs, currentMatch.bs) > Math.max(bestMatch.rs, bestMatch.bs)
      ? currentMatch
      : bestMatch
  );
};

// Fila destacada de partido y miniatura de video
const renderHighlightMatch = (match) =>
  match
    ? `<div>${matchRow(match)}</div><div class="sec">${
        match.video ? videoThumb(match) : videoFallback(match)
      }</div>`
    : `<div class="muted">${t('noMatchData')}</div>`;

// Extrae todos los marcadores individuales (rojo y azul) de una lista de partidos
const extractScores = (matchesList) => matchesList.flatMap((m) => [m.rs, m.bs]);

// Margen de victoria promedio (excluye empates porque no tienen margen ganador)
const extractWinningMargins = (matchesList) =>
  matchesList
    .filter((m) => m.rs != null && m.rs !== m.bs)
    .map((m) => Math.abs(m.rs - m.bs));

// Columnas de tabla de clasificación
const rankColumns = [
  [t('rankingPoints'), (row) => row.rp],
  [t('tb1'), (row) => row.avg],
  [t('tb2'), (row) => row.w],
  [t('tb3'), (row) => row.pts]
];

const renderRankingsTable = (year) =>
  dt(
    [['#', 1], [t('team')], ...rankColumns.map((col) => [col[0], 1]), [t('wlt'), 1]],
    S[year].map((row) => [
      row.rank,
      teamLinkWithCode(row.code),
      ...rankColumns.map((col) => col[1](row)),
      `${row.w}–${row.l}–${row.t}`
    ]),
    1
  );

// Filtra partidos en los que participó un equipo concreto en un año determinado
const getTeamMatches = (teamCode, year) =>
  (M[year] || []).filter((m) => [...m.red, ...m.blue].includes(teamCode));

const getTeamActiveYears = (teamCode) =>
  allYears.filter((year) => (S[year] || []).some((row) => row.code === teamCode));

const getSeasonDisplayName = (year) => getSeason(year)?.name || String(year);
const getTeamCount = (year) => (year ? getSeason(year)?.teams || t('noData') : codes.length);

const countRoundRobinSeasons = (teamCode) =>
  allYears.filter((year) => (AL[year] || []).some((alliance) => alliance.includes(teamCode))).length;

const formatLocation = (season) => [season.city, season.country].filter(Boolean).join(', ');
const formatDateAndLocation = (season) =>
  [formatLocation(season), season.dates].filter(Boolean).join(' · ');
const renderCountryCell = (season) =>
  season.country ? `${flag(season.iso)} ${season.country}` : t('noData');

// Video de revelación del juego de la temporada
const renderRevealBlock = (year) => {
  const season = year ? getSeason(year) : seasons.find((item) => item.reveal);
  return (
    `<h3>${t('reveal')}</h3>` +
    (season?.reveal
      ? videoCard(season.reveal, `${t('season')} ${season.y}`, getSeasonDisplayName(season.y))
      : `<div class="thumb">${t('thumbnail')}</div>`)
  );
};

const countTotalAwardsGiven = (yearsList) =>
  yearsList.reduce(
    (total, year) => total + A[year].reduce((count, award) => count + award.w.length, 0),
    0
  );

// =========================================================================
// Pantallas principales (11 rutas del sitio web)
// =========================================================================

// 1. Home
const homePage = () =>
  hero() +
  `<h3>${t('venues')}</h3>${dt(
    [[t('year')], [t('venue')], [t('country')], [t('dates')]],
    seasons.map((s) => [
      `<a href="${urls.insights(s.y)}">${s.y}</a>`,
      s.city || t('noData'),
      renderCountryCell(s),
      s.dates || t('noData')
    ])
  )}` +
  `<h3>${t('overview')}</h3>${boxes(
    [
      box(t('matches'), allYears.reduce((total, y) => total + (M[y] || []).length, 0)),
      box(t('awards'), countTotalAwardsGiven(allYears)),
      box(t('teams'), codes.length)
    ],
    1
  )}`;

// 2. Insights (Estadísticas generales o por temporada)
const insightsPage = (year) => {
  const isAwardsOnly = !!year && isAwardsOnlySeason(year);
  const matchesList = year ? M[year] : competitionYears.flatMap((y) => M[y]);
  const qualificationMatches = matchesList.filter((m) => m.stage === 'ranking');
  const playoffMatches = matchesList.filter((m) => m.stage !== 'ranking');
  const currentSeason = year && getSeason(year);

  const kpiBox = (label, dataArray) =>
    dataArray.length
      ? box(label, average(dataArray).toFixed(1), `± ${stdDev(dataArray).toFixed(1)}`)
      : box(label, t('noData'));

  const topMedalWinners = (targetYear) =>
    codes
      .map((code) => [code, targetYear ? countMedalsForYear(targetYear, code) : countTotalMedals(code)])
      .filter((entry) => totalMedalsCount(entry[1]) > 0)
      .sort((a, b) => totalMedalsCount(b[1]) - totalMedalsCount(a[1]))
      .slice(0, 10)
      .map(([code, counts], idx) => [
        idx + 1,
        teamLinkWithCode(code),
        renderPipsSummary(counts),
        totalMedalsCount(counts)
      ]);

  const topRankings = year
    ? isAwardsOnly
      ? topMedalWinners(year)
      : S[year].slice(0, 10).map((row) => [row.rank, teamLinkWithCode(row.code), row.rp])
    : topMedalWinners();

  const isRankedSeason = year && !isAwardsOnly;

  return (
    headerBar(
      year ? `${t('season')} ${year}` : t('overview'),
      dd(year || t('overview'), [
        [urls.insights(), t('overview')],
        ...allYears.map((y) => [urls.insights(y), y])
      ])
    ) +
    `<p class="muted">${
      year
        ? `${[getSeasonDisplayName(year), formatLocation(currentSeason)].filter(Boolean).join(' · ')} · `
        : ''
    }<a href="${year ? `https://first.global/archive/fgc-${year}/` : 'https://first.global/about/'}">${t(
      'officialSite'
    )}</a></p>` +
    boxes(
      isAwardsOnly
        ? [box(t('teams'), getTeamCount(year)), box(t('awards'), countTotalAwardsGiven([year]))]
        : [
            box(t('teams'), getTeamCount(year)),
            box(t('matches'), matchesList.length),
            box(t('awards'), countTotalAwardsGiven(year ? [year] : allYears))
          ],
      1
    ) +
    renderRevealBlock(year) +
    `<h3>${t('awards')}</h3>${awardKey()}${renderAwardBlocks(year)}` +
    (isAwardsOnly
      ? `<p class="note">${t('noCompetition')}</p>`
      : `<h3>${t('highestMatch')}</h3>${renderHighlightMatch(
          getHighestScoringMatch(qualificationMatches)
        )}<h3>${t('qualMetrics')}</h3>${boxes([
          kpiBox(t('avgMatch'), extractScores(qualificationMatches)),
          kpiBox(t('avgMargin'), extractWinningMargins(qualificationMatches))
        ])}` +
        `<h3>${year ? t('playoffs') : t('mostRoundRobin')}</h3>` +
        (year
          ? `<div>${matchList(playoffMatches)}</div>`
          : dt(
              [[t('team')], [t('seasons'), 1]],
              codes
                .map((code) => [code, countRoundRobinSeasons(code)])
                .filter((x) => x[1] > 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([code, count]) => [teamLinkWithCode(code), count])
            )) +
        `<h3>${t('highestPlayoff')}</h3>${renderHighlightMatch(
          getHighestScoringMatch(playoffMatches)
        )}${boxes([
          kpiBox(t('avgMatch'), extractScores(playoffMatches)),
          kpiBox(t('avgMargin'), extractWinningMargins(playoffMatches))
        ])}`) +
    `<h3>${isRankedSeason ? t('topRank') : t('mostAwards')}</h3>` +
    dt(
      isRankedSeason
        ? [['#', 1], [t('team')], [t('rankingPoints'), 1]]
        : [['#', 1], [t('team')], [t('medals'), 0], [t('total'), 1]],
      topRankings
    ) +
    (isRankedSeason
      ? `<p><a href="${urls.rankings(year)}">${t('fullRanking')}</a></p>`
      : `<p><a href="${urls.awards()}">${t('fullAwards')}</a></p>`)
  );
};

// 3. Teams (Directorio de equipos por continente)
const teamsPage = () =>
  headerBar(t('teams')) +
  ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania']
    .map(
      (continent) =>
        `<h3>${continent}</h3>` +
        dt(
          [[t('flagCol')], [t('iso')], [t('team')], [t('seasons'), 1]],
          codes
            .filter((c) => T[c][1] === continent)
            .sort()
            .map((c) => [flag(c), c, `<a href="${urls.team(c)}">${T[c][0]}</a>`, getTeamActiveYears(c).length])
        )
    )
    .join('');

// 4. Awards (Medallero histórico global)
const awardsPage = () =>
  headerBar(t('awards')) +
  dt(
    [
      [t('team')],
      ...['gold', 'silver', 'bronze', 'honorable'].map((tier) => [brand.medals[tier].label, 1]),
      [t('total'), 1]
    ],
    codes
      .map((code) => [code, countTotalMedals(code)])
      .sort((a, b) => totalMedalsCount(b[1]) - totalMedalsCount(a[1]))
      .map(([code, medals]) => [
        teamLinkWithCode(code),
        medals.gold,
        medals.silver,
        medals.bronze,
        medals.honorable,
        totalMedalsCount(medals)
      ]),
    1
  );

// 5. Rankings por temporada
const rankingsPage = (year) =>
  headerBar(`${t('topRank')} ${year}`, allSeasonsDropdown(year, (y) => urls.rankings(y))) +
  renderRankingsTable(year);

// 6. Matches por temporada
const matchesPage = (year) =>
  headerBar(`${t('matches')} ${year}`, allSeasonsDropdown(year, (y) => urls.matches(y))) +
  `<div>${matchList(M[year])}</div>`;

// 7. GameDay
const gamedayPage = () => headerBar('GameDay') + `<div class="map">${t('gamedaySoon')}</div>`;

// 8. Team History (Historial completo de un equipo a lo largo de los años)
const teamHistoryPage = (teamCode) => {
  const seasonRankings = allYears.map((year) => {
    const ranking = (S[year] || []).find((row) => row.code === teamCode);
    return ranking ? { ...ranking, year } : null;
  });
  const participatedRankings = seasonRankings.filter(Boolean);

  // Centinela Infinity, no 99: con 99 cualquier equipo peor que el puesto 99 se
  // quedaba con el valor inicial y mostraba «#99» como si fuera su mejor puesto.
  const bestRank = participatedRankings.reduce(
    (best, current) => (current.rank < best.rank ? { rank: current.rank, year: current.year } : best),
    { rank: Infinity, year: '' }
  );
  const totalWins = participatedRankings.reduce((sum, r) => sum + r.w, 0);
  const totalLosses = participatedRankings.reduce((sum, r) => sum + r.l, 0);
  const totalTies = participatedRankings.reduce((sum, r) => sum + r.t, 0);
  const totalMatchesCount = totalWins + totalLosses + totalTies;

  return (
    `<div class="bar"><div class="title">${flag(teamCode)}<h1>${T[teamCode][0]}</h1></div>${seasonDropdown(
      t('seasons'),
      (y) => urls.team(teamCode, y),
      participatedRankings.map((r) => r.year)
    )}</div><div class="kv"><div><span>${t('iso')}:</span> ${teamCode}</div></div>` +
    boxes(
      [
        box(t('matches'), totalMatchesCount),
        box(t('awards'), totalMedalsCount(countTotalMedals(teamCode))),
        box(
          t('record'),
          totalMatchesCount ? `${totalWins}–${totalLosses}–${totalTies}` : t('noData'),
          totalMatchesCount ? `${((100 * totalWins) / totalMatchesCount).toFixed(1)}%` : ''
        ),
        box(
          t('bestRank'),
          participatedRankings.length ? `#${bestRank.rank}` : t('noData'),
          participatedRankings.length ? `${bestRank.year} · ${t('of')} ${getTeamCount(bestRank.year)}` : ''
        ),
        box(t('medals'), '', renderPipsSummary(countTotalMedals(teamCode)))
      ],
      1
    ) +
    `<h3>${t('timeline')}</h3>` +
    allYears
      .map((year, idx) => {
        const ranking = seasonRankings[idx];
        const season = getSeason(year);
        if (!ranking) {
          return `<section class="ev"><div><h2>${getSeasonDisplayName(year)}</h2><div class="when">${formatDateAndLocation(
            season
          )}</div><p class="note">${t('noCompetition')}</p><div class="lbl">${t(
            'awards'
          )}</div>${renderAwardsList(year, teamCode)}</div><div><div class="photo">${t(
            'photo'
          )}</div></div></section>`;
        }
        const matchScores = extractScores(getTeamMatches(teamCode, year));
        // Los KPIs de la temporada van en la columna IZQUIERDA, bajo Rank y Record, como
        // en @component:season-block del demo. La derecha queda para la foto.
        return `<section class="ev"><div><h2><a href="${urls.team(
          teamCode,
          year
        )}">${getSeasonDisplayName(year)}</a></h2><div class="when">${formatDateAndLocation(
          season
        )}</div>${boxes([
          box(t('rank'), ranking.rank, `${t('of')} ${getTeamCount(year)}`),
          box(t('record'), `${ranking.w}–${ranking.l}–${ranking.t}`)
        ])}${kvr(
          t('highestScore'),
          matchScores.length ? Math.max(...matchScores) : t('noData')
        )}${kvr(t('avgScore'), ranking.avg)}${renderAllianceInfo(
          year,
          teamCode
        )}<div class="lbl">${t('awards')}</div>${renderAwardsList(
          year,
          teamCode
        )}</div><div><div class="photo">${t('photo')}</div></div></section>`;
      })
      .join('')
  );
};

// 9. Team Season (Desempeño de un equipo en un año concreto)
const teamSeasonPage = (teamCode, year) => {
  const ranking = S[year].find((x) => x.code === teamCode);
  const season = getSeason(year);

  return (
    `<div class="bar"><div class="title">${flag(teamCode)}<h1>${T[teamCode][0]} · ${year}</h1></div>${seasonDropdown(
      year,
      (y) => urls.team(teamCode, y),
      getTeamActiveYears(teamCode)
    )}</div><p><a href="${urls.team(teamCode)}">← ${t('back')}</a></p>` +
    `<section class="ev"><div><h2>${getSeasonDisplayName(year)}</h2><div class="when">${formatDateAndLocation(
      season
    )}</div>${boxes([
      box(t('rank'), ranking.rank, `${t('of')} ${getTeamCount(year)}`),
      box(t('record'), `${ranking.w}–${ranking.l}–${ranking.t}`)
    ])}${renderAllianceInfo(year, teamCode)}<div class="lbl">${t('awards')}</div>${renderAwardsList(
      year,
      teamCode
    )}</div><div><div class="photo">${t('photo')}</div></div></section>` +
    `<h3>${t('matches')}</h3><div>${matchList(getTeamMatches(teamCode, year), teamCode)}</div>`
  );
};

// 10. Match Page (Detalle de un partido específico con marcador y desglose)
const matchPage = (match) =>
  `<div class="bar"><h1>${match.label} · ${getSeasonDisplayName(match.y)}</h1></div><p class="when">${
    match.field
  } · ${match.time}</p><section class="ev"><div class="mh span-all"><div>${scoreboard(
    match
  )}<div class="sec">${breakdown(match)}</div></div><div class="vids">${videoThumb(
    match
  )}</div></div></section>`;

// =========================================================================
// Ensamblador de todas las rutas del sitio
// =========================================================================
export const pages = () => {
  const pageList = [
    { path: '', title: brand.name, body: homePage() },
    { path: outPath(urls.insights()), title: t('overview'), active: 'insights', body: insightsPage() },
    { path: outPath(urls.teams()), title: t('teams'), active: 'teams', body: teamsPage() },
    { path: outPath(urls.awards()), title: t('awards'), active: 'awards', body: awardsPage() },
    { path: outPath(urls.gameday()), title: 'GameDay', active: 'gameday', body: gamedayPage() }
  ];

  allYears.forEach((year) => {
    pageList.push({
      path: outPath(urls.insights(year)),
      title: `${t('season')} ${year}`,
      active: 'insights',
      body: insightsPage(year)
    });

    if (isAwardsOnlySeason(year)) return; // sin competencia: ni rankings, ni matches, ni páginas de partido

    pageList.push(
      {
        path: outPath(urls.rankings(year)),
        title: `${t('topRank')} ${year}`,
        active: 'rankings',
        body: rankingsPage(year)
      },
      {
        path: outPath(urls.matches(year)),
        title: `${t('matches')} ${year}`,
        active: 'matches',
        body: matchesPage(year)
      },
      ...M[year].map((match) => ({
        path: outPath(urls.match(match.id)),
        title: `${match.label} ${year}`,
        active: 'matches',
        body: matchPage(match)
      }))
    );
  });

  codes.forEach((teamCode) => {
    pageList.push(
      {
        path: outPath(urls.team(teamCode)),
        title: T[teamCode][0],
        active: 'teams',
        body: teamHistoryPage(teamCode)
      },
      ...getTeamActiveYears(teamCode).map((year) => ({
        path: outPath(urls.team(teamCode, year)),
        title: `${T[teamCode][0]} ${year}`,
        active: 'teams',
        body: teamSeasonPage(teamCode, year)
      }))
    );
  });

  const searchIndex = [...codes.map((c) => T[c][0]), ...allYears.map(String)];
  return pageList.map((page) => ({ latest: latestYear, sx: searchIndex, ...page }));
};
