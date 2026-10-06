/**
 * MASTER DE IDENTIDAD — nombre, logo, rutas y textos que se repiten en todo el sitio.
 * Colores, tipografía y formas NO están aquí: viven en tokens.css.
 * Cambiar la marca = editar este archivo + tokens.css + tfga-icon.svg. Nada más.
 * PLACEHOLDER = valor provisional; PENDIENTE = decisión sin tomar. No inventar valores.
 */
export const brand = {
  name: "FGC Archive",                 // PLACEHOLDER
  lang: "en",                          // PENDIENTE: idioma de la interfaz (en / es)
  themeColor: "#3f51b5",               // debe coincidir con --brand (el <meta> no puede leer CSS)
  favicon: "/brand/tfga-icon.svg",

  // PLACEHOLDER. Reglas: viewBox cuadrado, trazo con currentColor, sin colores propios.
  logoSvg: '<svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h7M9 12h5"/></svg>',

  // Solo rutas que existen en 03-pages.md. "Teams" apunta a /search/ (no hay índice de equipos en el MVP).
  nav: [
    { label: "Seasons",  href: "/seasons/" },
    { label: "Teams",    href: "/search/" },
    { label: "Insights", href: "/insights/" },
    { label: "Medals",   href: "/medals/" },
  ],
  footerLinks: [
    { label: "Seasons",  href: "/seasons/" },
    { label: "Insights", href: "/insights/" },
    { label: "Medals",   href: "/medals/" },
    { label: "Search",   href: "/search/" },
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
    stageRanking: "Ranking", stageRoundRobin: "Round robin", stageFinals: "Finals",
    generatedOn: "Generated on",
  },
};

/** Texto de interfaz. Falla en el build si falta la clave (así no se cuelan textos sueltos). */
export function t(key) {
  if (!(key in brand.labels)) throw new Error(`Falta la etiqueta de interfaz: "${key}" (añadir en brand.js)`);
  return brand.labels[key];
}
