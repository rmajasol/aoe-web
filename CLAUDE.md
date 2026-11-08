# Reinos en Guerra (aoe-web)

RTS en el navegador inspirado en Age of Empires II. Jugador (azul, `owner 0`) contra IA (roja, `owner 1`). Vista isométrica 2:1 con canvas 2D. **JavaScript puro: sin build, sin dependencias, sin tests.** Todo (UI, comentarios, commits, textos) va en **español**.

Repo: https://github.com/rmajasol/aoe-web (público). Rama única: `main`.

## Reglas del proyecto (importante)
- **Identidad git: `rmajasol`** (`822842+rmajasol@users.noreply.github.com`, ya configurada en el repo). Nunca `sweetyshots123` (es el gitconfig global; el usuario se enfadó por ello). Comprobar `git config user.name` antes de commitear.
- Commits en español, en imperativo/descriptivo, como el historial existente. Commitear/pushear solo si el usuario lo pide.
- No añadir frameworks, bundlers ni npm. Mantener el estilo compacto del código existente.

## Ejecutar
```bash
python serve.py        # http://localhost:8765  (sin caché; puerto opcional: python serve.py 8767)
```
Configuración de preview en `.claude/launch.json` (`aoe-web`, `aoe-web-alt`). Para verificar cambios: abrir la página, empezar partida, mirar consola y el log (F9).

## Mapa del código (orden de carga = orden en `index.html`)
| Archivo | Qué contiene |
|---|---|
| `js/log.js` | `LOG`: registro persistente en localStorage, captura errores, detecta crashes |
| `js/data.js` | Constantes y definiciones: `UNITS`, `BUILDINGS`, `NODE`, `ANIMALS`, edades, colores |
| `js/game.js` | Motor: estado global `G`, generación de mapa, entidades, A*, combate, órdenes, economía, niebla, bucle `update(dt)`, `startGame` |
| `js/ai.js` | IA enemiga: `DIFFS`, `aiUpdate` (economía, construcción, ejército, oleadas) |
| `js/render.js` | Cámara, proyección isométrica, terreno, `render()`, minimapa, efectos |
| `js/sprites.js` | Sprites hornados (edificios, árboles) y figuras 3D de unidades/animales dibujadas en vivo |
| `js/ui.js` | Entrada, selección, panel de comandos/info, sonido (WebAudio), notificaciones |
| `js/main.js` | Menú, visor de log, bucle `requestAnimationFrame` |

Todo son **globales compartidas** (sin módulos ES). Al añadir un archivo, respetar el orden de `<script>`.

## Ideas clave que cuesta redescubrir
- Coordenadas: la lógica usa **casillas** (flotantes, `TILE=32` solo para proyectar). `isoX/isoY` pasan casilla→mundo isométrico; `s2t` pantalla→casilla.
- Entidades `kind`: `unit | building | node | animal`. Las muertas se marcan `dead=true`, se quitan de `G.byId` y `cleanup()` filtra los arrays al final del tick. **Siempre comprobar `alive(e)`** antes de usar una referencia guardada (órdenes, objetivos, rally).
- Bloqueo de mapa: `G.blk` (impide paso), `G.occ` (ocupa casilla), `G.terrain` (1=agua). `G.pv` es la "versión de pathing": se incrementa al cambiar bloqueos y las unidades revalidan su ruta.
- Órdenes de unidad (`u.order.type`): `move | amove | attack | build | gather`. Se asignan con `setOrder` / `issueMove|Attack|Gather|Build`.
- La IA usa **las mismas funciones que el jugador** (`enqueue`, `placeBuilding`, `issueX`). `DIFFS` está en `ai.js` pero `game.js` lo lee en `startGame`.
- Niebla: `G.vis` 0=oculto, 1=explorado, 2=visible; solo del jugador 0. El jugador solo puede construir donde `vis != 0`.
- Los efectos (`G.fx`) tienen topes de cantidad (≈200–260) para no degradar el rendimiento: respetarlos al añadir partículas.
- El bucle (`main.js`) divide el tiempo en pasos de ≤0.05s; `frame()` reprograma el rAF *antes* de ejecutar, y atrapa excepciones para que un fallo no pare el juego.

## Documentación detallada
- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): motor, estructuras de datos, flujo del tick, render, IA, log.
- [docs/JUEGO.md](docs/JUEGO.md): reglas, controles, tablas de unidades/edificios/edades, dificultades.
- [docs/DESARROLLO.md](docs/DESARROLLO.md): cómo añadir contenido, depuración, trampas conocidas, historial y pendientes.

## Regla obligatoria: documentación siempre al día
**Después de CUALQUIER cambio** (código, datos, balance, controles, UI, IA, bugs corregidos), antes de dar la tarea por terminada o de commitear:
1. Revisa si `CLAUDE.md` y los documentos de `docs/` siguen siendo correctos.
2. Actualiza lo que haya quedado desfasado (tablas de `JUEGO.md`, descripción en `ARQUITECTURA.md`, recetas/trampas/historial en `DESARROLLO.md`, mapa de archivos aquí).
3. Incluye esa actualización en el **mismo commit** que el cambio.
4. Si no hacía falta tocar nada, no pasa nada, pero la revisión se hace siempre.
