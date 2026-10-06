# 01 — Descripción de las páginas de referencia

> Fuente: tres capturas: (1) equipo beta en **light**, página completa, ancho de tableta; (2) Insights clásico en **light**, página completa; (3) equipo beta en **dark**, escritorio ancho, solo la parte superior de la página; (4) match de la beta (se abre como modal) en **light y dark**, escritorio; (5) equipo beta en **dark**, móvil, página completa y con el menú abierto.
> **v1:** corregida tras ver la captura de escritorio. Las correcciones llevan la marca *(v1)*; ver también §A.9.
> **v2:** añadidas la página de match (§E) y la maquetación móvil (§F). Dato del usuario: entre light y dark **solo cambian los colores**, y los colores son **los mismos en escritorio y móvil**.
> Todo lo que sigue describe lo visible en esas capturas. Los valores numéricos (px, colores) son **estimaciones**; se marcan `≈` y deben verificarse con DevTools antes de fijarse (ver `02-guia-de-estilos.md`).
> Nota: la captura de la página de equipo repite el menú lateral varias veces. Es un efecto de la captura de página completa sobre un elemento *sticky*; en pantalla es un solo menú.

## Cobertura de la referencia

| Página | Referencia | Estado de la evidencia |
|---|---|---|
| Equipo / año | `beta.thebluealliance.com/team/4400` | Light (tableta); dark en escritorio (parte superior) y en móvil (completa, con menú abierto). Falta CSS computado |
| Match | beta TBA, `/match/<id>` (modal) | Light y dark en escritorio; desglose visible hasta «Traversal Bonus». Falta móvil, la parte inferior del desglose y lo que hay bajo el video |
| Insights | `thebluealliance.com/insights/2026` (sitio clásico, no la beta) | Solo light. Dark: el usuario indica que solo cambian el fondo y los colores de tablas y texto. Falta CSS computado |
| Historical Timeline | agameserver (solo estructura) | No hay captura |

---

## A. Página de equipo (beta) — `/team/4400/2026`

### A.1 Estructura general
Una sola columna de contenido centrada sobre fondo blanco, con un **menú lateral izquierdo estrecho** (selector de año + índice de secciones). Todo es denso: texto pequeño, poco aire entre líneas, separación entre secciones mediante **líneas horizontales finas** y títulos, no mediante tarjetas.

### A.2 Barra de navegación
- Barra a todo el ancho, color **índigo/azul** (≈ `#3F51B5`), texto blanco.
- Izquierda: ícono + "The Blue Alliance". Luego ítems con un ícono pequeño delante de cada uno: myTBA, Events, Teams, Districts, GameDay, Insights.
- Derecha: enlace pequeño "Leave beta" y un **campo de búsqueda blanco** con texto gris "Search teams and events..." y el atajo `Ctrl K` a la derecha.
- Altura ≈ 44–48 px. Sin sombra marcada.

### A.3 Menú lateral
- Arriba: un `<select>` de año ("2026") con borde fino, esquinas poco redondeadas.
- Debajo: lista vertical de anclas ("Team Info", "Magnolia", "Regional Laguna", "Newton"). La sección **activa va en negro y negrita**, las demás en **gris**. Sin fondo, sin viñetas. Comportamiento de *scrollspy* (probablemente sticky, verificar).

### A.4 Cabecera del equipo
- **Título H1** grande, peso normal-medio: "Team 4400 - Cerbotics - Peñoles", con un **logo/avatar cuadrado del equipo** a la izquierda (borde azul fino, alto ≈ el del H1) y una **estrella vacía** (favorito) a la derecha. *(v1: el avatar faltaba.)*
- Debajo, una lista de datos, **un dato por línea**, cada uno con un ícono lineal pequeño a la izquierda:
  - ubicación (enlace azul),
  - escuela con "with 4 sponsors" y un chevron para expandir,
  - "Rookie Year: 2012",
  - enlaces externos ("Details on FRC Events", "Statbotics", "Match13") en azul.
- Fila de **chips de redes sociales**: esquinas muy redondeadas, ícono de la red + usuario, letra pequeña en negrita. En dark son **píldoras con relleno gris oscuro y sin borde visible**; en light la captura no permite distinguir si llevan contorno o relleno claro (verificar). Al final un chip "+ Add". *(v1)*
- A la derecha: **carrusel de foto** en un marco de proporción fija (≈ 4:3, apaisado) con borde y esquinas redondeadas. La foto se ajusta *dentro* del marco (`contain`): las que no encajan quedan con barras del color de fondo. 3 puntos de paginación debajo (el activo, más claro). *(v1: se corrige «4:5 vertical».)*
- Debajo de la cabecera, línea horizontal fina y una **frase resumen** con las cifras clave en negrita: "Team 4400 was 35-8 overall in 2026. In the regional pool, they ranked #8 with 169 points."

### A.5 Banners de premios ganados
- Rectángulos verticales **azul oscuro sólido** (≈ 125×210 px), centrados en fila, que imitan los banners físicos de los eventos: logo del programa arriba, "WINNER", año y nombre del evento en mayúsculas, texto blanco centrado.
- Solo aparecen para victorias de evento.
- En escritorio ancho, **cada bloque de evento ganado repite su banner como tercera columna a la derecha de la tabla**, fuera del contenedor principal (visto en la captura dark). En tableta no aparece. Verificar si es columna prevista o efecto del ancho. *(v1)*

### A.6 Bloque por evento (se repite por cada evento del año)
Dos columnas: **izquierda ≈ 1/3 (resumen), derecha ≈ 2/3 (tabla de matches)**. Entre bloques, línea horizontal fina.

**Columna izquierda**
1. **Nombre del evento** como enlace azul, tamaño grande (≈ 24 px), puede ocupar 2 líneas.
2. Fecha con ícono de calendario, un chip pequeño gris "Week 3" y un menú "…". Debajo, ubicación con ícono de pin, enlace azul.
3. **Dos cajas de estadística** una junto a la otra: fondo gris muy claro (≈ `#F1F1F1`), esquinas redondeadas (≈ 8 px), sin borde. Contenido centrado: etiqueta en **mayúsculas pequeñas grises** ("RANK" / "RECORD"), **número grande en negrita** ("1", "14-0-0"), y subtexto pequeño gris ("of 46", "37 RP").
4. Etiqueta de sección en **mayúsculas pequeñas grises** ("ALLIANCE 1") y a su derecha **chips redondeados grises** con los números de equipo.
5. "AWARDS": misma etiqueta de sección, y debajo los nombres de premio como texto normal, uno por línea (con "sponsored by …" en la misma línea).
6. "REGIONAL POOL POINTS": etiqueta de sección + **badge verde** ("Qualified", texto blanco, esquinas redondeadas) alineado a la derecha. Debajo, **filas etiqueta-izquierda / número-derecha** (Quals, Alliance, Playoff, Award), una línea fina y una fila **Total en negrita**.
   - El último evento del año (sin puntos) omite esta sección.

**Columna derecha: tabla de matches**
- Agrupada por etapa. Cada etapa tiene una **fila de encabezado** con fondo gris claro y el nombre centrado en negrita ("Qualifications", "Semifinals", "Finals"). En la de clasificatorias, a la derecha, "Watch All Videos" con un ícono de video en gris.
- Columnas de cada fila, de izquierda a derecha:
  1. **Ícono de play** en círculo azul (enlace al video).
  2. **Etiqueta del match** centrada ("Quals 6", "Match 7", "Finals 2").
  3. **Tres celdas de la alianza roja** con el número de equipo, fondo rojo claro.
  4. **Tres celdas de la alianza azul**, fondo azul claro.
  5. **Dos celdas de marcador** (rojo, azul). El marcador de la alianza ganadora va en **negrita y subrayado**.
  6. Sobre cada marcador hay unos **puntitos pequeños** (indicadores de ranking points).
- **Alianza ganadora vs. perdedora** *(v1: corrige mi descripción anterior, que atribuía el tono saturado a la alianza del visitante)*: las **celdas de equipo y el marcador de la alianza que ganó el match van en el tono saturado** de su color; la alianza que perdió va en un tono tenue. Inferido de las filas donde el equipo perdió (una final perdida en la captura light): su alianza aparece tenue y la rival saturada. Confirmar con un match perdido en dark.
- **Equipo del visitante (4400):** su número va en **negrita y subrayado** en cualquier fila, gane o pierda.
- **Marcador:** el de la alianza ganadora en **negrita y subrayado** sobre el tono saturado; el perdedor en peso normal sobre el tono tenue. No hay empates en la muestra (verificar cómo se muestran).
- Filas muy compactas (≈ 26 px de alto), texto ≈ 13–14 px, **sin bordes entre filas**, separación solo por el contraste de las celdas.
- Entre días hay una fila centrada **"End of Day"** en gris pequeño.
- Los números de equipo que no son el del visitante son enlaces (azul/negro, sin subrayado).

### A.7 Media
- Título "Media" en **negrita**, tamaño de sección, con "Add Media" gris alineado a la derecha.
- Tres fotos en fila, mismas dimensiones, en marcos con borde fino gris, esquinas redondeadas y una sombra muy leve.

### A.8 Pie de página
- Fila de enlaces separados por "/" (GitHub / About us / Donate / Contact / Thanks / Add Data / API Documentation / Blog / Privacy Policy).
- A la derecha un **selector de tema** (sol / luna) en un control segmentado con borde fino.
- Debajo: "Thanks to our platinum sponsor …" y una línea gris pequeña de atribución de datos con fecha de generación y hash de commit.

## A.9 Versión dark (captura de escritorio) *(v1)*

Solo el tema cambia; la estructura es idéntica a light.

- **Fondo ≈ `#1C1C1E`** (valor dado por el usuario). La barra de navegación conserva el índigo; el campo de búsqueda pasa a gris oscuro y los atajos "Ctrl" y "K" son teclas pequeñas.
- **Texto principal blanco**. Texto secundario gris medio: menú lateral inactivo, etiquetas RANK/RECORD, "of 46", "Watch All Videos". **Enlaces en azul claro**, más luminoso que en light.
- **Selector de año, cajas de estadística, chips y la píldora "Week 3":** relleno gris oscuro un escalón por encima del fondo, sin borde visible (el selector sí tiene borde fino).
- **Líneas divisorias:** gris oscuro tenue.
- **Marco de la foto:** borde claro de ≈ 2 px y fondo negro dentro. Puntos de paginación: activo blanco, resto gris.
- **Banners:** mismo azul que en light (≈ `#0066B3`). No cambian con el tema.
- **Tabla de matches:** encabezado de etapa y fila "End of Day" en gris oscuro, un escalón más claro que las cajas. Alianza ganadora: rojo ≈ `#B23A35` o azul ≈ `#3454B4` con texto blanco. Alianza perdedora: rojo y azul tenues (marrón rojizo y azul grisáceo oscuros). Texto blanco en todas las celdas.
- **Proporciones en escritorio ancho** (relativas al ancho del contenido principal, porque la escala de la captura es desconocida): el menú lateral mide ≈ 19% y queda separado ≈ 3% del contenido. Dentro de un bloque de evento, resumen y tabla están en proporción ≈ 1 : 2 con un hueco ≈ 3%. Lo demás sigue la misma estructura que en la captura de tableta.

---

## B. Página de Insights (sitio clásico) — `/insights/2026`

### B.1 Estructura general
Columna única centrada y **más estrecha** que la de la beta. Fondo blanco. Sin menú lateral. Lectura vertical larga: una sección tras otra.

### B.2 Barra de navegación
Misma familia visual (azul índigo, texto blanco), con "Insights" como ítem **activo** (fondo un poco más oscuro), un ítem "More" con desplegable y a la derecha un enlace "Try beta" con una etiqueta "new" pequeña y el campo de búsqueda.

### B.3 Cabecera
- Selector de año como **botón con borde** y flecha ("2026 ▾"), alineado a la izquierda.
- **H1** "2026 Insights" y una línea gris pequeña "Last updated on Oct. 3, 2026 at 2:00 AM".

### B.4 Sección "Matches"
- Título de sección con una **cifra destacada en gris** al lado ("18372 Matches Played").
- Tres bloques "Highest Scoring Qual Match / Playoff Match / Match Overall". Cada uno:
  - subtítulo con nota gris entre paréntesis "(Minus Penalties)",
  - enlace azul al evento y la etapa,
  - **mini tabla "Teams / Score"**: encabezado gris, una fila roja y una azul (3 equipos + marcador por alianza),
  - **video de YouTube incrustado** a 16:9 debajo.

### B.5 Gráficas
- Cuatro gráficas con título de sección, una por tema: promedio de marcador por semana (línea), margen de victoria por semana (línea), distribución de marcadores (barras), distribución de márgenes (barras).
- Dos series con **colores fijos: azul = todos los matches, verde = playoffs**. Leyenda arriba con cuadrito de color + texto.
- Las de línea tienen **curva suavizada, puntos en los datos y relleno translúcido** bajo la línea.
- Las de barras agrupan barra azul y barra verde por intervalo. Ejes con números pequeños grises y cuadrícula horizontal suave.

### B.6 "Year Specific Statistics"
- **Pestañas** horizontales (Year Aggregate, Week 1…, FIRST Championship, …) con la activa marcada con borde.
- Dos columnas lado a lado: **Qualification** y **Playoff**. Dentro de cada una, varias tablas con título ("Bonus Objective Statistics", "Fuel Statistics", "Tower Statistics", "Match Statistics").
- Tablas de datos simples: encabezado en negrita con línea inferior, columnas numéricas alineadas a la derecha, algunas etiquetas son enlaces azules subrayados. En "Match Statistics" las etiquetas van alineadas a la derecha y el valor a la izquierda, sin encabezado.

### B.7 "Awards" y "Match Predictions"
- Tablas de dos columnas: **Number | Teams**. La columna Teams es una lista de números de equipo **como enlaces azules separados por comas**, que fluye en varias líneas.
- "Most Matches Played" y "Top Regional & District Winners" siguen el mismo patrón.
- "Match Predictions → Prediction Accuracy": tabla de varias columnas numéricas (# Correct, # Matches, % Correct, Brier Score).

### B.8 Pie
Texto centrado, pequeño: fecha de generación, patrocinador, "The Blue Alliance is open source. Help improve it!" y una fila de enlaces.

---

## C. Observaciones transversales

1. **Densidad alta, decoración mínima.** Casi no hay sombras, ni degradados, ni íconos de adorno. El énfasis se logra con peso tipográfico, subrayado y color de fondo de celdas.
2. **El rojo/azul de alianza es el único color fuerte** dentro del contenido, junto con el azul de enlaces y el índigo de la barra.
3. **Etiquetas de sección en mayúsculas pequeñas grises** + **filas etiqueta-izquierda/valor-derecha** es el patrón de datos de la beta.
4. **Las tablas de la beta no tienen rejilla**; las del sitio clásico sí tienen líneas. Para Insights, por tu indicación, se usa la tabla de estilo beta.
5. **Los bloques de resumen (stat boxes) son pocos y pequeños** (rank y record); no hay cuadrículas de métricas grandes.
6. **Hay contenido pesado en la referencia** (videos incrustados, fotos remotas, librería de gráficas) que choca con el requisito de ligereza. Ver decisiones abiertas en la guía.
7. **Los tonos rojo/azul se usan con dos lógicas distintas** *(v2)*: en la tabla de matches y el marcador, saturado = alianza **ganadora**, tenue = **perdedora**; en el desglose del match, saturado = fila **total**, tenue = fila de **detalle**, sin importar quién ganó.

## E. Página de match (beta) — `/match/2026mslr_qm6` *(v2)*

Capturas: escritorio, light y dark. En la beta, **el match se abre como una ventana modal sobre la página de equipo**, y la URL cambia a `/match/<id>`.

### E.1 Contenedor
- Sobre la página aparece una capa que la oscurece; la ventana queda centrada y ocupa ≈ 50% del ancho de la pantalla, con fondo del color de página, borde fino, esquinas ≈ 8 y una **×** arriba a la derecha.
- **Título** a la izquierda en azul de enlace, negrita, ≈ 22–24 px: "Quals 6 - Magnolia Regional 2026".
- Cuerpo en **dos columnas**: desglose a la izquierda (≈ 47% del ancho interior) y video a la derecha (≈ 53%). El contenido hace scroll **dentro** de la ventana.

### E.2 Marcador
- Encabezados "Teams" y "Score" en negrita, centrados, sin fondo.
- Dos filas: **alianza roja arriba, azul abajo**. Cada fila tiene 3 celdas de equipo (números) y una celda de marcador separada por un hueco pequeño; las celdas tienen esquinas ligeramente redondeadas en los extremos.
- Alianza **ganadora saturada, perdedora tenue**. El equipo del visitante (4400) en negrita. Puntitos de ranking points arriba a la izquierda de cada marcador.

### E.3 Desglose del puntaje
Tabla de **tres columnas**: `valor rojo | etiqueta | valor azul`. Las columnas laterales miden ≈ 27% cada una y la central ≈ 46%. Cinco tipos de fila:

| Tipo | Aspecto | Ejemplo |
|---|---|---|
| **Detalle** | Celdas laterales en tono **tenue**; etiqueta en peso normal sobre el fondo de página. Junto a la etiqueta hay una **flecha (← →) que apunta al lado con el valor mayor**; en empate, sin flecha. | Transition Fuel, Shift 1 Count |
| **Total / subtotal** | Celdas laterales en tono **saturado**; etiqueta en **negrita** sobre fondo gris, con flecha. | Total Auto, Teleop Hub Points, Total Teleop, Shift Points (1/2/3/4) `30 / 0 / 45 / 0` |
| **Por robot** | Fila más alta. En cada lado, un chip con el número de equipo y debajo el estado (`None (+0)`). Etiqueta centrada. | Robot 1 Endgame |
| **Chips + valor** | Fila muy alta. En el lado rojo, chips apilados con un **✕** delante del número y el valor a la derecha; el lado azul es el **espejo** (valor a la izquierda, chips con ✕ al final). El valor queda siempre junto a la etiqueta. | Auto Tower |
| **Booleana** | **✓** o **✕** centrado en cada lado. | Energized Bonus, Supercharged Bonus, Traversal Bonus |

- La tabla sigue hacia abajo; la captura corta en «Traversal Bonus».
- Chips: borde fino, esquinas muy redondeadas, número en negrita ≈ 12 px.
- **Light:** tonos saturados = salmón y azul medio claro; tenues = rosa y azul muy claros; etiqueta de las filas total en gris claro; filas de detalle con etiqueta sobre blanco. **Dark:** saturados = carmesí y azul real con texto blanco; tenues = marrón rojizo y azul marino muy oscuros; etiqueta de las filas total en gris oscuro.

### E.4 Video
Reproductor de YouTube **incrustado** (iframe), 16:9, esquinas ≈ 8, sin marco adicional, en la parte superior de la columna derecha. Debajo no se ve más contenido.

---

## F. Maquetación móvil (dark, ≈ 390 px) *(v2)*

Los colores son los mismos que en escritorio.

### F.1 Barra de navegación
Barra índigo con logo, nombre, **lupa** y **hamburguesa**. El menú se despliega como un **panel índigo a todo el ancho, encima del contenido**: ítems en columna, cada uno con ícono lineal a la izquierda y texto blanco grande (≈ 20 px), separados por una línea fina de tono más claro. Las esquinas inferiores del panel están muy redondeadas (≈ 24 px). La hamburguesa pasa a **×**.

### F.2 Subbarra de secciones
Debajo de la barra principal hay una fila con un botón con ícono de lista y la **sección actual** ("≡ Team Info") a la izquierda, y el **selector de año** a la derecha. Sustituye al menú lateral de escritorio; no desaparece.

### F.3 Cabecera
- Avatar pequeño a la izquierda; el título se parte en **tres líneas** de ≈ 28 px; la estrella queda en el borde derecho.
- Datos en una columna, cada uno con su ícono. Los **chips de redes van centrados** y se acomodan en filas (en escritorio van alineados a la izquierda).
- Foto a **ancho completo** con su marco y los puntos centrados debajo; después la frase resumen.
- Banners: **dos por fila**, cada uno ≈ 48% del ancho.

### F.4 Bloque de evento (una columna)
Orden: título del evento → fecha y "Week" → ubicación → Rank y Record en **dos columnas** → ALLIANCE (etiqueta a la izquierda, chips a la derecha) → AWARDS → POOL POINTS con el badge a la derecha → tabla de matches.

### F.5 Tabla de matches
- Encabezado de etapa a ancho completo ("Qualifications", con "Watch All Videos" a la derecha). "End of Day", "Semifinals" y "Finals" también son barras de ancho completo.
- Cada match es una **fila de dos líneas**: a la izquierda el ícono de play y la etiqueta ("Quals 6"); a la derecha, **la línea roja arriba y la azul abajo**, cada una con sus 3 equipos y el marcador al final.
- Mismos tonos ganador/perdedor y mismas marcas del equipo del visitante que en escritorio.

---

## G. Falta para cerrar esta fase

- [x] Equipo en dark: escritorio (parte superior) y móvil (completa).
- [x] Match en light y dark, escritorio (desglose parcial).
- [ ] Parte inferior del desglose del match (penalizaciones, ranking points…) y el área bajo el video.
- [ ] Match en móvil.
- [ ] Insights en dark y en móvil.
- [ ] **CSS computado** de los elementos listados en `02-guia-de-estilos.md §0`.
- [ ] Captura/estructura del **Historical Timeline** de agameserver.
