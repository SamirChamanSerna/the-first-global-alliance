# 05 — Componentes pendientes

> Estado: **abierto**. Lo que se documenta aquí no está en `demo-team-match.html` ni en `blocks.js`, y no se construye hasta que haya aprobación (`00-instrucciones-agentes.md` §8).
> Pendientes conocidos que todavía no tienen ficha aquí: página de resultados de búsqueda, carrusel de fotos, GameDay, tipos de fila del desglose, símbolo de "Honorable".

---

## Buscador en el menú móvil — aprobado e implementado (2026-10-08)

**Por qué.** En móvil no había forma de buscar: el campo de la cabecera se oculta en el media query de 900 px y el menú desplegable solo llevaba enlaces, así que `/search/` quedaba inalcanzable sin escribir la URL.

**Dónde.** Cabecera que genera `layout()` (`site/templates/blocks.js`), dentro de `<details class="menu">`, antes de los enlaces.

**Boceto**

```
[ Menú ▾ ]
┌──────────────────────┐
│ 🔍 Buscar…          │   ← campo, ancho completo
│ Insights            │
│ Teams               │
│ Awards              │
│ Rankings            │
│ Matches             │
│ GameDay             │
└──────────────────────┘
```

**Marcado.** Un segundo `<form>` dentro del desplegable, con el mismo `action` que el de la cabecera. El `<input>` reutiliza el `datalist#sx` que ya existe arriba: **no se duplica el id** (dos `input` con `list="sx"` apuntando al único `datalist`).

**Tokens y CSS.** Ningún token nuevo: reutiliza `.menu`, `.menu div` y `.nav input` (que ya fija `--bg`, `--r-box` y la tipografía). Dos reglas añadidas en `components.css`, después de `.nav input` para poder ganarle a su `width:200px`:

```css
.menu form{padding:12px 0 0}
.menu input{width:100%}
```

Y el ocultado de móvil pasa a apuntar solo al formulario de la cabecera, que es el que sobra:

```css
.nav .links,.nav>form input,.side{display:none}   /* antes: .nav input */
```

**Datos que necesita.** Los mismos que el buscador de escritorio: `t('search')`, `t('menu')` y `urls.search()`.

**Sin JS.** Es un `<form>` normal, así que envía `?q=` a `/search/`; esa página ya lee el parámetro, rellena su campo y filtra la tabla.

**En escritorio no se ve** porque `.menu` es `display:none` a partir de 900 px: ahí el campo que manda es el de la cabecera.

**Nota para el demo.** `demo-team-match.html` no contempla este caso. Como el demo manda sobre el aspecto, si algún día se corrige debería recogerlo; hasta entonces, este es el único sitio donde está documentado.

---

## Tabla de alianzas (Playoffs / Round Robin) — aprobado e implementado (2026-10-09)

**Por qué.** El sorteo de alianzas del round robin publica `alliances_round_robin` en la API
en cuanto el evento cambia de fase, y el sitio no mostraba nada de esa fase: los equipos
clasificados no aparecían en ninguna tabla hasta que se jugaban los partidos. La
especificación lo pide en la temporada (§2, «Playoffs / Round Robin: tabla de alianzas
clasificadas») y el dueño lo pidió además en `/rankings/`, que es donde se busca el estado
de la competición.

**Dónde.** `site/templates/pages.js`, helper `alTable(y)`, llamado desde dos sitios:
`rankings(y)` — arriba del todo, por encima de la tabla de puestos — y `insLive(y)` — entre
el vídeo de revelación y el Live Match Tracker. Se pinta en toda temporada que tenga
alianzas: 2024, 2025 y 2026.

**Boceto**

```
Alliances
┌──────────┬──────────────────────────────────────────┐
│ Alliance │ Teams                                    │
├──────────┼──────────────────────────────────────────┤
│       #1 │ 🇺🇿 UZB  🇲🇩 MDA  🇻🇪 VEN  🇸🇻 ESA          │
│       #2 │ 🇨🇳 CHN  🇹🇲 TKM  🇰🇾 CAY  🇹🇷 TUR          │
└──────────┴──────────────────────────────────────────┘
```

**Marcado.** No hay componente nuevo ni clases nuevas: reutiliza `dt()` para la tabla y
`teamCell()` para cada equipo (bandera + código, con el nombre completo en el `title` y
enlace a su página), que es el vocabulario que ya usan las filas de partido. El número de
alianza es el índice + 1, el mismo criterio que `al()` en las páginas de equipo.

En `/rankings/` la tabla de puestos queda envuelta en `<div id="ranking-table">`. No es
decorativo: el overlay en vivo (`site/brand/live.js`) buscaba `table.dt`, y ahora la primera
del documento es la de alianzas, así que le escribía encima el ranking de equipos. Con el
`id` acota la búsqueda. Es el mismo patrón de `#live-match-list` o `#on-deck-container`.

**Tokens y CSS.** Ninguno nuevo: la tabla ya trae el estilo de `.dt` y las banderas el de `.fl`.

**Datos que necesita.** `AL[y]` (`data/processed/{year}/alliances.json`), `t('alliances')`,
`t('alliance')`, `t('teams')`. Sin alianzas —la mayoría de las temporadas— no se imprime
nada, ni un «No alliances»: misma excepción deliberada que en `al()` (regla 6), porque el
hueco no es un dato que falte sino una fase que no existió.

**Sin JS.** Es HTML del build; el overlay solo añade los marcadores de los partidos.

**No lleva puesto ni récord.** En esa fase la API publica `rank: 0` para las ocho alianzas y
ningún partido jugado, así que un puesto sería inventado y un 0 sería justo lo que prohíbe
la regla 6. Se añadirán cuando la API los publique, igual que el ranking de la temporada
viva, que rellena el overlay.

**PENDIENTE — el capitán.** `buildAlliances` deja al capitán en el primer hueco
(`[captain, pick1, pick2, pick3]`), pero la tabla no lo marca porque `AL[y]` es una lista de
códigos y pierde esa información, que la API sí declara (`isCaptain`, `pickOrder`). Marcar
al capitán pediría cambiar la forma de `AL[y]`, así que es una decisión abierta, no un
descuido.

**Nota para el demo.** `demo-team-match.html` tiene la fila de alianza del bloque de
temporada (`.row` + `.chip`) y una tabla de partidos con las fases, pero ninguna tabla de
alianzas.
