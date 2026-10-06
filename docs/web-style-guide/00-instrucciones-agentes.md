# 00 — Instrucciones para agentes: construir las páginas del sitio

> Léelo completo antes de tocar código. Si algo no está aquí o en los documentos que enlaza, **pregunta**; no lo inventes.
> Proyecto: *The FIRST Global Alliance*, un archivo de resultados de FIRST Global Challenge con el estilo funcional de The Blue Alliance (TBA).

## 0. Orden de lectura y qué manda

1. Este archivo.
2. `02-guia-de-estilos.md` (reglas y decisiones de diseño).
3. `demo-team-match.html` (ábrelo en light y dark, a 1280 px y a 390 px).
4. `01-descripcion.md` (qué se ve en las páginas de referencia de TBA; solo consulta).
5. La especificación funcional del proyecto (pantallas y contenido) y `02-data-contract.md` (forma de los datos).

| Tema | Manda |
|---|---|
| Aspecto: markup, CSS, colores | `demo-team-match.html` y los archivos de `site/` |
| Reglas y decisiones de diseño | `02-guia-de-estilos.md` |
| Rutas y contenido de cada pantalla | la especificación funcional (§2 de este archivo la resume) |
| Forma de los datos | `02-data-contract.md` |

**`03-pages.md` está obsoleto en rutas y plantillas.** De ahí solo se conservan como principios, mientras no contradigan lo anterior: declarar la cobertura cuando un dato es parcial, no mostrar estados vacíos por falta de datos, y funcionar sin JavaScript.
Si dos fuentes se contradicen, **no decidas**: repórtalo.

## 1. Reglas inviolables

1. **Copiar, no reescribir.** El markup sale de los bloques de `site/templates/blocks.js` o del demo (§5). No rediseñes componentes.
2. **Las clases CSS son la API.** No las renombres ni inventes otras. Si un componente nuevo necesita una clase, se propone primero (§8).
3. **Sin estilos en línea.** Prohibido el atributo `style=`.
4. **Sin colores, fuentes ni radios literales** fuera de `site/brand/tokens.css`. En `components.css` y en los templates solo `var(--…)`.
5. **Sin textos de interfaz ni de marca literales** en los templates: usa `t("clave")` y `brand.*` de `site/brand/brand.js`.
6. **Ligero:** sin animaciones, transiciones, sombras, degradados ni blur. Imágenes solo donde aportan (fotos de equipo, miniaturas de video), con `width`/`height` y `loading="lazy"`.
7. **Funciona sin JavaScript.** El JS solo mejora (ordenar tablas, cambiar tema).
8. **No inventes datos ni nombres de campo.** Si falta un campo, pregunta.
9. **Dato faltante = estado explícito** ("No data", "Did not play playoffs", "No awards"), nunca `0`, `0–0` ni un hueco.
10. **Las páginas que no están en §2 no se construyen.**
11. Ante la duda, **pregunta**.

## 2. Rutas y pantallas (las de la especificación funcional son las correctas)

URLs en minúsculas salvo `{team_code}` (ISO Alpha-3 en mayúsculas, p. ej. `MEX`; **supuesto**, confirmar), con barra final.

| Ruta | Plantilla (`pages.js`) | Contenido |
|---|---|---|
| `/` | `home` | Hero centrado (logo, nombre, eslogan) → mapa de sedes → lista de sedes (año, sede, país, fechas; enlaza a `/insights/{season}/`) → KPIs globales |
| `/insights/` | `ins()` | Overview histórico |
| `/insights/{season}/` | `ins(y)` | Insights de una temporada |
| `/teams/` | `teams` | Directorio por 5 continentes (África, América, Asia, Europa, Oceanía) |
| `/awards/` | `awards` | Tabla acumulativa de premios, ordenable |
| `/rankings/{season}/` | `rankings(y)` | Ranking de la temporada (más reciente por defecto) |
| `/matches/{season}/` | `matches(y)` | Todos los partidos, última fase primero |
| `/gameday/` | `gameday` | **Futuro**: solo un marcador de posición |
| `/team/{team_code}/` | `th(c)` | Histórico del equipo (KPIs + línea de tiempo + lista de premios) |
| `/team/{team_code}/{season}/` | `ts(c,y)` | Equipo en una temporada |
| `/match/{season}_{match_key}/` | `mp(m)` | Detalle de partido; ej. `/match/2025_q12/` |

Barra superior en todas: nombre/logo, navegación (`brand.nav`), buscador (equipo, año o evento). **La página de resultados de búsqueda aún no está definida**; el formulario apunta a `/search/` y queda pendiente (§8).

### Contenido por pantalla (resumen operativo)

- **Home:** el hero va **centrado y grande**, con el SVG del logo (`hero()`). Única página con hero. KPIs en `boxes c3`.
- **Insights** (overview y temporada comparten plantilla; cambia el origen de los datos):
  1. Selector de temporada (`dd`) con "Overview" + años.
  2. Datos del evento y enlace oficial (`first.global/archive/fgc-{year}/`; en overview, `first.global/about/`). Video de revelación: miniatura + enlace.
  3. KPIs rápidos: equipos, partidos, premios.
  4. **Premios** con `awardKey()` + `awardBlock()` (§6). Temporada: ganadores del año. Overview: todos los equipos que han ganado cada premio.
  5. **Partido de mayor puntaje:** la **tabla estándar de match** (una fila) y la **tarjeta de video debajo**.
  6. **Promedios** en tarjetas: *Average match score* y *Average winning margin*, con la desviación estándar como subtexto (`56.2` / `± 13.8`). Nunca texto suelto.
  7. Playoffs: temporada = lista de partidos con la tabla estándar; overview = top 5 de equipos con más apariciones.
  8. Ranking: temporada = top con enlace a `/rankings/{season}/`; overview = top 10 con más premios.
- **Awards:** única página donde los premios se muestran **solo como conteo** (oro, plata, bronce, menciones, total). Encabezados ordenables.
- **Rankings:** las columnas de ranking y desempate vienen de una **configuración por temporada** (arreglo de columnas), no de columnas fijas.
- **Matches:** orden de fases: **Finals → Round Robin → Qualifications**.
- **Team Overview:** cabecera, selector de temporadas, KPIs (partidos, premios, récord W-L-T con %, mejor ranking, medallas), **línea de tiempo** (más reciente arriba) y la **lista completa de premios por año**. Cada año: ranking, récord, **alianza con su número**, **premios con su lugar**, puntaje más alto y promedio.
- **Team Season:** igual que un año de la línea de tiempo, más la tabla estándar de todos los partidos del equipo, con el equipo resaltado.
- **Match:** marcador, **desglose** (§6), video, enlaces a los equipos.

## 3. Archivos maestros (marca) y cómo cambiarla

| Archivo | Contiene |
|---|---|
| `site/brand/tokens.css` | **Todos** los colores (claro/oscuro), tipografía y formas |
| `site/brand/brand.js` | Nombre, eslogan, logo SVG, favicon, navegación, enlaces del pie, ruta de banderas, medallas (emoji + texto), y **todos los textos fijos** (`labels`) |
| `site/brand/favicon.svg` | Favicon |

**Cambiar la marca = editar solo esos tres archivos.** Pasos: (1) nombre, eslogan y logo en `brand.js`; (2) colores en `tokens.css` (`--brand`, `--brand-on`) y el mismo valor en `brand.themeColor`; (3) `favicon.svg`; (4) idioma: `brand.lang` y los textos de `labels`. **Nunca** se toca `components.css` para cambiar la marca. Si un componente necesita un color nuevo, primero se añade el token.

Banderas: `brand.flagPath(iso)` → `/flags/{iso}.svg`, **en minúsculas (supuesto)**. Si el archivo falta, el marco gris de `.fl` evita el hueco. Los SVG los pone el equipo del proyecto; el build de prueba genera placeholders.

## 4. Estructura de archivos

```
docs/web-style-guide/   00 (este) · 01 · 02 · demo-team-match.html
site/brand/             tokens.css · brand.js · favicon.svg        ← MAESTROS
site/css/components.css estilos de todos los bloques (solo var(--…))
site/templates/blocks.js  bloques compartidos (markup del demo)
site/templates/pages.js   una función por pantalla (compone bloques)
site/mock/mock.js         datos ficticios (se reemplaza por los reales)
site/build-mock.js        genera site/dist/ para previsualizar
```
Previsualizar: `node site/build-mock.js` y abrir `site/dist/index.html` (requiere Node 20+; `site/package.json` ya declara módulos ES). El CSS final es **un solo archivo** (`site.css` = `tokens.css` + `components.css`).

### Forma de los datos que consumen las plantillas
`pages.js` importa de `mock.js` estas estructuras. La capa de datos real debe exponerlas **con la misma forma** (mapeando desde `02-data-contract.md`):

| Nombre | Forma |
|---|---|
| `seasons[]` | `{y, name, city, country, iso, dates}` (más reciente primero) |
| `T[code]` | `[nombre, continente]` |
| `M[y][]` (partidos) | `{id, href, y, stage: ranking\|round_robin\|finals, label, field, time, red[], blue[], rs, bs, bd[4], video}`; `rs`/`bs` = `null` si no se ha jugado |
| `S[y][]` (posiciones) | `{code, rank, w, l, t, pts, n, rp, avg}` |
| `AL[y][]` (alianzas) | arreglo de alianzas; cada una, arreglo de códigos. La posición + 1 = número de alianza |
| `A[y][]` (premios) | `{name, desc, ty: 'a'\|'p'\|'n', tier, w[]}`: `a` alianza (un tono para todos), `p` podio (oro-plata-bronce), `n` sin lugar |

**Tamaño de alianza:** 3 equipos por alianza en **clasificatorias** y 4 en **round robin, playoffs y finales**. Las celdas salen del largo de `red[]` y `blue[]`; no fijes el número.
Pendiente de refactor (Etapa 1): hoy `blocks.js` arma algunas URL (`/team/…`). Debe haber **un solo módulo de URL** (`site/templates/urls.js`) o campos `href` precalculados en los datos; los templates no construyen URL por su cuenta.

## 5. Cómo copiar del demo

El demo marca cada componente con `<!-- @component:NOMBRE -->` … `<!-- @end:NOMBRE -->`.

| Marcador | Función en `blocks.js` | Notas |
|---|---|---|
| `nav`, `footer` | `layout()` | Barra superior (con buscador) y pie con selector de tema |
| `hero` | `hero()` | Solo Home |
| `match-table` | `matchList()` / `matchRow()` | **Tabla estándar de match**: play, código, alianza roja, alianza azul, marcador. Ver §7 |
| `scoreboard` | `scoreboard()` | Marcador en la página de match |
| `breakdown` | `breakdown()` | Desglose de puntaje (§6) |
| `video-thumb` / `video-fallback` | `videoThumb()` / `videoFallback()` | Con miniatura / sin miniatura (marcador + «Watch») |
| `award-block` | `awardKey()` + `awardBlock()` | Premios |
| `kpi-boxes` | `box()` / `boxes()` | KPIs y promedios ± desviación |
| `award-rows` | `kvr()` + `pip()` | Premio + lugar; alianza |
| `dropdown` | `dd()` | Selector de temporada (sin JS) |
| `data-table` | `dt()` | Tablas de datos, ordenables con `sort=true` |
| `team-header`, `summary`, `coverage`, `season-block`, `section-bar`, `side-menu`, `match-page` | — | Referencia de la primera maqueta; **las plantillas actuales no los usan tal cual** |

**Permitido:** sustituir los textos de ejemplo por datos escapados (`e()`), repetir filas con un `map`, poner `href` desde los datos.
**Prohibido:** renombrar clases, añadir `style=`, cambiar el orden de elementos de un bloque, añadir colores.

## 6. Reglas de los bloques con más riesgo

**Tabla estándar de match** (`matchRow`). Siempre que una página mencione **un match concreto** (listas, Insights, equipo, rankings) se usa esta fila; nunca texto suelto ni otra tabla.
- Columnas: ▶ video (solo si hay video) · código (enlace al match) · equipos de la alianza roja · equipos de la alianza azul · marcador rojo · marcador azul.
- Cada equipo: `teamCell` = bandera + código ISO.
- **Alianza ganadora:** celdas y marcador en el tono saturado; marcador en negrita y subrayado. **Perdedora:** tono tenue. Empate o sin jugar: tono neutro.
- **Sin jugar:** hora estimada y campo en el subtexto y `–` en lugar de marcador. Nunca `0–0`.
- El equipo de la página (si existe) va en negrita y subrayado, gane o pierda.
- En Insights, la **tarjeta de video va debajo** de la fila.
- Fases en listas: Finals → Round Robin → Qualifications.

**Desglose** (`breakdown`, tabla rojo | etiqueta | azul). Fila *total* = tono saturado en ambos lados y etiqueta en negrita sobre `--surface-2`; fila *detalle* = tono tenue. La flecha ← → apunta al lado con el valor mayor y no aparece en empate. Los tipos de fila (`detail`, `total`, `robots`, `chips`, `bool`) están en la guía §3.19. Mientras no exista una overlay por temporada que diga el tipo de cada fila, **todas se pintan como `detail`** (decisión pendiente).

**Premios.** `awardBlock(nombre, descripción, [[html, tono]…])`, tonos `gold|silver|bronze|awarded`.
- Alianza: una celda con los equipos separados por comas. Podio: 3 celdas. Sin lugar: celdas en `awarded`.
- Overview: todos los equipos que han ganado ese premio, con `×N` si repiten y el color de su **mejor** lugar.
- **Equipo/temporada:** el premio se muestra **con su lugar** (`kvr` + `pip`); jamás solo la medalla ni solo un conteo. Los conteos solo en `/awards/` y en los KPIs de Team Overview.

**Alianza en páginas de equipo:** "Alliance N" + compañeros enlazados (N = posición + 1 en `AL`); si no llegó: "Did not play playoffs".

**Medallas:** emoji + texto juntos (`brand.medals`). "Honorable" y "Awarded" no tienen emoji; van solo con texto.

## 7. Etapas de trabajo (para en cada punto de control)

1. **Etapa 0, verificación.** Ejecuta `node site/build-mock.js` y abre `site/dist/`. Comprueba light, dark, 1280 px y 390 px. Reporta cualquier defecto antes de seguir.
2. **Etapa 1, datos y URL.** Escribe el adaptador de datos reales con las formas de §4 y centraliza las URL en un módulo. **No** cambies los bloques.
3. **Etapa 2, páginas con datos reales.** Genera las 11 pantallas de §2. Prueba con una temporada completa, una con datos parciales y un equipo sin playoffs.
4. **Etapa 3, pendientes** (solo con aprobación): resultados de búsqueda, mapa de sedes real, carrusel de fotos del equipo, GameDay, miniaturas y videos reales.

## 8. Componentes nuevos o dudas

Si necesitas un componente que no está en el demo ni en `blocks.js`:
1. **No lo construyas.** Escribe `docs/web-style-guide/05-componentes-pendientes.md` con: nombre, para qué página, boceto ASCII, tokens que usaría y datos que necesita.
2. Espera aprobación.

Pendientes conocidos: página de resultados de búsqueda, mapa de sedes, carrusel de fotos, GameDay, tipos de fila del desglose, símbolo de "Honorable".

## 9. Checklist de entrega (cada etapa)

```
node site/build-mock.js                                              # sin errores
grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(' site/css/components.css       # vacío
grep -rn 'style=' site/templates                                     # vacío
grep -rn 'The FIRST Global Alliance' site --include=*.js | grep -v brand.js   # vacío
```
- [ ] Light y dark correctos; contraste AA.
- [ ] 360, 390, 768, 1280 px sin scroll horizontal en `<body>`.
- [ ] Todo funciona con JS desactivado (las tablas ordenables quedan en su orden inicial).
- [ ] Ningún texto de interfaz suelto; ninguna URL armada a mano en un template.
- [ ] Alianzas con el número correcto de equipos (3 en clasificatorias, 4 en playoffs/finales).
- [ ] Premios con lugar en páginas de equipo; conteos solo en Awards y KPIs.
- [ ] Estados vacíos y datos parciales con aviso explícito.
- [ ] Lista de dudas y de cosas «SIN EVIDENCIA» al final del reporte.

## 10. Errores típicos (no los cometas)

- Reescribir el CSS o el HTML «a tu manera» en lugar de copiar.
- Pintar la alianza del equipo visitante como ganadora: **el tono saturado es de quien ganó el match**.
- Mostrar `0–0` en partidos sin jugar o `0` donde no hay dato.
- Usar emojis de bandera (Windows no los muestra): las banderas son SVG.
- Mostrar un premio solo como medalla o como número fuera de `/awards/`.
- Fijar 3 equipos por alianza en playoffs y finales.
- Poner el video **encima** de la tabla de match en Insights.
- Dejar un `<select>` que navega con JS donde va el selector `dd`.
- Añadir una librería de gráficas, de íconos o una fuente web.
