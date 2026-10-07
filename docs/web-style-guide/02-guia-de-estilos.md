# 02 — Guía de estilos (BORRADOR v3)

> Estado: **borrador basado en capturas** (equipo: light en tableta, dark en escritorio y móvil; match: light y dark en escritorio). Los valores marcados `≈` son estimaciones visuales y **no deben usarse como definitivos**. Cada uno se confirma con DevTools (§0) y pasa a ✅ cuando tiene evidencia.
> Único valor confirmado hasta ahora: **fondo dark `#1C1C1E`** (dado por el usuario).
> Alcance: `team-season`, `team-history` (apariencia), `match` e `insights`. Las demás rutas no se diseñan todavía.
> **Fuente de verdad del aspecto: `demo-team-match.html`.** Si esta guía y el demo difieren en markup o CSS, manda el demo y esta guía se corrige.
> Cambios de v1: corregida la lógica ganador/perdedor de la tabla de matches; dark añadido; reglas de imágenes y de tarjeta de video; "ligero" redefinido.
> Cambios de v3: Home con hero (§3.20), bloque de premios (§3.21), tarjetas KPI de 3 y de promedio ± desviación (§3.22), tabla de datos y selector de temporada (§3.23), regla «un match mencionado = tabla estándar» (§3.12), alianza numerada y premios con lugar en páginas de equipo (§3.24), colores de premio en `tokens.css`, masters `brand.js`/`tokens.css`. Los componentes nuevos tienen marcadores en el demo (sección «Componentes añadidos (v4)»).
> Cambios de v2: página de match (§3.19), referencia móvil (§3.1–3.3, §3.12), paletas light del desglose, y regla de que **solo los colores cambian entre light y dark, y son los mismos en escritorio y móvil**.

## 0. Cómo se confirma un valor

Para cada token `≈`: abrir la página de referencia, DevTools → *Computed*, y registrar en `tokens-observados.md`: selector, propiedad, valor, tema. Medir:

navbar · enlace de navbar (normal y activo) · campo de búsqueda · H1 de equipo · enlace de evento · texto de cuerpo · etiqueta de sección · caja de estadística · chip · badge verde · encabezado de etapa · celdas roja y azul **ganadora** y **perdedora** · marcador ganador y perdedor · fila "End of Day" · enlace de tabla · divisor · marco de foto · pie · variables `:root` y de la clase de tema oscuro.

Regla: si un valor no tiene evidencia, el agente escribe `SIN EVIDENCIA` y pregunta. No inventa.
La escala de las capturas es desconocida (zoom/DPI): **no se derivan px de ellas**, solo proporciones.

## 1. Principios

1. **Es una herramienta de datos, no una landing.** Densidad alta, texto pequeño, poco aire.
2. **El énfasis lo dan la tipografía y el fondo de celda.**
3. **Rojo/azul de alianza es el único color fuerte** del contenido. El resto es neutro + enlace azul.
4. **Un patrón por tipo de dato.** Todas las tablas, etiquetas y filas clave-valor salen de un solo componente.
5. **Ligero = sin animaciones, sin transiciones, sin sombras, sin degradados, sin blur.** Las imágenes sí están permitidas, solo donde aportan información (§3.15 y §3.16).
6. **Light y dark se definen a la vez** (prioridad de pulido: light). Entre light y dark **solo cambian los colores**: estructura, tamaños y espaciado son idénticos. Entre escritorio y móvil **los colores son los mismos**; solo cambia la maquetación.
7. **Funciona sin JS.** El tema se resuelve con `prefers-color-scheme` y una clase opcional.

## 2. Tokens

Variables CSS en **`site/brand/tokens.css`** (archivo maestro). Nombres cortos: `--rw` = red-win, `--rl` = red-lose, `--bw` = blue-win, `--bl` = blue-lose.

### 2.1 Color

| Token | Uso | Light | Dark | Estado |
|---|---|---|---|---|
| `--brand` | Barra de navegación | ≈ `#3F51B5` | igual | ≈ medir |
| `--brand-on` | Texto sobre la barra | `#FFFFFF` | `#FFFFFF` | ≈ medir |
| `--bg` | Fondo de página | `#FFFFFF` | **`#1C1C1E`** | dark ✅ |
| `--surface` | Cajas de estadística, chips, píldoras | ≈ `#F1F1F1` | ≈ `#2C2C2E` | ≈ medir |
| `--surface-2` | Encabezado de etapa, "End of Day", etiqueta de las filas *total* del desglose | ≈ `#E5E5E5` | ≈ `#3A3A3C` | ≈ medir |
| `--text` | Texto principal | ≈ `#212121` | ≈ `#FFFFFF` | ≈ medir |
| `--text-muted` | Etiquetas, subtextos, menú inactivo | ≈ `#757575` | ≈ `#9A9AA0` | ≈ medir |
| `--border` | Divisores, bordes de chips y selector | ≈ `#DDDDDD` | ≈ `#38383A` | ≈ medir |
| `--link` | Enlaces | ≈ `#2A3EB1` | ≈ `#4C9AFF` | ≈ medir |
| `--red-win` | Rojo saturado (alianza **ganadora**; fila *total* del desglose) | ≈ `#F6A79B` | ≈ `#B23A35` | ≈ medir |
| `--red-lose` | Rojo tenue (alianza **perdedora**; fila de *detalle*) | ≈ `#FFD9D4` | ≈ `#5A2420` | ≈ medir |
| `--blue-win` | Azul saturado (alianza **ganadora**; fila *total*) | ≈ `#A8C8F7` | ≈ `#3354B8` | ≈ medir |
| `--blue-lose` | Azul tenue (alianza **perdedora**; fila de *detalle*) | ≈ `#D3E2FB` | ≈ `#1F2D5C` | ≈ medir |
| `--ok` / `--ok-on` | Badge de estado positivo | ≈ verde / blanco | igual | ≈ medir |
| `--banner` | Banner de premio | ≈ `#0066B3` | igual | ≈ medir |
| `--frame` | Borde del marco de foto | ≈ gris suave | ≈ `#E5E5E5`, 2 px | ≈ medir |
| `--chart-a` | Serie "todos los matches" | ≈ azul | ≈ medir | falta dark |
| `--chart-b` | Serie "playoffs" | ≈ verde | ≈ medir | falta dark |
| `--gold` | Premio 1.er lugar / alianza ganadora | ≈ `#FFF2CC` | ≈ `#5A4A14` | ≈ medir (tomado de la imagen de premios) |
| `--silver` | 2.º lugar / finalista | ≈ `#EEEEEE` | ≈ `#3A3A3C` | ≈ medir |
| `--bronze` | 3.er lugar | ≈ `#FCE5CD` | ≈ `#5A3A1C` | ≈ medir |
| `--tier` | Premio sin lugar (non-tiered) | ≈ `#C9DAF8` | ≈ `#1F3157` | ≈ medir |

Contraste **WCAG AA** (4.5:1) en ambos temas, comprobado con herramienta. Ganadora y perdedora deben distinguirse entre sí **y** entre rojo y azul para daltonismo: la negrita + subrayado del marcador ganador y del equipo del visitante refuerzan el color, que no es el único canal.

**Los cuatro tonos rojo/azul se usan con dos lógicas distintas** (v2):
- *Tabla de matches y marcador:* saturado = alianza **ganadora**, tenue = **perdedora**.
- *Desglose del match:* saturado = fila **total**, tenue = fila de **detalle**, gane quien gane.
El texto sobre estos fondos es `--text` (oscuro) en light y blanco en dark.

### 2.2 Tipografía
- **Familia:** sans-serif (⚠️ medir `font-family`). No cargues fuentes de la web: pila del sistema `system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.
- Escala estimada (medir): cuerpo ≈ 14 px; tabla de matches ≈ 13–14 px; etiqueta de sección ≈ 12 px en mayúsculas con `letter-spacing` leve; título de evento ≈ 24–28 px; H1 ≈ 28–32 px.
- **Números tabulares** (`font-variant-numeric: tabular-nums`) en tablas, récord, rank y marcador.
- Pesos: 400 y 700.

### 2.3 Espaciado y forma
- Escala de 4 px (4, 8, 12, 16, 24, 32).
- Radios (medir): ≈ 8 px en cajas de estadística, marcos y selector; 999 px solo en chips y badges; 0–2 px en celdas de tabla.
- Bordes: 1 px `--border`. **Sombras: ninguna**, tampoco en Media (la referencia light tenía una muy leve; se omite por decisión del usuario).
- Proporciones en escritorio ancho, relativas al ancho del contenido principal: menú lateral ≈ 19%, separación ≈ 3%; dentro del bloque de evento, resumen : tabla ≈ 1 : 2 con hueco ≈ 3%. Insights usa un contenedor más estrecho (medir).

## 3. Componentes

Cada uno es una función en `site/templates/blocks.js`. Una sola implementación; prohibido crear variantes por página.

### 3.1 Barra de navegación
`--brand` de fondo, enlaces blancos con ícono pequeño, ítem activo con fondo un poco más oscuro. Búsqueda: campo con placeholder y atajo `Ctrl K` (teclas pequeñas) solo si hay JS. En móvil (referencia): logo + nombre + lupa + hamburguesa. El menú se despliega como panel `--brand` a ancho completo **sobre** el contenido; ítems en columna con ícono lineal a la izquierda y texto blanco grande (≈ 20 px), separados por una línea fina de tono más claro que `--brand`; esquinas inferiores muy redondeadas (≈ 24 px); la hamburguesa pasa a ×. Sin animación de apertura. Implementación con `<details>`, sin JS.
Ítems FGC: Seasons · Teams · Insights · Medals · Search.

### 3.2 Menú lateral de sección (scrollspy)
**Escritorio:** lista de anclas; activa en `--text` + negrita, resto `--text-muted`. Sin JS, todas en gris.
**Móvil (referencia; corrige v1, que decía "oculto"):** se sustituye por una **subbarra bajo la barra principal**: a la izquierda un botón con ícono de lista y la sección actual ("≡ Team Info") que despliega las anclas; a la derecha el selector de año (borde fino, radio ≈ 8). Sin JS, el botón es un `<details>`.

### 3.3 Cabecera de equipo
Logo/avatar cuadrado + H1 + estrella (favorito) + lista de datos (uno por línea, ícono lineal ≈ 16 px) + chips opcionales + foto a la derecha.
- **FGC:** la **bandera** ocupa el lugar del avatar y es el identificador principal. Datos: tipo de entidad, primera temporada, temporadas activas, códigos ISO.
- Marco de foto: proporción fija ≈ 4:3, borde `--frame`, radio ≈ 8, imagen en `contain` sobre el color de fondo del marco. En móvil va **debajo** del título y los datos.
- **Móvil (referencia):** avatar/bandera pequeña a la izquierda; título envuelto en varias líneas (≈ 28 px) con la estrella al borde derecho; datos en columna con ícono; **chips de redes centrados** y envueltos en filas (en escritorio, alineados a la izquierda); foto a ancho completo con su marco y puntos centrados; frase resumen; banners **dos por fila** (≈ 48% cada uno).
- Carrusel: ⚠️ decisión abierta. Opción más ligera: foto principal + enlace "N fotos" que lleva a Media, sin puntos ni deslizamiento.

### 3.4 Frase resumen
Una línea con cifras en negrita, entre dos divisores. Indica **denominador y cobertura** cuando es parcial.

### 3.5 Caja de estadística (`total`)
Fondo `--surface`, radio 8, centrada: etiqueta mayúscula pequeña `--text-muted`, valor grande en negrita, subtexto pequeño. **Máximo dos por fila** en el bloque de temporada (Rank, Record). En Home, Insights y Team Overview se permiten filas de 3 (`boxes c3`).

### 3.6 Etiqueta de sección + filas clave-valor
Etiqueta en mayúsculas ≈ 12 px `--text-muted`. Filas con nombre a la izquierda y valor a la derecha, sin bordes; la fila `Total` con línea superior y negrita.

### 3.7 Chip
Radio 999, 12–13 px. Redes sociales: relleno `--surface` en dark (en light, medir). Números o países de una alianza: relleno `--surface`, texto en negrita.

### 3.8 Badge de estado
Fondo `--ok`, texto blanco, radio 4–6. Solo para estados reales de los datos.

### 3.9 Medallas (`medalPip`)
**🥇🥈🥉 + texto** ("Gold", "Silver", "Bronze", "Honorable"), siempre juntos. "Honorable" no tiene emoji: definir símbolo propio y verificar render en Windows/iOS/Android. Alternativa propuesta: SVG inline de 14 px como respaldo.

### 3.10 Banner de premio
Rectángulo vertical `--banner`, texto blanco centrado en mayúsculas (símbolo, premio, año, temporada). Mismo color en light y dark. Fila centrada arriba; en móvil, de 2 en 2.
- La referencia repite el banner del evento ganado como tercera columna fuera del contenedor, en pantallas anchas. ⚠️ Decidir si se replica: propuesta, **no** replicarlo y dejar solo la fila de arriba.
- FGC: ⚠️ qué premio genera banner.

### 3.11 Bloque de temporada (equivalente al "bloque por evento")
Escritorio: resumen (1/3) + tabla de matches (2/3). Móvil: una columna con título → fecha/lugar → Rank/Record → Alliance → Awards → tabla.
FGC: normalmente **un bloque por temporada**, con etapas `ranking`, `round_robin`, `finals`. "Pool points" no aplica y se omite.

### 3.12 Tabla de matches (`matchList` / `matchRow`)
Estructura: encabezado de etapa en `--surface-2`, centrado y en negrita → filas compactas sin bordes → `play` | `etiqueta` | `3 celdas rojas` | `3 celdas azules` | `2 marcadores`.

**Color por resultado (corregido en v1):**
- La alianza que **ganó** el match: celdas de equipo y marcador en `--red-win` o `--blue-win`.
- La alianza que **perdió**: `--red-lose` o `--blue-lose`.
- **Marcador ganador:** negrita + subrayado. Marcador perdedor: peso normal.
- **Equipo del visitante:** negrita + subrayado en su celda, gane o pierda.
- Empate o partido sin jugar: ambas alianzas en tono neutro (propuesta; la referencia no lo muestra). Sin jugar: hora estimada y campo, **nunca `0–0`**. `no_show` y `disqualified` marcados, no ocultos.

Medidas: filas ≈ 26 px de alto; zona de clic ≥ 40 px en móvil sin agrandar la fila visible.
**Maquetación móvil (referencia):** cada match es una **fila de dos líneas**: a la izquierda ícono play y etiqueta; a la derecha, **la línea roja arriba y la azul debajo**, cada una con 3 equipos y su marcador al final. Encabezados de etapa y "End of Day" a ancho completo. Mismos tonos y marcas que en escritorio.
**FGC:** la celda lleva **bandera pequeña + código ISO de 3 letras**, no número. El diseño móvil de dos líneas (3 equipos + marcador por línea) hace viable bandera + código en 360 px. ⚠️ Probarlo; si no cabe, solo código, o scroll horizontal **dentro de la tabla**, nunca en `<body>`.
Puntitos de ranking points sobre el marcador: ⚠️ solo si los datos de FGC traen indicadores equivalentes; si no, se omiten.
"End of Day": fila centrada gris, solo si los datos traen día. `⌄`: enlace al match sin JS.

**Regla general (v3):** siempre que una página mencione un match concreto (Insights, rankings, equipo, etc.) se usa esta misma tabla (`matchRow`/`matchList`), con la alianza y el marcador ganadores resaltados. Nunca texto suelto ni una tabla distinta. En listas de varias fases, la última fase jugada va primero. En Insights, la tarjeta de video (§3.16) va **debajo** de la fila.

**Tamaño de alianza:** 3 equipos por alianza en **clasificatorias** y 4 en **round robin, playoffs y finales**. Las celdas se reparten el ancho por igual (`grid-auto-flow:column`) y su número sale de los datos, nunca fijo. El demo muestra ambos casos (la fila «Final 1» tiene 4 por alianza).

### 3.13 Tabla de datos (Insights)
Estilo de tabla de la beta: sin rejilla, encabezado en `--surface-2`, números a la derecha y tabulares, fila clave-valor cuando no hay encabezado. Columnas de listas de equipos ("Number | Teams"): enlaces separados por comas que fluyen en varias líneas. Tablas anchas: contenedor con `overflow-x: auto`.

### 3.14 Gráficas (Insights)
SVG inline, sin librería. Dos series (`--chart-a`, `--chart-b`), leyenda arriba, cuadrícula horizontal suave, ejes grises; líneas con puntos y relleno translúcido, barras agrupadas. Curva suavizada: ⚠️ si cuesta complejidad, líneas rectas son la desviación aceptable. Cada gráfica indica **denominador y cobertura** y tiene `<title>/<desc>`. Las series también se distinguen por forma del punto o trama, no solo por color. Sin animaciones de entrada.

### 3.15 Imágenes
**Dónde sí:** foto del equipo (cabecera y Media), miniaturas de video en matches destacados y en la página de match, banners/logos de programa. **Dónde no:** decoración, fondos, ilustraciones, imágenes de adorno.
Reglas técnicas:
- `<img>` con `width` y `height` (o `aspect-ratio`) para evitar saltos de maquetado; `loading="lazy"`; `decoding="async"`; `alt` descriptivo.
- La página debe ser **completamente usable con las imágenes bloqueadas**. Si una imagen falla o falta: caja plana `--surface` con el texto, sin shimmer ni esqueleto animado.
- Tamaños orientativos (propuesta): foto ≤ ≈ 150 KB, miniatura ≈ 320×180 y ≤ ≈ 40 KB, formato WebP/JPEG.
- Hover: sin zoom, sin elevación, sin transición. Visor/lightbox: solo si es instantáneo y opcional; si no, enlace a la imagen.
- Nota de tensión: `03-pages.md §4.6` pide "una petición por página". Se interpreta como **una petición de documento + CSS compartido**; las imágenes son peticiones diferidas y opcionales.

### 3.16 Tarjeta de video
Click en el video: enlace externo a la URL (con la marca de tiempo si existe), `rel="noopener"`. Embeber el reproductor al hacer clic es una mejora opcional con JS, ⚠️ pendiente de decidir.

**Variante A — con miniatura**
```
┌────────────────────────────┐
│                            │  16:9, miniatura en `cover`
│             ▶              │  ▶ = círculo plano de ≈ 48 px, fondo negro ≈ 65%,
│                            │      triángulo blanco. Sin sombra, sin blur.
└────────────────────────────┘
Final 1 · Daly Division          título: peso normal; subtítulo: gris pequeño
```
Toda la miniatura es el enlace. Foco visible con `outline`. Hover: subrayar el título, nada más. Sin degradado sobre la imagen.
Origen de la miniatura: **decidido — se enlaza directamente desde el CDN de YouTube**, `https://i.ytimg.com/vi/<id>/mqdefault.jpg`. Verificado: 320×180, `image/jpeg`, 10–15 KB, muy por debajo del tope de §3.15, y es una URL determinista que no necesita API ni clave. Es la misma decisión que las fotos de equipo (hotlink, no espejo), con el mismo compromiso asumido: cada visita hace una petición a un tercero y una miniatura borrada se ve como imagen rota. Para pasar a servirla desde el build habría que descargarla en un script y añadir 10 archivos al repo.

**Variante B — sin miniatura (marcador desglosado)**
```
┌────────────────────────────┐
│ Qual 20 · Hopper Division  │  etiqueta pequeña `--text-muted`
│ ┌───────────┬───────────┐  │
│ │    535    │    908    │  │  dos celdas con los tokens de la tabla de matches
│ │ 🇲🇽 MEX .. │ 🇦🇫 AFG.. │  │  (ganadora saturada, perdedora tenue); marcador 24–28 px
│ └───────────┴───────────┘  │  en negrita y tabular, el ganador subrayado
│ Auto 24 · Teleop 60 · …    │  hasta 3 componentes del `details`, solo si existen
│                  ▶ Watch   │  enlace de texto en `--link`, glifo ▶ delante
└────────────────────────────┘
```
Caja de fondo `--surface`, borde 1 px `--border`, radio 8, misma proporción 16:9 que la variante A para que ambas alternen en una lista sin saltos.

**Sin video:** misma tarjeta sin "▶ Watch", con el enlace "Match details" a la página del match.
La variante B se usa cuando no hay miniatura. La A, cuando sí la hay. Nunca se genera una miniatura falsa.

### 3.17 Aviso de cobertura (`coverageNotice`)
No existe en TBA. Banner con fondo `--surface` y borde izquierdo de 3 px en `--brand`. Texto seco. No usar rojo ni amarillo: no es un error.

### 3.18 Pie de página
Fila de enlaces separados por "/", selector de tema (sol/luna) a la derecha, línea gris de atribución con fecha de generación. FGC: atribución a FIRST Global, aviso de cobertura, licencia.

### 3.19 Página de match (`match`) *(v2)*

**Referencia:** en la beta el match es una **ventana modal sobre la página de equipo** (URL `/match/<id>`). **Aquí es una página completa** (`/matches/<year>/<stage>/<id>/`) que funciona sin JS; el modal se descarta porque depende de JS. ⚠️ Confirmar.

**Orden (escritorio):** título → dos columnas [desglose ≈ 47% | video ≈ 53%] → contexto (otros matches del campo ese día, según `03-pages.md §3.6`). Móvil (propuesta, sin referencia): marcador → video → desglose → contexto.

**1. Título.** Texto en `--link`, negrita, ≈ 22–24 px: "Quals 6 - Magnolia Regional 2026" → FGC: nombre del match + temporada. Debajo: hora programada (del venue y del visitante), campo y resultado.

**2. Marcador.** Encabezados "Teams" y "Score" en negrita, centrados, sin fondo. Dos filas, **roja arriba y azul debajo**: 3 celdas de equipo + una celda de marcador separada por un hueco pequeño, esquinas de ≈ 6 en los extremos. Ganadora `--*-win`, perdedora `--*-lose`. FGC: celda con bandera + código ISO; penalizaciones visibles si existen. Resaltar el equipo de origen (como el 4400 en negrita en la referencia) es una mejora opcional con JS vía parámetro de URL; sin JS no se resalta ninguno.

**3. Desglose (`breakdownTable`).** Tabla de tres columnas `rojo | etiqueta | azul` (≈ 27% / 46% / 27%). Tipos de fila:

| `kind` | Estilo |
|---|---|
| `detail` | Laterales en `--*-lose`; etiqueta normal sobre `--bg`; flecha ← → hacia el lado mayor (sin flecha en empate). |
| `total` | Laterales en `--*-win`; etiqueta en negrita sobre `--surface-2`; flecha. |
| `robots` | Fila alta (≈ 70 px): chip con el código del equipo y debajo su estado (`None (+0)`). Etiqueta centrada. |
| `chips` | Fila muy alta: chips apilados con ✕/✓ delante del código y el valor **junto a la etiqueta**; el lado azul es el espejo del rojo. |
| `bool` | ✓ o ✕ centrado en cada lado, íconos lineales. |

Filas de ≈ 40 px (escala de captura; medir). Chips: borde 1 px, radio 999, 12 px en negrita. La flecha **no es el único indicador** de quién va arriba: los valores siempre están a la vista.

**4. Video.** Es la página donde el video es contenido principal. La referencia incrusta el reproductor de YouTube (16:9, radio ≈ 8). ⚠️ Decidir entre: iframe directo (como la referencia; arrastra scripts de terceros) o la **tarjeta de §3.16 (A o B) que carga el reproductor al hacer clic**. Recomendación: tarjeta con carga al clic.

**5. Implicación para los datos.** En TBA las filas, etiquetas y tipo de fila están programadas por temporada. En `03-pages.md §3.6` el desglose se pinta de forma genérica, "sin código por año", y ahí **no existe `kind`**. Para reproducir esta tabla el pipeline debe entregar `breakdown.rows[] = { label, red, blue, kind, lead }`:
- `lead` (`"red"`, `"blue"` o `null`) se calcula en el build comparando los valores.
- `kind` lo aporta una **overlay por temporada** (datos, no código; mismo mecanismo que `pipeline/overlays/videos/<year>.json`).
- Sin overlay, todas las filas son `detail`.
⚠️ Decisión pendiente; afecta a `02-data-contract.md`.

### 3.20 Hero de la Home (`hero`) *(v3)*
Logo SVG (≈ 96 px, `currentColor`), nombre del sitio (≈ 44 px; 32 px en móvil) y eslogan (≈ 18 px, `--muted`), **todo centrado**, sin degradado, sombra ni animación. Los textos salen de `brand.js` (`name`, `tagline`, `logoSvg`). Solo existe en la Home; debajo van mapa, sedes y KPIs.

### 3.21 Bloque de premios (`awardBlock` + `awardKey`) *(v3)*
Referencia: imagen de premios del usuario. Cada premio es un recuadro con borde fino (radio `--r-cell`): **nombre** en negrita centrado, **descripción** en cursiva gris, y debajo una fila de celdas con el color del lugar. En escritorio van en 2 columnas (`.aws`), en móvil en 1. Encima, la leyenda **KEY**: Gold / 1st, Silver / 2nd, Bronze / 3rd, Non-tiered.
- *Premio de alianza* (ganadora, finalista, bronce): **una sola celda** con los equipos separados por comas, en el tono del premio.
- *Premio con podio:* tres celdas, oro-plata-bronce.
- *Premio sin lugar:* hasta tres celdas en `--tier`.
- Cada equipo: bandera + nombre enlazado.
- **Vista de temporada:** los ganadores de ese año. **Vista overview:** todos los equipos que han ganado ese premio en la historia, con **×N** si repitieron y coloreados por su **mejor** lugar; orden: lugar y luego veces ganado.
- Función `awardBlock(nombre, descripción, [[html, tono]…])`; tonos `gold|silver|bronze|awarded`.

### 3.22 Tarjetas KPI *(v3)*
Todo dato agregado de Insights va en una caja (`box`), nunca como texto suelto: p. ej. **Average match score** = valor grande `56.2` y debajo `± 13.8`; igual **Average winning margin**. Home, Insights y Team Overview usan filas de 3 (`boxes c3`); los promedios, filas de 2.

### 3.23 Tabla de datos y selector de temporada *(v3)*
- **`dt`:** encabezado `--surface-2`, filas separadas por una línea fina, columnas numéricas a la derecha y tabulares, contenedor con scroll horizontal propio. Con `sort=true` los encabezados reordenan con un script mínimo; sin JS queda en su orden inicial. Se usa en Teams, Awards, Rankings, Home e Insights.
- **`dd` (selector de temporada):** `<details>` con borde y flecha; la lista de enlaces se despliega debajo. Funciona sin JS y reemplaza al `<select>` en las páginas de contenido.
- **Rankings:** las columnas de ranking y desempate vienen de una **configuración por temporada** (no columnas fijas).

### 3.24 Alianza y premios en páginas de equipo *(v3)*
- **Alianza:** siempre con su **número** ("Alliance 2") y los compañeros enlazados; si no llegó a playoffs, "Did not play playoffs". Nunca vacío.
- **Premios del año:** una **lista** de filas clave-valor, con el nombre del premio a la izquierda y el lugar o medalla (`pip`) a la derecha; "Awarded" si no tiene lugar; "No awards" si no hay. Aplica a la línea de tiempo y a Team Season; Team Overview añade la lista completa por año.
- **Conteos de premios o medallas sin detalle:** solo en `/awards/` (y en los KPIs agregados que pide la especificación).

## 4. Responsive

Puntos de prueba: **360, 390, 768, 1280 y un escritorio ancho (≥ 1920)**. Nunca scroll horizontal en `<body>`.

| Elemento | Escritorio | Móvil |
|---|---|---|
| Menú de secciones | menú lateral sticky | subbarra "≡ sección · año" |
| Cabecera de equipo | foto a la derecha | foto debajo |
| Bloque de temporada | 2 columnas (1:2) | 1 columna |
| Tabla de matches | una línea por match, 6 celdas | fila de dos líneas (roja arriba, azul abajo) |
| Tarjeta de video | ancho de su columna | 100% del ancho, 16:9 |
| Pestañas de Insights | fila | scroll horizontal interno |
| Insights Qualification/Playoff | 2 columnas | apiladas |
| Barra de navegación | ítems visibles | lupa + hamburguesa; panel a ancho completo |
| Página de match | desglose y video en 2 columnas | una columna (propuesta): marcador, video, desglose |

⚠️ Referencia móvil disponible solo para la página de equipo. Match e Insights en móvil: pendientes.

## 5. Tema oscuro

Por indicación del usuario, **solo cambian los colores** (fondo `#1C1C1E`, tablas, texto); estructura, espaciado y componentes son idénticos. Los colores son los mismos en escritorio y móvil.
- Mismos nombres de token; solo cambian valores (§2.1).
- Se respeta `prefers-color-scheme` y hay selector manual.
- Alianza roja/azul: tonos propios de dark; no inversión automática. Verificar contraste de marcador y subrayado.
- Banners y miniaturas no cambian con el tema.

## 6. Adaptaciones a FGC

| Tema | TBA | Nuestro sitio |
|---|---|---|
| Identificador de equipo | número | bandera + nombre; código ISO en tablas |
| Evento | varios por año | uno por temporada, con etapas |
| Pool points | existen | no existen: se omiten |
| Puntitos de RP | existen | solo si hay datos equivalentes |
| Banners | victorias de evento | ⚠️ por definir |
| Medallas | no aplican | 🥇🥈🥉 + texto (+ Honorable) |
| Cobertura | datos completos | `coverageNotice` donde sea parcial |
| Premios | banners por victoria de evento | bloques por premio con lugar (§3.21) |
| Alianza | número de alianza | «Alliance N» + compañeros (§3.24) |
| Datos faltantes | — | estado explícito, nunca 0 |
| Videos | enlaces e incrustados | miniatura o marcador desglosado, con enlace |

## 7. Anti-patrones (prohibido)

- Degradados, glassmorphism, sombras, blur, texto con gradiente.
- Animaciones, transiciones, efectos de entrada, hover con elevación o zoom, esqueletos con shimmer.
- Hero grande (**única excepción: la Home, §3.20**), secciones centradas con mucho aire, tarjetas dentro de tarjetas.
- Métricas con número enorme en cuadrículas de tarjetas.
- Íconos de librería en círculos de color; un ícono por ítem de lista.
- Emojis como íconos de interfaz (excepto las medallas).
- Badges de píldora por todas partes.
- Capas de degradado o texto superpuesto sobre las miniaturas.
- Imágenes decorativas o de stock.
- Colores que no salgan de `tokens.css`.
- Copy de marketing.
- Clases, colores o componentes no listados en esta guía.

## 8. Presupuesto de peso

- CSS compartido **< 15 KB** sin comprimir.
- HTML de página, sin contar datos ni imágenes: **< 50 KB**.
- Cero JS obligatorio; cero fuentes remotas.
- Imágenes: solo las de §3.15, diferidas y con dimensiones; tamaños orientativos allí.
- Banderas SVG inline o sprite único; chips ISO como respaldo.

## 9. Decisiones abiertas

1. ¿Qué premio genera banner? ¿Se replica el banner a la derecha del bloque?
2. ¿Idioma de la interfaz? (inglés / español)
3. Símbolo para "Honorable" y SVG de respaldo para medallas.
4. Gráficas: curva suavizada o rectas.
5. Celda de equipo en móvil: bandera + código, solo código, o scroll interno.
6. Foto de cabecera: carrusel o foto única + enlace a Media.
7. Miniaturas de video: enlace directo a YouTube o copia propia en el build.
8. Clic en video: abrir YouTube o cargar el reproductor en la página. En la página de match, la referencia incrusta directamente; propuesta: tarjeta con carga al clic.
9. Match como **página completa** (propuesta) en vez de modal.
11. En la columna «Menciones» de Awards se suman las menciones honoríficas y los premios sin lugar; confirmar.
10. ¿Overlay por temporada con `kind` para el desglose, o todas las filas como `detail`? (afecta al contrato de datos)

### Decisiones resueltas
- **Rutas:** mandan las de la especificación funcional nueva (ver `00-instrucciones-agentes.md §2`); `03-pages.md` quedó obsoleto en rutas y plantillas.
- **KPIs de Team Overview:** se mantienen, junto con la lista completa de premios por año.
- **Tamaño de alianza:** 3 en clasificatorias, 4 en round robin, playoffs y finales.
