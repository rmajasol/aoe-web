# Reglas y contenido del juego

**Reinos en Guerra**: RTS 1 contra 1 contra la IA. **Objetivo:** destruir todos los edificios enemigos (si pierdes todos los tuyos, derrota). Los datos viven en `js/data.js`; si esta tabla discrepa, manda el código.

## Inicio de partida
- Mapa aleatorio 72×72 (semilla en `G.seed`, siempre con camino entre bases).
- Cada bando: 1 Centro Urbano ya construido + 5 aldeanos. Recursos iniciales: 200 comida, 200 madera, 100 oro, 100 piedra. La IA en *Difícil* recibe +200/+200/+100 extra.
- Los 5 aldeanos del jugador empiezan recolectando (3 comida, 2 madera).
- Población máxima 200. Cada casa +5, centro urbano +8.

## Edades
| Edad | Coste para llegar | Tiempo |
|---|---|---|
| Oscura (0) | — | — |
| Feudal (1) | 500 🍖 | 20 s |
| Castillos (2) | 800 🍖 200 🪙 | 26 s |
| Imperial (3) | 1000 🍖 800 🪙 | 32 s |

Se investiga en el Centro Urbano (uno a la vez). Cada edad da **+6 %** de vida (a unidades nuevas) y de ataque a tus unidades, y desbloquea unidades/edificios. *Nota: el Centro Urbano es construible solo desde Edad de los Castillos.*

## Recursos y recolección
| Fuente | Recurso | Cantidad | Tasa |
|---|---|---|---|
| Árbol | madera | 100 | 0.9/s |
| Arbusto de bayas | comida | 200 | 1.0/s |
| Mina de oro | oro | 800 | 0.8/s |
| Cantera | piedra | 800 | 0.8/s |
| Granja (edificio) | comida | 350 (se agota y desaparece) | 0.6/s, máx. 5 aldeanos |
| Carcasa (caza) | comida | según animal | 1.5/s |

Un aldeano lleva 10 y debe entregarlo en un edificio de entrega: Centro Urbano (todo), Molino (comida), Aserradero (madera), Campamento minero (oro y piedra). Cazar: los aldeanos lanzan lanzas (10 de daño) a ciervos, jabalíes, cerdos, ovejas; luego recogen la carcasa.

## Fauna
| Animal | Vida | Comida | Comportamiento |
|---|---|---|---|
| Ciervo 🦌 | 30 | 140 | Huye rápido al acercarse unidades |
| Jabalí 🐗 | 80 | 320 | **Contraataca** (11 de daño) si lo hieres |
| Cerdo 🐖 | 45 | 170 | Pasivo |
| Oveja 🐑 | 28 | 110 | Pasivo |

## Unidades
`A`=ataque, `R`=rango (casillas, 0=cuerpo a cuerpo), `Arm`=armadura cuerpo a cuerpo/distancia. Bonus = multiplicador contra clase.

| Unidad | Coste | Tiempo | Vida | A | R | Arm | Vel | Edad | Se entrena en | Bonus |
|---|---|---|---|---|---|---|---|---|---|---|
| Aldeano | 50🍖 | 9 s | 25 | 3 | 0 | 0/0 | 2.2 | 0 | Centro Urbano | — |
| Espadachín | 50🍖 25🪙 | 12 | 60 | 9 | 0 | 1/1 | 2.1 | 0 | Cuartel | — |
| Lancero | 35🍖 25🪵 | 10 | 45 | 4 | 0 | 0/1 | 2.2 | 0 | Cuartel | ×5 vs caballería |
| Arquero | 25🪵 45🪙 | 13 | 35 | 6 | 6 | 0/0 | 2.2 | 1 | Campo de tiro | ×1.3 vs infantería |
| Caballero | 60🍖 75🪙 | 17 | 110 | 11 | 0 | 2/2 | 3.6 | 2 | Establo | ×1.5 vs arqueros |
| Ariete | 160🪵 75🪙 | 24 | 160 | 8 | 0 | 0/8 | 1.6 | 2 | Cuartel | ×5 vs edificios; **solo ataca edificios**; 2 de población |
| Campeón | 80🍖 55🪙 | 15 | 105 | 14 | 0 | 3/3 | 2.3 | 3 | Cuartel | — |

Contraataques: lanceros > caballería > arqueros > infantería; arietes para edificios. Las armaduras restan daño plano (mínimo 1).

## Edificios
| Edificio | Tamaño | Vida | Coste | Tiempo | Edad | Función |
|---|---|---|---|---|---|---|
| Casa | 2 | 300 | 30🪵 | 15 s | 0 | +5 población |
| Granja | 3 | 120 | 60🪵 | 10 | 0 | Comida renovable (transitable) |
| Aserradero | 2 | 400 | 100🪵 | 15 | 0 | Entrega de madera |
| Molino | 2 | 400 | 100🪵 | 15 | 0 | Entrega de comida |
| Campamento minero | 2 | 400 | 100🪵 | 15 | 0 | Entrega de oro y piedra |
| Cuartel | 3 | 900 | 150🪵 | 30 | 0 | Entrena infantería y arietes |
| Campo de tiro | 3 | 900 | 150🪵 | 30 | 1 | Entrena arqueros |
| Establo | 3 | 900 | 150🪵 | 30 | 1 | Entrena caballeros |
| Torre de vigilancia | 2 | 700 | 50🪵 100🪨 | 25 | 1 | Dispara (8, alcance 7) |
| Centro urbano | 4 | 1500 | 300🪵 200🪨 | 60 | 2 | +8 pob., entrega todo, entrena aldeanos, dispara (5, alcance 6) |

Construcción: varios aldeanos aceleran con `n^0.7`. La vida sube conforme se construye. Se puede construir solo en casillas **ya exploradas** (no en negro). Cola de entrenamiento: máx. 6 por edificio.

## Dificultades (IA)
| | Fácil | Normal | Difícil |
|---|---|---|---|
| Aldeanos objetivo | 16 | 26 | 36 |
| Velocidad de recolección | ×0.8 | ×1.0 | ×1.25 |
| Primer ataque no antes de | 7:00 | 5:30 | 4:00 |
| Oleada inicial / incremento | 6 / +3 | 10 / +4 | 14 / +5 |
| Granjas máx. | 4 | 6 | 8 |
| Intervalo de decisión | 1.6 s | 1.0 s | 0.7 s |
| Bonus inicial | — | — | +200🍖 +200🪵 +100🪙 |

## Controles
| Acción | Entrada |
|---|---|
| Seleccionar / caja | Clic izq. / arrastrar |
| Mismo tipo en pantalla | Doble clic (unidad o edificio) |
| Añadir / quitar de la selección | Shift/Ctrl + clic |
| Órden contextual (mover, atacar, recolectar, construir, punto de reunión) | Clic der. |
| Cámara | Flechas, bordes de pantalla, rueda central (arrastrar) |
| Zoom | Rueda |
| Comandos del panel | `Q W E R / A S D F / Z X C V` |
| Grupos | `Ctrl+1..9` crear, `1..9` seleccionar (dos veces seguidas = centrar cámara) |
| Aldeano inactivo | `.` o `,` (cicla) |
| Ir al Centro Urbano | `H` |
| Construir varios | `Shift` al colocar |
| Cancelar construcción/atacar-mover | `Esc` |
| Eliminar selección | `Supr` |
| Pausa / velocidad | `P` / `+` `-` (x1..x4) |
| Visor de log | `F9` |

Punto de reunión: con edificio(s) seleccionado(s), clic derecho en suelo o en un recurso (los aldeanos nuevos recolectarán; si el recurso se agota buscan otro igual cerca). Con varios edificios seleccionados, un solo clic fija el punto en todos y los botones entrenan una unidad en cada uno.
