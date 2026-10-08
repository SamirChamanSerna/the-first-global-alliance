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
