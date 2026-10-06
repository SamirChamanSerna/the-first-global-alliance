/**
 * MASTER DE IDENTIDAD — nombre, logo, rutas y textos que se repiten en todo el sitio.
 * Colores, tipografía y formas NO están aquí: viven en tokens.css.
 * Cambiar la marca = editar este archivo + tokens.css + favicon.svg. Nada más.
 * PLACEHOLDER = valor provisional; PENDIENTE = decisión sin tomar. No inventar valores.
 */
export const brand = {
  name: "The FIRST Global Alliance",
  tagline: "A simple way to explore FIRST Global Challenge results.",
  // Bandera en minúsculas. HPE (equipo de refugiados) no tiene país: usa el asset
  // especial 10_hope. Ver docs/discovery/06-join-keys.md.
  flagPath: (iso) => `/flags/${({'10': '10_hope'}[iso] ?? iso).toLowerCase()}.svg`,
  lang: "en",                          // PENDIENTE: idioma de la interfaz (en / es)
  themeColor: "#3f51b5",               // debe coincidir con --brand (el <meta> no puede leer CSS)
  favicon: "/brand/favicon.svg",

  // PLACEHOLDER. Reglas: viewBox cuadrado, trazo con currentColor, sin colores propios.
  logoSvg: '<svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h7M9 12h5"/></svg>',

  // Solo rutas que existen en 03-pages.md. "Teams" apunta a /search/ (no hay índice de equipos en el MVP).
  nav: [
    { key: "insights", label: "Insights", href: "/insights/" },
    { key: "teams",    label: "Teams",    href: "/teams/" },
    { key: "awards",   label: "Awards",   href: "/awards/" },
    { key: "rankings", label: "Rankings", href: "/rankings/{season}/" },   // {season} = más reciente
    { key: "matches",  label: "Matches",  href: "/matches/{season}/" },
    { key: "gameday",  label: "GameDay",  href: "/gameday/" },
  ],
  footerLinks: [
    { label: "Insights", href: "/insights/" },
    { label: "Teams",    href: "/teams/" },
    { label: "Awards",   href: "/awards/" },
  ],
  attribution: "Data provided by FIRST Global.",
  coverageDisclaimer: "",              // PENDIENTE: texto legal/cobertura del pie
  license: "",                         // PENDIENTE: licencia de los datos y del sitio

  // Emoji + texto SIEMPRE juntos (nunca solo uno de los dos).
  medals: {
    gold:      { emoji: "🥇", label: "Gold" },
    silver:    { emoji: "🥈", label: "Silver" },
    bronze:    { emoji: "🥉", label: "Bronze" },
    honorable: { emoji: "",   label: "Honorable" },   // PENDIENTE: símbolo propio
    awarded:   { emoji: "",   label: "Awarded" },    // premio sin lugar (non-tiered)
  },

  // Todo texto fijo de la interfaz. Los templates usan t("clave"), nunca texto literal.
  labels: {
    menu: "Menu", search: "Search teams…", light: "Light", dark: "Dark",
    rank: "Rank", record: "Record", of: "of", alliance: "Alliance", awards: "Awards",
    rankingPoints: "Ranking points", rankingScore: "Ranking score", highestScore: "Highest score",
    teams: "Teams", score: "Score", watch: "Watch", watchAllVideos: "Watch all videos",
    endOfDay: "End of Day", matchDetails: "Match details", estimated: "Estimated",
    entityType: "Entity type", firstSeason: "First season", seasonsActive: "Seasons active",
    iso: "ISO", medals: "Medals", noData: "No data", noMatchData: "No match data",
    stageRanking: "Qualifications", stageRoundRobin: "Round robin", stageFinals: "Finals",
    generatedOn: "Generated on",
    season: "Season", seasons: "Seasons", overview: "Overview", matches: "Matches", team: "Team", total: "Total", year: "Year",
    venues: "Host venues", venue: "Venue", country: "Country", dates: "Dates", flagCol: "Flag", wlt: "W-L-T", avgScore: "Avg score",
    mapPlaceholder: "Map placeholder · pins at host countries", highestMatch: "Highest scoring match", avgMatch: "Average match score",
    avgMargin: "Average winning margin", playoffs: "Playoffs / Round Robin", topRank: "Top ranking", mostAwards: "Most awards",
    mostPlayoff: "Most playoff appearances", highestPlayoff: "Highest scoring playoff match", gamedaySoon: "GameDay · coming soon",
    officialSite: "Official site", reveal: "Game reveal video", thumbnail: "thumbnail 16:9", photo: "Team photo",
    bestRank: "Best rank", timeline: "Timeline", history: "History", water: "Water Conserved", parking: "Parking points", final: "Final score",
    alliances: "Alliances", back: "Team history", fullRanking: "Full ranking", tb1: "TB1 · Avg score", tb2: "TB2 · Wins", tb3: "TB3 · Points",
    field: "Field", key: "Key", tierGold: "Gold / 1st", tierSilver: "Silver / 2nd", tierBronze: "Bronze / 3rd", tierNone: "Non-tiered", noPlayoff: "Did not play playoffs", noAwards: "No awards", qualMetrics: "Qualification matches", players: "Teams", mockNote: "Mock data",
    noCompetition: "No competition was held this season",
  },
};

/** Texto de interfaz. Falla en el build si falta la clave (así no se cuelan textos sueltos). */
export function t(key) {
  if (!(key in brand.labels)) throw new Error(`Falta la etiqueta de interfaz: "${key}" (añadir en brand.js)`);
  return brand.labels[key];
}
