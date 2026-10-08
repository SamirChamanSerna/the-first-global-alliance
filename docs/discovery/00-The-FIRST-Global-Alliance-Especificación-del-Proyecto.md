# The FIRST Global Alliance - Especificación del Proyecto

## Descripción General de la Página
**Filosofía:**
Debe ser una página web inspirada en *The Blue Alliance*, enfocada en el principio **KISS** (*Keep It Simple, Stupid*): fácil de leer, centrada en los datos, únicamente con información relevante y que requiera el mínimo mantenimiento posible.

*Nota:* Los nombres de las secciones son propuestas y pueden ajustarse si encontramos términos más descriptivos o estandarizados dentro del ecosistema FGC.

---

## Mapa de Sitio y Estructura de Navegación

### Páginas Globales / Temporada
* **Home** (`/`)
* **Insights**
  * Insights Histórico (`/insights`)
  * Insights por Temporada (`/insights/{season}`)
* **Teams** (`/teams`)
* **Awards** (`/awards`)
* **Rankings** (`/rankings/{season}`)
* **Matches** (`/matches/{season}`)
* **GameDay** (`/gameday`) *(Funcionalidad a futuro)*

### Páginas Específicas de Entidades
* **Team**
  * Histórico del Equipo (`/team/{team_code}`)
  * Temporada del Equipo (`/team/{team_code}/{season}`)
* **Match**
  * Detalle de Partido (`/match/{season}_{match_key}`)

*Nota:* En la parte superior de la pagina siempre aparece una barra de busqueda que admite tanto evento, año o equipo. 

---

## Detalle de Módulos

### 1. Home
**Descripción:**  
Página principal de aterrizaje. Limpia, minimalista y directa.

**Contenido:**
* **Encabezado principal:**
  * Título destacado: *"The FIRST Global Alliance"*.
  * Subtítulo / Slogan: *"A simple way to explore FIRST Global Challenge results."*
* **Sección de Sedes:**
  * Mapa interactivo minimalista con pines en los países anfitriones (al interactuar, mostrar ciudad, país y año).
  * Lista cronológica inversa debajo del mapa (del año más reciente al más antiguo) indicando: año, sede, país y fechas oficiales.
  * Cada elemento de la lista enlaza directamente a `/insights/{season}`
* **Métricas Globales (KPIs):**
  * Tarjeta 1: Total histórico de partidos registrados.
  * Tarjeta 2: Total histórico de premios otorgados.
  * Tarjeta 3 (opcional): Total histórico de países/equipos participantes.

---

### 2. Insights
**Descripción:**  
Módulo analítico con récords, métricas agregadas y datos destacados. Cuenta con un selector desplegable (*dropdown*) para alternar entre el **Overview Histórico** y una **Temporada Específica** (`Season XXXX`).

**Contenido General:**
* Selector de temporada (Overview / 2017, 2018... más reciente).
* Datos informativos del evento:
  * Temporada: Nombre oficial, año y sede.
  * Enlace a la web oficial: `https://first.global/archive/fgc-{year}/` (o `https://first.global/about/` en la vista Overview).
  * Video de revelación del juego (*Game Reveal*): miniatura y enlace al video oficial.
* Métricas rápidas:
  * Número de equipos participantes.
  * Número de partidos jugados.
  * Número de premios otorgados.

**Contenido Estadístico:**
* **Premios Otorgados:**
  * *En Overview:* Listado agrupado por premio histórico (ej. todos los ganadores de *Albert Einstein Award* * Agrupados por Oro, palta, bronce etc... a lo largo de los años).
  * *En Temporada:* Equipos galardonados ese año (Oro, Plata, Bronce, Mención Honorífica, según aplique).
* **Métricas de Qualification Matches:**
  * *Highest Scoring Match:* Tarjeta con los equipos por alianza, marcador final, enlace/miniatura al video y vínculo directo al desglose del partido.
  * *Average Match Score:* Promedio de puntuación (con $\pm$ desviación estándar en texto secundario).
  * *Average Winning Margin:* Margen de victoria promedio (con $\pm$ desviación estándar).
* **Playoffs / Round Robin:**
  * *En Temporada:* Tabla de alianzas clasificadas.
  * *En Overview:* Top 5 de equipos con más apariciones históricas en Playoff / Round Robin.
  * Estadísticas de Playoff: Partido con mayor puntuación, promedio de puntos y margen de victoria.
* **Rankings de Rendimiento:**
  * *En Temporada:* Vista previa del Top 24 del ranking con enlace a `/rankings/{season}`.
  * *En Overview:* Top 10 de equipos con más premios acumulados en la historia.

---

### 3. Teams
**Descripción:**  
Directorio global de todos los equipos que han participado en la historia del evento.

**Contenido:**
* Organizados por los **5 continentes** (según el Comité Olímpico Internacional).
* Tabla por continente ordenada alfabéticamente:
  * Bandera del país.
  * Código de país (ISO Alpha-3).
  * Nombre del equipo / país.
  * Cantidad de temporadas en las que ha participado.
* Cada fila/nombre de equipo enlaza a `/team/{team_code}`.

---

### 4. Awards
**Descripción:**  
Tabla histórica acumulativa de premios.

**Contenido:**
* Tabla general ordenada por defecto por total de premios recibidos.
* Columnas: Equipo (Bandera + Código ISO + Nombre), Oro, Plata, Bronce, Menciones y Total.
* Capacidad de reordenar ascendentemente/descendentemente haciendo clic en los encabezados de columna.

---

### 5. Rankings
**Descripción:**  
Clasificación de equipos por temporada individual. La vista por defecto es la del año más reciente, con un selector (*dropdown*) para años anteriores.

**Contenido:**
* Tabla de posiciones oficial:
  * Posición (#).
  * Bandera y Código ISO.
  * Nombre del equipo.
  * Métrica principal de clasificación del año (ej. *Ranking Points* o promedio de puntos).
  * Desempates oficiales (*Tiebreakers*: Tiebreaker 1, 2 y 3 según el manual del juego de ese año).
  * Récord de temporada: Victorias - Derrotas - Empates (W-L-T).
*Nota:* **Recomendación técnica:** La tabla de /rankings/{season} debe admitir un esquema de columnas dinámico (JSON o definición por configuración anual) en lugar de una base de datos con columnas fijas tiebreaker_1, tiebreaker_2.

---

### 6. Matches
**Descripción:**  
Calendario y resultados completos de los partidos de una temporada. La vista por defecto es la más reciente.

**Contenido:**
* Selector de temporada.
* Ordenados por fase: *Qualifications*, *Round Robin / Playoffs*, *Finals*. (Primero la ultima Fase jugada ej. Finals, Round Robin, Qualifications)
* Tabla estándar de partidos:
  * Identificador del partido (ej. Q12, F1).
  * Cancha y hora programada.
  * Alianza Roja (Equipos) vs. Alianza Azul (Equipos).
  * Puntuación final y badges de victoria/derrota.
  * Enlace al detalle del partido (`/match/...`) y al video correspondiente.

---

### 7. GameDay *(Funcionalidad Futura)*
**Descripción:**  
Centro de transmisiones en vivo estilo *dashboard* multitarea.

**Contenido:**
* **Durante evento en vivo:** Panel con cuadrícula para visualizar simultáneamente las transmisiones de YouTube de las distintas canchas (normalmente 5 o 6).
* **Fuera de temporada:** Archivo con las listas de reproducción (*playlists*) de YouTube de competencias pasadas, organizadas por temporada.

---

### 8. Perfil de Equipo: Team Overview (`/team/{team_code}`)
**Descripción:**  
Ficha histórica y resumen de la trayectoria del equipo nacional a lo largo de sus participaciones.

**Contenido:**
* **Cabecera:**
  * Bandera oficial.
  * Nombre del país / equipo.
  * Código ISO.
  * Enlaces a redes sociales y canales de contacto oficiales (si están disponibles).
  * Selector desplegable para saltar a una temporada específica (`/team/{team_code}/{season}`).
* **KPIs Históricos:**
  * Total de partidos jugados.
  * Total de premios obtenidos.
  * Récord global W-L-T (con porcentaje de victorias en texto secundario).
  * Mejor posición histórica en ranking (*Best Rank*, indicando año y total de equipos).
  * Resumen de medallas (ej. 3x Oro, 1x Plata, 2x Bronce).
* **Línea de Tiempo (Timeline):**
  * Orden cronológico inverso (temporada más reciente arriba).
  * Tarjeta resumen por cada año participante:
    * Nombre oficial del reto, año, sede y fechas.
    * Fotografía del equipo / robot.
    * Posición en el ranking (ej. #12 de 190).
    * Récord W-L-T de la temporada.
    * Participación en Playoffs / Alianza integrada.
    * Premios obtenidos ese año.
    * Métricas clave: Puntuación más alta conseguida (*Highest score*) y puntuación media por partido.

---

### 9. Perfil de Equipo: Team Season (`/team/{team_code}/{season}`)
**Descripción:**  
Desglose detallado del rendimiento de un equipo en un año específico (equivalente a la vista de evento en *The Blue Alliance*).

**Contenido:**
* Cabecera del equipo con selector de temporada y enlace de regreso a la vista histórica (*Overview*).
* Galería/Carrusel multimedia del robot o equipo de esa edición.
* Resumen del evento:
  * Sede, fecha, ranking final, récord W-L-T y premios ganados.
  * Posición de alianza en Playoff (si aplica).
* **Desglose de Partidos del Equipo:**
  * Tabla con todos los partidos disputados por el equipo en esa edición (separados por *Qualifiers*, Round Robin, *Finals*).
  * Formato estándar de partido: número de match, alianza asignada (con enlaces a los compañeros de alianza), marcador final y enlace al video.

---

### 10. Match Detail (`/match/{match_key}`)
**Descripción:**  
Ficha técnica detallada de un partido específico.

**Contenido:**
* Marcador final destacado (Rojo vs. Azul).
* Repositorio audiovisual: Miniatura y reproductor integrado de YouTube con la grabación del partido.
* Desglose detallado de puntuación según las reglas de ese año (puntos por tareas autónomas, teleoperadas, penalizaciones, etc.).
* Enlaces directos a los perfiles de todos los equipos participantes.