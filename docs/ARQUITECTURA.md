# Arquitectura

~3.000 líneas, 8 scripts clásicos cargados en orden desde `index.html`. Sin módulos: todo vive en el scope global. `'use strict'` en cada archivo.

Orden de carga: `log → data → game → ai → render → sprites → ui → main`. `main.js` es el último porque conecta todo y arranca el bucle.

## 1. Estado global `G` (game.js)
```
G.t            tiempo de partida (s)        G.speed 1..4     G.paused  G.over
G.units/buildings/nodes/animals   arrays de entidades
G.proj         proyectiles en vuelo         G.fx   efectos visuales/partículas
G.players[0|1] { id, name, res{food,wood,gold,stone}, age, pop, popCap, researching, ai }
G.byId         Map id -> entidad            G.nextId
G.terrain      Uint8Array (1 = agua)        G.blk  (1 = no transitable)
G.occ          (1 = casilla ocupada)        G.vis  (0 oculto / 1 explorado / 2 visible)
G.pv           versión de pathing           G.seed  semilla del mapa
```
Mapa 72×72 casillas (`MAP_W/MAP_H`). Bases en (11,56) jugador y (57,12) enemigo, esquinas opuestas.

## 2. Entidades
Todas tienen `id, kind, type, owner, x, y`.
- **unit**: `hp, maxhp, order, path, pi, carry, ctype, cool, scan, ...`. Posición flotante en casillas. Stats escalan `1 + 0.06·edad` (vida al crearla, ataque al golpear).
- **building**: `x,y` es la esquina superior-izquierda, `w=h=size`. `done`, `progress`, `queue[]` (máx. 6), `qt` (progreso de cola), `rally`, `research`, `food` (granjas).
- **node** (recurso): árbol, bayas, oro, piedra, carcasa. `amount`, `res`. Al agotarse → `killEntity`. Las carcasas tienen `noblock`.
- **animal**: máquina de estados `graze → walk`, `flee`, `fight` (jabalí). Al morir deja una carcasa.

Borrado: `killEntity(e)` marca `dead`, libera mapa, genera efectos y llama a `checkEnd()` si es edificio. `cleanup()` purga arrays solo si `G.dirty`. `killEntityQuiet` para granjas agotadas (sin efectos).

## 3. Generación de mapa (`genMap(seed)`)
PRNG `mulberry32`. Lagos (4–6) lejos de las bases → bosques (16 paseos aleatorios) → recursos por base (bayas, oro, piedra, 2 bosques) → recursos centrales → fauna → comprobación de **conectividad** por BFS entre bases. `startGame` reintenta con `seed++` hasta que sea conectado.

## 4. Pathfinding (A*)
`findPath(sx, sy, goal, partial)`: A* sobre rejilla 8-direccional con heap binario propio, buffers tipados reutilizados con *stamp* (sin realocar). Límite 9000 iteraciones. `goal = {x,y,w,h,reach}`: se acaba al estar a `reach` casillas del rectángulo objetivo. `partial=true` devuelve el mejor intento si no hay camino. Después se **suaviza** con línea de visión (`los`, con margen 0.28). No hay corte diagonal entre esquinas bloqueadas.

`stepAlong(u, dt)` avanza por el camino y devuelve `'moving' | 'done' | 'blocked'`. Si `G.pv` cambió, revisa las próximas 6 casillas por si se bloquearon. `separate(dt)` empuja suavemente las unidades que se solapan.

## 5. Bucle de simulación (`update(dt)`)
Orden por tick: `aiUpdate` → `updateBuilding` (construcción, cola, investigación, torres) → `updateUnit` → `updateAnimal` → sacudidas de nodos → `separate` → `updateProj` → polvo de pasos → avance/limpieza de `fx` → niebla (cada 0.25 s) → `cleanup`.

`updateUnit` es un `switch` sobre `order.type`:
- `move` / `amove`: camino + `stepAlong`; `amove` adquiere objetivos con `acquire` (prioriza unidades; los aldeanos pesan +1.5 de distancia; edificios solo si no hay unidades).
- `attack`: `chase` (persigue, ataca a `reach`, repath si el objetivo se movió). `auto:true` abandona si se aleja más de `sight+3`.
- `build`: acerca y suma `b.bn`; `updateBuilding` convierte `bn` obreros en velocidad `bn^0.7`. Al terminar, `afterBuild` reasigna (recoger recurso cercano, otra obra, o volver al recurso previo).
- `gather`: sub-estados `go → work → drop`. Lleva `CARRY=10`. Si el nodo se agota busca otro del mismo recurso (radio 16). `findDropoff` busca el edificio `drop` más cercano.

Unidades militares ociosas autoescanean (`scan` cada ~0.5 s) con radio `sight`. Si reciben daño sin orden, contraatacan (excepto aldeanos y arietes).

### Combate
`calcDmg`: `atk · (1+0.06·edad) · bonus[cls_objetivo]`, menos armadura (`mArm` si melee, `pArm` si distancia), mínimo 1. Las unidades a distancia, torres y centros urbanos lanzan proyectiles (`G.proj`) que persiguen al objetivo y, si fallan/ya está muerto, dejan una flecha clavada (fx `stuck`). Los aldeanos cazan lanzando lanza (10 de daño, alcance 3.6).

Clases (`cls`): `vil, inf, arc, cav, siege, bld, animal`. Edificios: `mArm 2, pArm 10` (las flechas apenas los dañan); granjas 0/0.

### Cola, población y reunión
`enqueue` paga y reserva población al encolar; `cancelQueue` reembolsa. Al completar, la unidad sale por `exitTile` (casilla libre más cercana al punto de reunión). Con `rally`: aldeanos → `issueGather` si es un recurso (si se agotó, buscan el más cercano del mismo tipo `rtype` en radio 10, o 1.8 si el punto era suelo); resto → `issueMove`.

## 6. IA (`ai.js`)
`aiUpdate(p, dt)` corre cada `d.think` segundos (0.7–1.6). Pasos:
1. Encolar aldeanos hasta `d.vils`.
2. Casas cuando `popCap - pop <= margen`.
3. Repartir aldeanos ociosos según una **mezcla objetivo** por edad (comida/madera/oro/piedra) y rebalancear periódicamente. `aiAssign` construye molino/aserradero/campamento si el dropoff queda a >6–7 casillas y granjas si no quedan bayas.
4. Edificios militares según tabla `prodWanted` (tipo, edad mínima, cantidad, aldeanos mínimos).
5. Subir de edad cuando tiene suficientes aldeanos (`ageNeed` por edad); mientras ahorra, `afford2` reserva el coste de la edad.
6. Producción militar: arqueros / caballeros fijos; en cuartel mezcla campeones (edad 3), arietes, lanceros (si hay caballería enemiga) y espadachines.
7. Defensa (amenaza a <15 casillas del TC → `amove` de todo el ejército) y **oleadas**: lanza cuando `G.t >= nextAttack` y el ejército alcanza `waveBase + wave·waveInc` (máx. 45). Tras la oleada reagrupa y vuelve a atacar si el ejército baja de ~15 % del tamaño de oleada (+45 s de espera).

`DIFFS`: `easy / normal / hard` (aldeanos objetivo, multiplicador de recolección `mul`, primer ataque en s, tamaños de oleada, granjas, bonus inicial para `hard`). El multiplicador se aplica en `gatherMul(owner)`.

La IA **no hace trampa con la niebla** en sus decisiones de combate (ve todo el mapa), pero no recibe bonus salvo `mul` y el bonus de recursos en difícil.

## 7. Render (`render.js`, `sprites.js`)
- **Proyección isométrica 2:1**: `isoX = (tx−ty)·TILE + OX`, `isoY = (tx+ty)·TILE/2`. Cámara `cam {x,y,zoom}` en píxeles de mundo iso; zoom 0.5–1.8.
- **Terreno**: se genera una vez por píxel en `buildTerrain()` a un canvas grande (`terrainCanvas`) + `mmTerrain` para el minimapa; agua animada aparte (`waterTiles`).
- **Niebla**: canvas pequeño (1 px/casilla) escalado con suavizado; `G.vis` 1 = sombreado, 0 = negro. Las unidades enemigas solo se dibujan/seleccionan en casillas con `vis == 2`.
- **Ordenación en profundidad**: `render()` rellena `drawList` con todo lo visible y ordena por profundidad (`x+y`) antes de dibujar.
- **Edificios y vegetación**: se "hornean" una vez a canvas a `SC=2` de resolución (`BSPR[tipo][owner]`, `SPR`) con una mini-API 3D propia (`pj` proyecta X,Y,Z; `wallLeft/wallRight`, `roofGable/Hip`, `cyl`, etc.). Texturas procedurales en `TEX` (`buildTextures`).
- **Unidades y animales**: *no* son sprites; se componen **cada frame** con figuras 3D (`FG`/`fp`, `fcap` cápsulas, `fsph` esferas, `fpoly`, `fbox`) proyectadas isométricamente, ordenadas por profundidad en `figFlush`. Animación por `u.anim`, `u.swing`, estado (andando/trabajando/atacando). `FIGS`/`FIGA` tienen una función por tipo; `USPR` cachea.
- **Efectos (`G.fx`)**: `blood, corpse, boom, rubble, smoke, chip (partícula con física), dust, spark, float (+N), ring, ping, fell (árbol cayendo), done, stuck`. Cada uno con `t`/`dur`.
- **Minimapa en rombo** (`renderMinimap`, `MMK`), clic izq. centra cámara, clic der. ordena mover.
- **Extras**: bandadas de pájaros (`drawBirds`), nubes (`cloudSpr`) y ambiente añadidos en el pulido visual.

## 8. UI (`ui.js`)
- Selección: clic con `pick()` (hit-test en espacio iso por tipo, prioridad unidades > animales > edificios > nodos), caja de arrastre, doble clic = todos del mismo tipo en pantalla, Shift/Ctrl para añadir (unidades con unidades, edificios con edificios). Máx. 80 seleccionados. **Selección múltiple de edificios** permite entrenar a la vez en varios y fijar un punto de reunión común.
- Clic derecho contextual (`contextCommand`): edificio → rally; animal/enemigo → atacar; nodo → recolectar; granja propia → recolectar; obra propia → construir; suelo → mover.
- Panel de comandos (`getCommands`) dinámico según selección: aldeano → 10 edificios; militar → atacar-mover; edificio → entrenar/avanzar edad; siempre Detener/Eliminar. Teclas `QWER/ASDF/ZXCV` por slot. Se reconstruye solo si cambia la firma (`curSig`).
- Panel de información (`refreshInfo`) con firma (`infoSig`) y actualizaciones dinámicas de barras.
- Sonido: síntesis WebAudio sin archivos (`ui.js`). Primitivas `nz` (ruido filtrado) y `tn` (tono con barrido) combinadas en el diccionario `SND` (una receta por sonido: `chop` hacha en madera, `mine`/`mineGold` pico en roca/oro, `berry`, `farm`, `butcher`, `hammer`, `timber` árbol que cae, `drop*` entregas por recurso, `sword`, `bash` (contra edificios), `bow`, `arrowhit`, `die`, `crash`). Cada golpe varía el tono (`r`) y pasa por compresor maestro. `sfxAt(kind, x, y)` solo suena si el punto está en pantalla y visible, con límite de frecuencia **por tipo** (`sfxGap`), y ajusta paneo estéreo/volumen según la posición en pantalla. `sfx(kind)` sin posición se usa para avisos de interfaz (`train|build|alert|age`, tonos simples).
- `notify(msg, kind)`: mensajes apilados (máx. 5, 5 s), kinds `ok|warn|danger`.

## 9. Registro / diagnóstico (`log.js`)
`LOG` guarda cada carga de página como "sesión" en `localStorage` (`aoe-log-current`, `aoe-log-prev`, hasta 5 anteriores, 800 líneas/sesión). Vuelca al instante en errores y cada 1 s en el resto; latido de snapshot cada 5 s con estado de partida (unidades, edificios, recursos, memoria). En `pagehide` marca `clean=true`; si al abrir la siguiente vez una sesión no está limpia → **posible crash**, y el menú ofrece verla. Captura `error`, `unhandledrejection`, `console.error/warn`, `webglcontextlost`, frames > 250 ms. Visor con **F9**; en consola `LOG.dump()`, `LOG.previous()`, `LOG.download()`. API: `LOG.event/info/warn/error/snap`.

## 10. Servidor (`serve.py`)
`http.server` con `Cache-Control: no-store` para ver siempre el código más reciente. Puerto 8765 por defecto (arg o `PORT`). Es solo para desarrollo; el juego es 100 % estático. Única dependencia externa en runtime: la fuente Cinzel de Google Fonts (decorativa).
