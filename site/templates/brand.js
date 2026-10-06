/**
 * MASTER DE IDENTIDAD — nombre, logo, rutas y textos que se repiten en todo el sitio.
 * Colores, tipografía y formas NO están aquí: viven en tokens.css.
 * Cambiar la marca = editar este archivo + tokens.css + favicon.svg. Nada más.
 *
 * Este archivo se sembró desde docs/web-style-guide/Demo-team-match/brand.js y a
 * partir de ahí es del repositorio: la guía manda en la ESTRUCTURA (brand, nav,
 * medals, labels + t()), no en las cadenas, que son las de este proyecto.
 *
 * PLACEHOLDER = valor provisional; PENDIENTE = decisión sin tomar. No inventar valores.
 */

import { LOGO_SVG } from './logo.js';

/** Una sola definición por etiqueta: la usan los pips y las cabeceras de tabla. */
const MEDAL_LABELS = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze', honorable: 'Honorable' };

export const brand = {
  name: 'The First Global Alliance',
  lang: 'en',
  themeColor: '#3f51b5', // debe coincidir con --brand (el <meta> no puede leer CSS)
  favicon: '/assets/favicon.svg',

  // La marca de la barra. NO se escribe aquí: se genera del asset de la guía
  // (site/templates/logo.js, vía scripts/sync-style-guide.mjs) con viewBox
  // cuadrado y fill=currentColor, para que tome el color de la barra en la que
  // va y funcione en claro y oscuro. El dibujo es el del asset, sin tocar.
  logoSvg: LOGO_SVG,

  // Todos apuntan a rutas que existen. `/insights/` y `/search/` se construyen en
  // esta misma pasada; `href` (pipeline/emit/lib.mjs) sigue siendo el único sitio
  // donde se escriben las formas de URL, y estas deben coincidir con él.
  nav: [
    { label: 'Seasons', href: '/seasons/' },
    { label: 'Teams', href: '/teams/' },
    { label: 'Insights', href: '/insights/' },
    { label: 'Medals', href: '/medals/' },
    { label: 'Search', href: '/search/' },
  ],
  footerLinks: [
    { label: 'Seasons', href: '/seasons/' },
    { label: 'Teams', href: '/teams/' },
    { label: 'Insights', href: '/insights/' },
    { label: 'Medals', href: '/medals/' },
    { label: 'Search', href: '/search/' },
  ],
  attribution: 'Data provided by FIRST Global.',
  coverageDisclaimer: '', // PENDIENTE: texto legal/cobertura del pie
  license: '',            // PENDIENTE: licencia de los datos y del sitio

  // Emoji + texto SIEMPRE juntos (nunca solo uno de los dos).
  // "Honorable" no está en la referencia de TBA; símbolo elegido por el propietario.
  medals: {
    gold: { emoji: '🥇', label: MEDAL_LABELS.gold },
    silver: { emoji: '🥈', label: MEDAL_LABELS.silver },
    bronze: { emoji: '🥉', label: MEDAL_LABELS.bronze },
    honorable: { emoji: '🏅', label: MEDAL_LABELS.honorable },
  },

  // Todo texto fijo de la interfaz. Los templates usan t("clave"), nunca texto literal.
  labels: {
    ...MEDAL_LABELS,
    // Shell
    menu: 'Menu', skip: 'Skip to content', mainNav: 'Main', search: 'Search teams…',
    searchNav: 'Search', light: 'Light', dark: 'Dark', theme: 'Colour theme',
    // Navegación de sección
    teamInfo: 'Team Info', season: 'Season',
    // Identidad y datos
    entityType: 'Entity type', firstSeason: 'First season', seasonsActive: 'Seasons active',
    iso: 'ISO', medalsLabel: 'Medals', rank: 'Rank', record: 'Record', of: 'of',
    alliance: 'Alliance', awards: 'Awards', played: 'Played', winRate: 'Win rate',
    rankingScore: 'Ranking score', highestScore: 'Highest score', seasonValues: 'Season values',
    captain: 'Captain', pick: 'Pick', role: 'Role',
    // Cobertura
    covAwardsOnly: 'Only awards and the season summary are available for this season. The API holds no match data.',
    covStandingsOnly: 'Standings exist for this season but the matches behind them do not.',
    covUpcoming: 'This event has not been held yet.',
    covNone: 'No competition was held this season.',
    covShortAwards: 'Awards only', covShortStandings: 'Standings only',
    covShortUpcoming: 'Not yet held', covShortNone: 'No competition',
    recordCovers: 'Record covers',
    // Glifos de interfaz (la guía los fija: §3.19 flechas y ✓/✕, §3.12 "~").
    arrowLeft: '←', arrowRight: '→', tick: '✓', cross: '✕', approx: '~', menuGlyph: '≡',
    // Estados vacíos
    noData: 'No data', noMatches: 'No matches recorded.', noAwards: 'No awards recorded.',
    noStandings: 'No standings published.', neverCompeted: 'This team has never competed.',
    noPhoto: 'No photo yet', media: 'Media', noVideos: 'No video links recorded.',
    // Match
    stageRanking: 'Ranking', stageRoundRobin: 'Round robin', stageFinals: 'Finals',
    watchAllVideos: 'Watch all videos', endOfDay: 'End of Day', matchDetails: 'Match details',
    estimated: 'Estimated', field: 'Field', teams: 'Teams', score: 'Score',
    scheduledTime: 'Scheduled', result: 'Result', penalties: 'Penalties', minor: 'Minor',
    major: 'Major', noShow: 'No show', disqualified: 'Disqualified', red: 'Red', blue: 'Blue',
    tieResult: 'Tie', notPlayed: 'Not played', watch: 'Watch', finalScore: 'Final score',
    dqShort: 'DQ', nsShort: 'NS',
    breakdownNote: 'The arrow points to the higher side. Strong tone marks a total row, soft tone a detail row.',
    // Páginas
    seasons: 'Seasons', teamsIndex: 'Teams', teamNoun: 'teams', insights: 'Insights', medalsTable: 'Medals',
    year: 'Year', host: 'Host', theme: 'Theme', game: 'Game', dates: 'Dates', coverage: 'Coverage',
    total: 'Total', unclassed: 'Award', rankChange: 'Change', matchesLabel: 'Matches',
    awardsLabel: 'Awards', top10: 'Top 10', allMatches: 'All matches', seasonInsights: 'Insights',
    careerRecord: 'Career record', bestRank: 'Best rank', seasonsPresent: 'Seasons present',
    timeline: 'Timeline', never: 'Never', seasonsCount: 'Seasons', registry: 'In the registry',
    // Insights
    insightsAll: 'All-time insights', awardsByType: 'Awards by entity type',
    participationByType: 'Participation by entity type', seasonsDistribution: 'Seasons participated',
    mostAwarded: 'Most awarded teams', scoreDistribution: 'Score distribution',
    marginDistribution: 'Winning margin distribution',
    rankMovement: 'Rank movement', awardDistribution: 'Award distribution',
    allianceRoles: 'Alliance roles', mostImproved: 'Most improved',
    seriesAll: 'All matches', seriesPlayoffs: 'Playoffs', count: 'Count', share: 'Share',
    // Búsqueda
    noResults: 'No teams match.', resultsCount: 'teams', filterHint: 'Type to narrow the list.',
    allFields: 'All fields', fieldNoun: 'Field', shown: 'shown', stagesLabel: 'stages',
    // 404
    otherMatchesOnField: 'Other matches on this field',
    // 404
    notFoundTitle: 'Page not found', notFoundBody: 'That page does not exist in the archive.',
    // Pie
    generatedOn: 'Generated on', footerNav: 'Footer',
  },
};

/** Texto de interfaz. Falla en el build si falta la clave (así no se cuelan textos sueltos). */
export function t(key) {
  if (!(key in brand.labels)) throw new Error(`Falta la etiqueta de interfaz: "${key}" (añadir en brand.js)`);
  return brand.labels[key];
}
