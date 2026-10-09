# SPEC 04 — Pac-Man adaptativo: fantasmas que aprenden, mapa que cambia y frutas con habilidades

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02, SPEC 03
> **Fecha:** 2026-10-07
> **Objetivo:** Convertir el Pac-Man actual en un juego adaptativo donde los fantasmas aprenden durante la partida las rutas y giros del jugador, el laberinto abre y cierra compuertas a medida que se comen dots, y cada fruta otorga a Pac-Man una habilidad temporal.

## Por qué existe este spec

El juego actual es determinista: cada fantasma persigue una celda objetivo fija (`ghostTarget` en `src/js/ghosts.js`), el laberinto es estático (`MAZE` en `src/js/maze.js`) y la única mecánica de poder es el modo `frightened` del SPEC 02. Un jugador que memoriza una ruta segura gana siempre igual.

Este spec añade tres sistemas que se refuerzan entre sí:

- Los fantasmas observan al jugador y usan lo observado para anticiparse.
- El mapa cierra las rutas favoritas del jugador y abre otras nuevas.
- Las frutas dan herramientas para responder, incluida una que "borra el rastro" que los fantasmas han aprendido.

**Aviso de tamaño.** Según la regla del skill `/spec`, esta feature toca tres áreas (IA, mapa, ítems) y podría partirse en tres specs. Se mantiene como un único spec por petición explícita, pero el plan está dividido en tres bloques independientes (A, B, C). Cada bloque deja el juego jugable y puede implementarse y revisarse por separado. Si se prefiere, cada bloque se puede extraer tal cual a `05-`, `06-` y `07-`.

## Punto de partida (arquitectura real)

Resumen de lo que existe hoy y en lo que se apoya este spec:

- Scripts clásicos sin módulos, comunicados por `window`. Orden actual en `src/index.html`: `maze.js` → `ghosts.js` → `game.js` → `render.js` → `main.js`. (`AGENTS.md` aún no menciona `ghosts.js`; se corrige en el paso 10.)
- Rejilla 28×31. Códigos de tile: `0` vacío, `1` pared, `2` dot, `3` puerta del pen, `4` power pellet.
- `MAZE` es prístino; `createGame()` lo copia a `game.grid`. El render dibuja siempre desde `game.grid`, así que cambiar `game.grid` en caliente ya se refleja en pantalla sin tocar `drawWalls`.
- `isWall` y `canMove` leen `game.grid` en cada llamada, de modo que fantasmas y Pac-Man respetan automáticamente un muro nuevo.
- Movimiento por fracciones de celda: Pac-Man a `0.125` celda/frame, fantasmas a `0.1`. Las decisiones solo se toman cuando el actor está alineado (`aligned()`).
- `decideGhostDir(ghost, pacman, ghosts, grid)` elige la dirección legal que más acerca a `ghostTarget(...)`. En `frightened` usa `frightenedDir`.
- El juego tiene 279 dots + pellets comibles (`dotsRemaining` inicial). No hay niveles: comerlos todos lleva a `won`.
- Temporizadores en frames (rAF a ~60 fps), igual que `FRIGHTENED_DURATION`.

## Alcance

**Dentro:**

- **A. Aprendizaje de fantasmas.**
  - Un perfil del jugador por partida: mapa de calor de celdas visitadas y estadísticas de giros en cada intersección.
  - Un nivel de aprendizaje `adapt.level` que crece de forma progresiva con las observaciones, con un tope para que el juego siga siendo justo.
  - Una función de predicción `predictPacman` que recorre el laberinto siguiendo los giros más frecuentes del jugador.
  - Los cuatro fantasmas usan la predicción, cada uno a su manera, sin perder su personalidad del SPEC 01.
  - Indicador `IA nn%` en el HUD y una vista de depuración con la tecla `H`.
- **B. Mapa dinámico.**
  - Seis compuertas predefinidas que alternan entre pared y pasillo.
  - Tres mutaciones por partida, disparadas por dots comidos.
  - La compuerta que se cierra es la más usada por el jugador según el mapa de calor.
  - Aviso visual de 2 s antes de cada cambio y comprobación de seguridad antes de aplicarlo.
- **C. Frutas y habilidades.**
  - Cuatro frutas por partida en una celda fija bajo el pen, cada una con su habilidad: Turbo, Escudo, Congelar y Niebla.
  - Una sola habilidad activa a la vez, con barra de tiempo en el HUD.

**Fuera de alcance (para specs futuros):**

- Persistencia del perfil entre partidas (`localStorage`). El perfil se reinicia en cada `createGame()`.
- Niveles, progresión de dificultad entre partidas y pantalla de puntuaciones.
- Generación procedural del laberinto. Solo se alternan compuertas predefinidas.
- Aprendizaje durante `frightened` (cómo caza el jugador tras un pellet).
- Fases `scatter`/`chase` del arcade.
- Sonido, animaciones de transición y sprites de fruta detallados.
- Cambios de velocidad de los fantasmas.

## Modelo de datos

### A. Perfil del jugador (`src/js/adapt.js`, nuevo)

```js
// Se crea en createGame() y vive en game.adapt. Sobrevive a la pérdida de
// vidas (resetPositions no lo toca); se reinicia con cada partida nueva.
game.adapt = {
  level: 0,          // 0..ADAPT_MAX: cuánto pesa lo aprendido en la IA
  samples: 0,        // decisiones observadas en intersecciones
  heat: [/* 31 filas x 28 cols de números */], // visitas por celda
  turns: {},         // 'x,y,dirEntrada' -> { left: n, right: n, up: n, down: n }
  lastCell: null,    // { x, y } última celda contada en heat
  decayTimer: 0,     // frames hasta el próximo decaimiento de heat
};
```

Constantes (en `adapt.js`):

- `ADAPT_MAX = 0.8`. El aprendizaje nunca llega al 100 %.
- `SAMPLES_FULL = 120`. Decisiones necesarias para llegar a `ADAPT_MAX`.
- `ADAPT_THRESHOLD = 0.4`. A partir de aquí se activan los comportamientos más agresivos.
- `MIN_TURN_SAMPLES = 3`. Mínimo de observaciones en una intersección para fiarse de ella.
- `HEAT_DECAY_EVERY = 600` frames (~10 s) y `HEAT_DECAY = 0.9`. Lo antiguo pesa menos y el jugador puede "despistar" cambiando de hábitos.

Fórmula del nivel: `level = ADAPT_MAX * min(1, samples / SAMPLES_FULL)`.

Una **intersección** es una celda alineada con 3 o más direcciones transitables para `'pacman'`.

API expuesta en `window`:

- `createAdapt()` devuelve el objeto anterior vacío.
- `recordPacman(game)` se llama desde `movePacman` cuando Pac-Man está alineado. Suma calor si cambió de celda. Si la celda es intersección, registra en `turns` la dirección con la que sale y suma `samples`.
- `tickAdapt(game)` se llama una vez por frame desde `update`. Aplica el decaimiento y recalcula `level`.
- `effectiveLevel(game)` devuelve `0` si la habilidad Niebla está activa y `game.adapt.level` en otro caso.
- `predictPacman(game, steps)` devuelve una celda `{ x, y }`. Avanza `steps` celdas desde Pac-Man en su dirección actual. En cada intersección toma el giro más frecuente de `turns` si tiene al menos `MIN_TURN_SAMPLES`; si no, sigue recto o toma la primera salida legal sin dar la vuelta. Atraviesa el túnel igual que `wrapTunnel`.
- `hotspot(game, from, minDist)` devuelve la celda con más calor a distancia Manhattan mayor que `minDist` de `from`, o `null` si el mapa de calor está vacío.

### A. Uso en `ghostTarget` (`src/js/ghosts.js`)

`decideGhostDir` pasa a recibir el juego completo como quinto argumento: `decideGhostDir(ghost, pacman, ghosts, grid, game)`. `ghostTarget` recibe `L = effectiveLevel(game)`.

| Fantasma | Con `L = 0` (clásico, sin cambios) | Con `L > 0` |
| --- | --- | --- |
| Blinky | celda de Pac-Man | si `L >= ADAPT_THRESHOLD`, `predictPacman(game, 2)` |
| Pinky | `aheadOf(pacman, 4)` en línea recta | `predictPacman(game, 4 + round(4 * L))`: sigue los giros aprendidos |
| Inky | vector Blinky + `aheadOf(pacman, 2)` | mismo vector con pivote `predictPacman(game, 2)` |
| Clyde | se retira a `CLYDE_CORNER` si está cerca | si `L >= ADAPT_THRESHOLD`, se retira a `hotspot(game, clyde, 8)`: espera en la zona favorita del jugador |

`frightenedDir` no cambia.

### B. Compuertas (`src/js/maze.js` y `src/js/mapshift.js`, nuevo)

Las compuertas son pares de celdas simétricos respecto al eje central (cols 13 y 14). Se validaron por BFS sobre `MAZE`: las 64 combinaciones de abierta/cerrada de las seis compuertas (A, B, C, D, E, F, donde A–D se abren y E–F se cierran; ver abajo) mantienen todas las celdas transitables conectadas y no crean callejones sin salida.

```js
// maze.js: geometría pura, sin estado.
const MAZE_GATES = [
  { id: 'A', cells: [ { x: 13, y: 1 },  { x: 14, y: 1 } ],  startsOpen: false }, // une los dos pasillos de la fila 1
  { id: 'B', cells: [ { x: 13, y: 8 },  { x: 14, y: 8 } ],  startsOpen: false },
  { id: 'C', cells: [ { x: 13, y: 20 }, { x: 14, y: 20 } ], startsOpen: false },
  { id: 'D', cells: [ { x: 13, y: 26 }, { x: 14, y: 26 } ], startsOpen: false },
  { id: 'E', cells: [ { x: 13, y: 5 },  { x: 14, y: 5 } ],  startsOpen: true },  // corta el pasillo largo de la fila 5
  { id: 'F', cells: [ { x: 13, y: 29 }, { x: 14, y: 29 } ], startsOpen: true },  // corta el pasillo largo de la fila 29
];
window.MAZE_GATES = MAZE_GATES;
```

`MAZE` no cambia: las compuertas cerradas ya son `#` en el string y las abiertas ya son `.`. Quedan descartadas como compuertas la fila 11 (salida del pen), la fila 14 (túnel), la fila 17 (celda de la fruta) y la fila 23 (inicio de Pac-Man).

```js
// Estado en game.mapShift, creado por createMapShift() en mapshift.js.
game.mapShift = {
  open: { A: false, B: false, C: false, D: false, E: true, F: true },
  triggers: [ 210, 140, 70 ], // valores de dotsRemaining que disparan mutación
  pending: null,  // { close: 'E', open: 'B', timer: 120 } durante el aviso
};
```

Constantes: `SHIFT_WARNING = 120` frames (2 s) y `SHIFT_RETRY = 30` frames.

Reglas de una mutación:

1. Cuando `dotsRemaining` baja de `triggers[0]`, se saca ese valor y se elige el par:
   - **Cerrar:** la compuerta abierta cuyas celdas suman más calor en `adapt.heat`. Así el mapa corta la ruta favorita.
   - **Abrir:** la compuerta cerrada cuyo centro está más lejos de Pac-Man.
   - Si no hay candidata para uno de los dos lados, solo se hace el otro.
2. Durante `SHIFT_WARNING` frames las celdas afectadas parpadean en el render y la jugabilidad no cambia.
3. Al terminar el aviso, se comprueba que ningún actor (Pac-Man o fantasma) tenga `Math.floor` o `Math.ceil` de `x`/`y` sobre una celda que se va a cerrar. Si alguno la ocupa, se espera `SHIFT_RETRY` frames y se vuelve a comprobar.
4. Al aplicar:
   - Una celda que se cierra pasa a `1`. Si tenía dot o pellet, se pierde.
   - Una celda que se abre pasa a `2`: aparece un dot nuevo como recompensa por explorar.
   - `dotsRemaining` se recalcula contando `2` y `4` en `game.grid`.

### C. Frutas y habilidades (`src/js/fruits.js`, nuevo)

```js
game.fruit = {
  active: false,
  x: 13, y: 17,     // celda fija bajo el pen (fila 17, fuera de toda compuerta)
  kind: null,       // 'cereza' | 'fresa' | 'naranja' | 'manzana'
  timer: 0,
  spawned: 0,       // cuántas frutas han salido ya en esta partida
  dotsEaten: 0,     // dots comidos acumulados (no se ve afectado por mutaciones)
};

game.pacman.ability = { kind: null, timer: 0 }; // una habilidad a la vez
```

Las frutas salen cuando `fruit.dotsEaten` llega a 50, 120, 190 y 250, en este orden fijo: cereza, fresa, naranja, manzana. Cada una dura `FRUIT_DURATION = 570` frames (9,5 s, como el arcade). Se usa un contador propio de dots comidos porque `dotsRemaining` sube cuando una compuerta se abre.

| Fruta | Puntos | Habilidad | Duración | Efecto |
| --- | --- | --- | --- | --- |
| Cereza | 100 | `turbo` | 300 frames | Pac-Man va a `0.2` celda/frame. El cambio de velocidad solo se aplica cuando está alineado, al entrar y al salir. |
| Fresa | 300 | `escudo` | 300 frames | Chocar con un fantasma `normal` no quita vida ni da puntos. |
| Naranja | 500 | `congelar` | 180 frames | Los fantasmas no se mueven (no se llama a `moveGhost`). Chocar con uno `normal` sigue matando. |
| Manzana | 700 | `niebla` | 480 frames | `effectiveLevel` devuelve 0 y `recordPacman` no registra nada: los fantasmas vuelven a la IA clásica y pierden el rastro. |

Reglas:

- La fruta se come cuando Pac-Man está alineado en `(fruit.x, fruit.y)`.
- Comer una fruta con otra habilidad activa la sustituye y reinicia el temporizador.
- Perder una vida cancela la habilidad activa y retira la fruta en pantalla.
- Las habilidades son independientes del modo `frightened`: pueden coexistir.

## Plan de implementación

Cada paso deja el juego cargando sin errores y jugable. Los tres bloques son independientes entre sí, salvo que B usa `adapt.heat` (con el mapa de calor vacío, B cierra la primera compuerta abierta).

**Bloque A — Fantasmas que aprenden**

1. Crear `src/js/adapt.js` con las constantes, `createAdapt()` y las funciones vacías exportadas en `window`. Añadir su `<script>` entre `maze.js` y `ghosts.js`. `createGame()` añade `game.adapt = createAdapt()`. Prueba manual: el juego funciona igual y `game.adapt` existe en consola.
2. Implementar `recordPacman` y `tickAdapt`, y llamarlas desde `movePacman` y `update`. Añadir `IA nn%` al HUD en `drawHUD`. Prueba: el porcentaje sube jugando y se queda en 80 %.
3. Añadir la vista de depuración con la tecla `H` en `main.js` (`game.showAdaptDebug`), siguiendo el patrón de la tecla `G`. `render.js` pinta el calor como celdas rojas semitransparentes y marca con una cruz la celda de `predictPacman(game, 4)`. Prueba: la cruz sigue la ruta que el jugador repite.
4. Implementar `predictPacman` y `hotspot`. Cambiar la firma de `decideGhostDir` y `ghostTarget` según la tabla, y actualizar la llamada en `decideGhost` de `game.js`. Prueba: con `IA 0%` los fantasmas se comportan como antes. Al repetir un giro varias veces, Pinky empieza a esperar en la salida de ese giro.

**Bloque B — Mapa que cambia**

5. Añadir `MAZE_GATES` a `maze.js`. Crear `src/js/mapshift.js` con `createMapShift()`, cargado después de `ghosts.js` y antes de `game.js`. `createGame()` añade `game.mapShift`. Prueba: sin cambios visibles.
6. Implementar `tickMapShift(game)` (disparo, elección, aviso y aplicación segura), llamado desde `update` después de mover a los actores. Añadir el parpadeo de las celdas de `pending` en `render.js`. Prueba: al comer unos 70 dots, dos compuertas parpadean y luego cambian. Ningún actor queda atrapado en una pared.

**Bloque C — Frutas y habilidades**

7. Crear `src/js/fruits.js` con `tickFruit(game)` (aparición, caducidad, comer y puntos), cargado después de `mapshift.js` y antes de `game.js`. Contar `fruit.dotsEaten` en `movePacman`. Dibujar la fruta como un círculo de color con un tallo en `render.js`. Prueba: sale la cereza a los 50 dots y desaparece si no se come.
8. Añadir `pacman.ability` y las habilidades `turbo` y `escudo` en `movePacman` y en el bloque de colisiones de `update`. Prueba: con cereza Pac-Man va visiblemente más rápido sin descuadrarse de la rejilla. Con fresa atraviesa fantasmas.
9. Añadir `congelar` (se salta `moveGhost`) y `niebla` (rama en `effectiveLevel` y en `recordPacman`). Mostrar en el HUD el nombre de la habilidad y una barra con el tiempo que queda. Prueba: con manzana el HUD marca `IA 0%` y vuelve a su valor al terminar.
10. Actualizar el texto del overlay inicial en `index.html` para explicar frutas y mapa cambiante. Corregir el orden de carga en `AGENTS.md`: `maze.js` → `adapt.js` → `ghosts.js` → `mapshift.js` → `fruits.js` → `game.js` → `render.js` → `main.js`.

## Criterios de aceptación

**General**

- [ ] El juego carga sin errores en la consola del navegador.
- [ ] `MAZE` no se modifica nunca: tras ganar o perder y pulsar Reiniciar, el laberinto vuelve al estado inicial con las compuertas A–D cerradas y E–F abiertas.

**A. Aprendizaje**

- [ ] Al empezar una partida el HUD muestra `IA 0%`.
- [ ] El porcentaje crece al jugar y nunca supera `IA 80%`.
- [ ] Perder una vida no reinicia el porcentaje. Pulsar Reiniciar sí lo pone a 0.
- [ ] Con `IA 0%`, `ghostTarget` devuelve exactamente lo mismo que antes de este spec para los cuatro fantasmas.
- [ ] La tecla `H` muestra y oculta el mapa de calor y la celda predicha.
- [ ] Tras girar 5 veces seguidas a la izquierda en la misma intersección, `predictPacman` predice ese giro al llegar a ella.
- [ ] Con `IA` en 40 % o más, Clyde se retira hacia la zona de más calor y no a la esquina inferior izquierda.

**B. Mapa dinámico**

- [ ] Hay exactamente tres mutaciones por partida, cuando `dotsRemaining` baja de 210, 140 y 70.
- [ ] Cada mutación va precedida de 2 s de parpadeo de las celdas afectadas.
- [ ] Ninguna mutación cierra una celda ocupada por Pac-Man o un fantasma.
- [ ] Tras cada mutación, todas las celdas transitables siguen conectadas y Pac-Man puede seguir moviéndose.
- [ ] La compuerta que se cierra es la abierta con más calor acumulado.
- [ ] Las celdas abiertas aparecen con un dot y `dotsRemaining` coincide con los dots visibles.
- [ ] La salida del pen (fila 11), el túnel (fila 14) y la celda de la fruta (13,17) nunca cambian.

**C. Frutas**

- [ ] Salen cuatro frutas por partida a los 50, 120, 190 y 250 dots comidos, en el orden cereza, fresa, naranja, manzana.
- [ ] Una fruta no comida desaparece a los 9,5 s.
- [ ] Comer una fruta suma 100, 300, 500 o 700 puntos según el tipo.
- [ ] Turbo: Pac-Man se mueve más rápido y sigue girando en las intersecciones sin atravesar paredes.
- [ ] Escudo: chocar con un fantasma normal no quita vida.
- [ ] Congelar: los fantasmas se quedan quietos 3 s y chocar con uno sigue quitando vida.
- [ ] Niebla: el HUD marca `IA 0%` durante 8 s y después recupera el valor anterior.
- [ ] Nunca hay más de una habilidad activa. El HUD muestra su nombre y el tiempo restante.
- [ ] Perder una vida cancela la habilidad activa.

## Decisiones tomadas y descartadas

- **Sí:** definición rápida sin ronda de preguntas. El encargo llegó como petición directa. Las decisiones de esta lista son valores por defecto razonables y se pueden revisar antes de pasar el spec a `Aprobado`.
- **Sí:** un único spec con tres bloques. Así se pidió. **No:** tres specs separados por ahora, aunque cada bloque se puede extraer tal cual.
- **Sí:** aprendizaje por estadísticas simples (calor y frecuencia de giros). Es explicable, depurable con la tecla `H` y no necesita librerías. **No:** redes neuronales ni Q-learning. No encajan en un proyecto vanilla sin build y su efecto sería difícil de verificar.
- **Sí:** tope `ADAPT_MAX = 0.8` y decaimiento del calor. El jugador siempre puede ganar cambiando de rutas. **No:** aprendizaje sin límite, porque convertiría la partida en imbatible.
- **Sí:** perfil por partida, que sobrevive a las vidas. **No:** `localStorage` entre partidas. Queda para otro spec, junto con su versionado.
- **Sí:** `L = 0` reproduce exactamente la IA del SPEC 01. Sirve de prueba de no regresión.
- **Sí:** compuertas predefinidas validadas por BFS. **No:** laberinto procedural. Rompería la geometría clásica y obligaría a validar conectividad en tiempo real.
- **Sí:** cerrar la compuerta con más calor. Une el mapa dinámico con el aprendizaje. **No:** compuertas aleatorias, porque no serían "adaptativas" y complicarían las pruebas.
- **Sí:** las celdas que se abren traen dot nuevo. Premia explorar la ruta nueva.
- **Sí:** contador `fruit.dotsEaten` propio para las frutas, porque `dotsRemaining` ya no es monótono con el mapa dinámico.
- **Sí:** orden fijo de frutas. Hace las pruebas reproducibles. **No:** fruta aleatoria por ahora.
- **Sí:** Turbo a `0.2` celda/frame (1/5). Igual que los fantasmas usan `0.1`, divide la celda en pasos que `aligned()` reconoce. **No:** valores como `1/6`, que nunca caen exactos en la rejilla.
- **Sí:** Escudo sin puntos. Evita duplicar la cadena 200/400/800/1600 del modo `frightened`.
- **No:** habilidad de atravesar paredes. Chocaría con las compuertas y con `isWall`.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Turbo descuadra a Pac-Man de la rejilla y deja de girar | Cambiar `speed` solo cuando `aligned(p.x) && aligned(p.y)`, al activar y al desactivar. |
| Una mutación encierra a un actor dentro de un muro | Comprobación con `Math.floor`/`Math.ceil` antes de aplicar y reintento cada `SHIFT_RETRY` frames. |
| Un fantasma decide dirección justo antes del cierre y queda frenado | `canMove` lee `game.grid` en cada frame: se detiene en la celda y decide de nuevo al siguiente frame alineado. |
| La IA aprendida se vuelve injusta | Tope `ADAPT_MAX`, decaimiento del calor y la fruta Niebla como contramedida. |
| Coste de rendimiento de `predictPacman` (4 fantasmas por decisión) | Recorrido lineal de 8 celdas como máximo y solo en frames alineados. Es despreciable frente al render. |
| `predictPacman` entra en bucle en el túnel | Aplicar el mismo `wrap` que `wrapTunnel` y limitar por número de pasos, no por distancia. |
| `AGENTS.md` desactualizado confunde a futuros agentes | El paso 10 corrige el orden de carga. |

## Preguntas abiertas (valores por defecto ya aplicados)

Se responden antes de pasar a `Aprobado`. Si no se cambian, el spec se implementa con el valor marcado.

1. **Persistencia del aprendizaje.** (a) Solo por partida *(por defecto)*. (b) Guardar el perfil en `localStorage` para que los fantasmas "recuerden" entre partidas.
2. **Elección de fruta.** (a) Orden fijo *(por defecto)*. (b) Aleatoria. (c) Adaptativa: sale la fruta que contrarresta lo que más te está costando.
3. **Escudo.** (a) Atravesar fantasmas sin puntos *(por defecto)*. (b) Mandar al fantasma a casa como si estuviera asustado.

## Lo que **no** está en este spec

- Persistencia del perfil entre partidas.
- Niveles, dificultad progresiva entre partidas y tabla de récords.
- Laberinto procedural o editor de mapas.
- Aprendizaje durante el modo `frightened`.
- Fases `scatter`/`chase`.
- Sonido y sprites detallados.

Cada uno de ellos, si llega, irá en su propio spec.
