# Guía de desarrollo

## Entorno
- Windows 11, Python para el servidor. Sin Node, sin `npm install`, sin build.
- `python serve.py` → http://localhost:8765. Recarga con Ctrl+F5 si hace falta (el servidor ya envía `no-store`).
- Verificar cambios: empezar partida, mirar la consola del navegador y el visor de log (**F9**). No hay tests automáticos: la verificación es jugar/observar. Para probar lógica rápido, la consola da acceso a las globales (`G`, `UNITS`, `issueMove(...)`, `addUnit(0,'knight',x,y,true)`, etc.).
- Git: identidad **rmajasol** (ver `CLAUDE.md`).

## Receta: añadir contenido
**Nueva unidad**
1. `data.js` → entrada en `UNITS` (cost, time, hp, atk, atkType `melee|pierce`, range, rate, speed, sight, mArm, pArm, cls, age, at, bonus, desc, opcional `pop`/`bldOnly`).
2. Añadirla a `trains` del edificio que la entrena en `BUILDINGS`.
3. `sprites.js` → figura en `FIGS` + altura en `UNIT_H` (se usa también para seleccionar con `pick`). Si es grande, ajustar el factor `big` en `pick` (ui.js).
4. IA: añadirla a la lógica de producción de `aiUpdate` (paso 6) si debe usarla.
5. Actualizar `docs/JUEGO.md`.

**Nuevo edificio**: `BUILDINGS` en `data.js` (+ `drop` si es punto de entrega, `trains`, `atk/range/rate` si dispara) → altura `[H, RH]` en `BH` y función de sprite en `bSprite` (sprites.js) → añadirlo a la lista del aldeano en `getCommands` (ui.js) → regla de IA en `prodWanted` si procede. Recuerda que `cls/mArm/pArm` se asignan en el bucle al final de `data.js`.

**Nuevo recurso/animal**: `NODE`/`ANIMALS` en `data.js`; colocación en `genMap`; dibujo en `drawNode`/`animalFig`; icono y nombre en `RES_ICON`/`RES_NAME` si es recurso nuevo (y cuidar `p.res`, `updateTop` y el HTML de `#top`).

**Nueva orden de unidad**: caso nuevo en el `switch` de `updateUnit` + helper `issueX` + disparo desde `contextCommand` o `getCommands` en ui.js.

**Ajustar balance/dificultad**: solo `data.js` y `DIFFS` en `ai.js`.

## Trampas y detalles conocidos
- **Referencias a entidades muertas**: órdenes, `rally.node`, `b.target`, proyectiles guardan objetos. Usa siempre `alive()`. Por eso `rally` recuerda `px/py/rtype`.
- Los arrays se purgan en `cleanup()` al final del tick; durante el tick puede haber elementos `dead` en `G.units` etc. → comprobar `.dead` en bucles.
- Si cambias bloqueos del mapa (construir/destruir), llama a `occupy`/incrementa `G.pv` (lo hace `occupy`); si no, las unidades no revalidan rutas.
- `findPath` usa buffers globales `A` con `stamp`: **no es reentrante** (no llamarlo recursivamente). Máximo 9000 iteraciones: destinos lejanos con rodeos grandes usan `partial`.
- `distEnt` resta 0.3 al medir contra puntos (unidad/animal) para compensar su radio.
- `crossed(anim, dt, T, at)` detecta cuándo la animación pasa por el instante de golpe: se usa para partículas/sonido sincronizados con el golpe.
- Límites de rendimiento: `G.fx` con topes por tipo (`chip` 260, `spark` 200, etc.). `separate()` es O(n²) con early-out por distancia: vigilar con ejércitos de 100+ unidades.
- El fondo de terreno y los sprites se hornean al iniciar partida (`buildSprites`, `buildTerrain`, `resize`). Cambiar colores en runtime no los refresca.
- `deleteSel` tiene un `&& false` residual que desactiva una protección del último Centro Urbano (se puede borrar cualquier edificio propio). Intencionado o no, es el comportamiento actual.
- Dependencia externa en runtime: Google Fonts (Cinzel). Sin conexión el juego funciona con la fuente por defecto.
- Texto de la UI y los comentarios del código están en español; mantenerlo.

## Depuración con el registro
- `LOG.event()` marca hitos (partida iniciada, construcciones, edades, oleadas, destrucciones, victoria/derrota). Añade más si ayuda a diagnosticar.
- Si el navegador crashea, al reabrir el menú muestra "⚠️ Ver log de la partida que crasheó" con las últimas líneas (latido cada 5 s con estado y memoria). Útil para pedirle al usuario el log de un crash: **F9 → Copiar/Descargar**.
- Errores del bucle no detienen el juego (`frame()` los atrapa y registra, y avisa una sola vez).

## Historial (git)
1. `80707c1` Motor, IA, interfaz y gráficos iniciales.
2. `298f5bd` Vista isométrica 2:1, edificios y unidades 3D, fauna y caza, animaciones de trabajo.
3. `63c3662` Corrección de sombreros/escudos/ruedas; servidor local sin caché.
4. `79baf47` Pulido visual: relieve, ambiente, animaciones de combate, interfaz.
5. `39646fc` Punto de reunión sustituye recursos agotados y recoge cercanos.
6. `a2c6471` Selección múltiple de edificios: entrenar varias unidades y rally común.
7. `82c8f34` Registro persistente en localStorage para diagnosticar crashes.

## Pendiente / ideas (no hay roadmap oficial; confirmar con el usuario)
- Investigaciones/mejoras (herrería, tecnologías económicas), muros y puertas, mercado/comercio, reliquias, civilizaciones diferenciadas.
- Más tipos de unidad (piquero, ballestero, catapulta), monjes/curación.
- Multijugador / más de un enemigo, guardado de partida, estadísticas finales.
- Investigar la causa de los crashes que motivaron el registro (revisar los logs reales si el usuario los aporta).
- Tests automatizados de la lógica de `game.js` (es casi pura; usa globales, requeriría cargar en un entorno Node/`vm`).

## Convenciones de trabajo con Claude
- Una sesión nueva debería leer primero `CLAUDE.md` (se carga solo) y, según la tarea, el doc concreto de `docs/`.
- **Tras cualquier cambio, revisar la documentación** (`CLAUDE.md` y `docs/`) y actualizar lo desfasado en el mismo commit. Añadir también una línea al historial de esta guía cuando se commitee algo relevante.
- Antes de dar algo por terminado: arrancar `serve.py`, iniciar partida y comprobar consola/log sin errores.
