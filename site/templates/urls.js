// ÚNICO módulo que construye rutas del sitio. Los templates no arman URLs a mano.
// Rutas: docs/web-style-guide/00-instrucciones-agentes.md §2
// Slug de match ({year}_{stage}{id}): docs/discovery/06-join-keys.md
import {brand} from '../brand/brand.js';

export const urls = {
  home:     ()    => '/',
  insights: (y)   => (y ? `/insights/${y}/` : '/insights/'),
  teams:    ()    => '/teams/',
  awards:   ()    => '/awards/',
  gameday:  ()    => '/gameday/',
  rankings: (y)   => `/rankings/${y}/`,
  matches:  (y)   => `/matches/${y}/`,
  team:     (c, y) => (y ? `/team/${c}/${y}/` : `/team/${c}/`),
  match:    (id)  => `/match/${id}/`,
  search:   ()    => '/search/',   // PENDIENTE: la página de resultados no está definida
  flag:     (iso) => brand.flagPath(iso),
  favicon:  ()    => brand.favicon,
  css:      ()    => '/site.css',  // archivo único que genera el build
};

/** Ruta de salida (sin barra inicial) a partir de una URL del sitio. */
export const outPath = (u) => u.replace(/^\//, '');
