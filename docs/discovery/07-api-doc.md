# Especificación de la API: Eventos y Resultados (FIRST Global Challenge)

Esta API proporciona información en tiempo real sobre los partidos disputados, programados, detalles de juego en campo, estadísticas y la tabla de clasificación (rankings) de un torneo de robótica (FIRST Global Challenge).

## 1. Información General

* **Formato de datos:** `JSON`
* **Codificación:** `UTF-8`
* **Formato de Fechas/Horas:** ISO 8601 (con soporte de zona horaria / UTC).

---

## 2. Estructura Raíz (Root Object)

La respuesta principal devuelve un objeto JSON con las siguientes propiedades:

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `matches` | `Array<Match>` | Lista de todos los partidos programados y jugados de la fase clasificatoria. |
| `rankings` | `Array<Ranking>` | Lista con la tabla de posiciones y rendimiento acumulado por equipo. |
| `round_robin` | `Array` | Lista de partidos para la fase de Round Robin (si aplica). |
| `finals` | `Array` | Lista de partidos de la fase final. |
| `alliances_round_robin` | `Array` | Alianzas formadas para la fase Round Robin. |
| `alliances_finals` | `Array` | Alianzas formadas para las finales. |
| `awards` | `Array` | Premios otorgados durante el evento. |

---

## 3. Objeto `Match` (Partidos)

Representa un enfrentamiento entre dos alianzas (Roja y Azul).

### Campos Principales

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `eventKey` | `String` | Identificador único del evento (ej. `"FGC_2026-FGC-CMP"`). |
| `tournamentKey` | `String` | Identificador del torneo/etapa (ej. `"t2"`). |
| `id` | `Integer` | Identificador numérico del partido. |
| `name` | `String` | Nombre legible del partido (ej. `"Ranking Match 1"`). |
| `scheduledTime` | `String` | Fecha y hora programada (ISO 8601). |
| `actualStartTime` | `String` | Fecha y hora real de inicio (vacío si no ha iniciado). |
| `cycleTime` | `Float/Int` | Tiempo de ciclo del partido en segundos. |
| `redScore` | `Integer` | Puntuación total obtenida por la alianza roja. |
| `redMinPen` | `Integer` | Penalizaciones menores de la alianza roja. |
| `redMajPen` | `Integer` | Penalizaciones mayores de la alianza roja. |
| `blueScore` | `Integer` | Puntuación total obtenida por la alianza azul. |
| `blueMinPen` | `Integer` | Penalizaciones menores de la alianza azul. |
| `blueMajPen` | `Integer` | Penalizaciones mayores de la alianza azul. |
| `updatedAtUtc` | `String` | Fecha y hora de la última actualización en UTC. |
| `played` | `Boolean` | `true` si el partido ya concluyó, `false` si está pendiente. |
| `field` | `Integer` | Número de la cancha/campo donde se disputa el partido. |
| `participants` | `Array<Participant>`| Lista de los equipos que participan en el match (6 equipos por partido). |
| `details` | `MatchDetails` | Desglose de puntuación y elementos del juego. |

---

### Sub-objeto `Participant`

Define a cada equipo participante dentro de un partido.

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `eventKey` | `String` | Identificador del evento. |
| `tournamentKey` | `String` | Identificador del torneo. |
| `id` | `Integer` | ID del match al que pertenece. |
| `station` | `Integer` | Estación del robot: <br>• `11`, `12`, `13`: Alianza Roja (Posiciones 1, 2, 3)<br>• `21`, `22`, `23`: Alianza Azul (Posiciones 1, 2, 3) |
| `teamKey` | `Integer` | Número/ID único del equipo. |
| `disqualified` | `Integer` | `1` si fue descalificado, `0` en caso contrario. |
| `cardStatus` | `Integer` | Estado de sanciones/tarjetas (ej. `0` = sin tarjeta, `3` = tarjeta roja). |
| `surrogate` | `Integer` | `1` si el equipo juega como sustituto (su puntaje no cuenta para ranking), `0` si no. |
| `noShow` | `Integer` | `1` si el equipo no se presentó al partido, `0` si asistió. |
| `country` | `String` | Código de país COI/ISO de 3 letras (ej. `"COL"`, `"USA"`). |
| `countryCode` | `String` | Código de país ISO de 2 letras en minúscula (ej. `"co"`, `"us"`). |

---

### Sub-objeto `MatchDetails`

Detalla los elementos de puntuación específicos del juego (temática de incendios/wildfire).

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `wildfireInRedSuppressionUnit` | `Integer` | Elementos anotados en la unidad de supresión roja. |
| `wildfireInBlueSuppressionUnit`| `Integer` | Elementos anotados en la unidad de supresión azul. |
| `wildfireInExtinguisher` | `Integer` | Elementos anotados en el extintor central/común. |
| `approximateWildfireIn...` | `Integer` | Conteo aproximado/sensores de elementos anotados. |
| `redRobot[One/Two/Three]BraceState` | `Float` | Estado/nivel de soporte o anclaje de los robots rojos (ej. `0`, `0.05`, `0.2`, `0.3`). |
| `blueRobot[One/Two/Three]BraceState`| `Float` | Estado/nivel de soporte o anclaje de los robots azules. |
| `[red/blue]Robot[X]PartnerClimb` | `Integer` | Escalada asistida con un robot aliado (`1` o `0`). |
| `coopertition` | `Integer` | Puntos por bonificación cooperativa entre ambas alianzas. |
| `coopertitionKnockdownBonus` | `Integer` | Puntos extra por objetivos cooperativos cumplidos. |
| `redClimbMultiplier` | `Float` | Multiplicador final obtenido por la escalada roja (ej. `1.0` a `1.9`). |
| `blueClimbMultiplier` | `Float` | Multiplicador final obtenido por la escalada azul. |
| `redPartnerClimbPoints` | `Integer` | Puntos obtenidos por escalada en pareja (alianza roja). |
| `bluePartnerClimbPoints` | `Integer` | Puntos obtenidos por escalada en pareja (alianza azul). |

---

## 4. Objeto `Ranking` (Clasificación)

Contiene la posición actual de cada país/equipo y su desempeño acumulado.

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `eventKey` | `String` | Identificador del evento. |
| `tournamentKey` | `String` | Identificador del torneo. |
| `teamKey` | `Integer` | Identificador/Número del equipo. |
| `rank` | `Integer` | Posición actual en la tabla clasificatoria. |
| `rankChange` | `Integer` | Puestos subidos (+) o bajados (-) en la última actualización. |
| `played` | `Integer` | Total de partidos disputados válidos. |
| `wins` | `Integer` | Total de victorias. |
| `losses` | `Integer` | Total de derrotas. |
| `ties` | `Integer` | Total de empates. |
| `rankingScore` | `Float` | Puntuación promedio de ranking (criterio principal de orden). |
| `highestScore` | `Integer` | Puntuación más alta lograda en un solo partido. |
| `climbPoints` | `Float` | Promedio/acumulado de puntos o multiplicadores de escalada. |
| `team` | `Team` | Información general del equipo/país. |

---

### Sub-objeto `Team`

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `teamKey` | `Integer` | Identificador del equipo. |
| `cardStatus` | `Integer` | Estado acumulado de tarjetas en el torneo. |
| `hasCard` | `Integer` | `1` si tiene tarjetas activas, `0` si no. |
| `country` | `String` | Código de país (3 letras). |
| `countryCode` | `String` | Código de país (2 letras). |
| `name` | `String` | Nombre representativo (ej. `"Team Colombia"`). |
| `shortName` | `String` | Nombre corto/alternativo (puede ser string vacío). |

---

## 5. Ejemplo de Respuesta (Estructura resumida)

```json
{
  "matches": [
    {
      "id": 1,
      "name": "Ranking Match 1",
      "redScore": 72,
      "blueScore": 42,
      "played": true,
      "field": 1,
      "participants": [
        { "station": 11, "teamKey": 150, "country": "SLE" },
        { "station": 21, "teamKey": 5, "country": "ANG" }
      ],
      "details": {
        "coopertition": 0,
        "redClimbMultiplier": 1.4,
        "blueClimbMultiplier": 1.1
      }
    }
  ],
  "rankings": [
    {
      "teamKey": 177,
      "rank": 1,
      "played": 7,
      "wins": 7,
      "losses": 0,
      "ties": 0,
      "rankingScore": 486.83,
      "team": {
        "teamKey": 177,
        "country": "UZB",
        "name": "Team Uzbekistan"
      }
    }
  ],
  "round_robin": [],
  "finals": [],
  "alliances_round_robin": [],
  "alliances_finals": [],
  "awards": []
}
```