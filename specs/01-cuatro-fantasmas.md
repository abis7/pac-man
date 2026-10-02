# SPEC 01 — Cuatro fantasmas con personalidad propia

> **Estado:** Aprobado
> **Depende de:** —
> **Fecha:** 2026-10-02
> **Objetivo:** Cuatro fantasmas con la IA clásica del arcade original (Blinky, Pinky, Inky y Clyde), cada uno con un comportamiento distinguible y solo Blinky persiguiendo de forma agresiva.

## Por qué existe este spec

Hoy el juego tiene dos fantasmas y `decideGhost` (en `src/js/game.js`) resuelve dos casos con un `if`: `kind === 'hunter'` o azar. Eso no es un sistema de personalidades, son dos ramas. Llevar el juego a cuatro fantasmas con cuatro comportamientos reales exige separar la IA del archivo de reglas, y ese refactor es el motivo de que el alcance incluya un archivo nuevo.

## Alcance

**Dentro:**

- Cuatro fantasmas en partida: Blinky, Pinky, Inky y Clyde.
- Una IA por fantasma, con la lógica de targeting del original: Blinky persigue la posición de Pacman; Pinky apunta cuatro celdas por delante de Pacman en su dirección; Inky apunta al punto medio entre Blinky y la posición de Pacman dos celdas por delante; Clyde persigue a Pacman mientras esté lejos y se retira a su esquina cuando está cerca.
- Los cuatro salen de la pen desde el primer frame, sin fases de liberación ni ventanas de dispersión.
- Velocidad idéntica para los cuatro (`GHOST_SPEED = 0.1` celda/frame).
- Colores canónicos por personaje: Blinky rojo, Pinky rosa, Inky cian, Clyde naranja.
- Etiqueta de nombre sobre cada fantasma, alternable con la tecla `G`, para poder comprobar los comportamientos en el navegador.

**Fuera de alcance (para specs futuros):**

- Puntos de poder y estado "asustado" (frightened) — requiere su propio spec.
- Que Pacman pueda comer fantasmas y los puntúe.
- Fases de dispersión (scatter), releasing progresivo de la pen por puntos o por tiempo.
- Velocidades distintas por personaje.
- Niveles adicionales o vidas extra.
- Cualquier mecanismo de persistencia (high scores, partida guardada).

## Modelo de datos

Posiciones iniciales (misma pen, escalonadas para que no se solapen). La pen ocupa `x` 11-16 en `y` 14:

```js
// src/js/maze.js
const GHOST_STARTS = [
  { x: 14, y: 14, kind: 'blinky' },
  { x: 13, y: 14, kind: 'pinky' },
  { x: 12, y: 14, kind: 'inky' },
  { x: 11, y: 14, kind: 'clyde' },
];
```

El array **define un orden significativo**: Blinky es el índice 0 y se actualiza primero en cada frame, que es lo que Inky necesita para calcular su objetivo.

```js
// src/js/ghosts.js
const GHOST_NAMES = {
  blinky: 'BLINKY',
  pinky: 'PINKY',
  inky: 'INKY',
  clyde: 'CLYDE',
};

const CLYDE_CORNER = { x: 0, y: 30 }; // esquina inferior izquierda
const CLYDE_CHASE_DISTANCE = 8;       // Manhattan, en celdas

// Objetivo de cada personaje. Devuelve la celda que el fantasma
// quiere alcanzar; decideGhostDir elige la dirección más cercana a ella.
function ghostTarget( ghost, pacman, ghosts );

function decideGhostDir( ghost, pacman, ghosts );

window.GHOST_NAMES = GHOST_NAMES;
window.ghostTarget = ghostTarget;
window.decideGhostDir = decideGhostDir;
```

Convenciones que se mantienen:

- Coordenadas de celda, origen arriba-izquierda. `x` en `[0,27]`, `y` en `[0,30]`.
- Las direcciones de un fantasma son las mismas cuatro de `DIRS` (`game.js`).
- La celda objetivo no necesita ser transitable: el fantasma se detiene al llegar a ella, igual que hoy con `canMove`.

## Plan de implementación

1. Crear `src/js/ghosts.js` con `GHOST_NAMES`, `CLYDE_CORNER`, `CLYDE_CHASE_DISTANCE` y `ghostTarget`, que devuelve un caso por personaje. Añadir su `<script>` en `src/index.html` **antes** de `game.js` (usa `DIRS` en runtime, no en carga). Prueba manual: cargar la página y confirmar que la consola no muestra errores.

2. Implementar `decideGhostDir( ghost, pacman, ghosts )` en `ghosts.js`: calcular las direcciones legales con las mismas reglas de `decideGhost` actual (excluir la reversa, permitirla si no hay salida) y elegir la que minimiza la distancia Manhattan a `ghostTarget`. No decide quién es quién: hay un target por personaje y una regla de elección compartida. Prueba manual: Blinky y Pinky ya se mueven de forma distinta sin haber tocado `game.js`.

3. Cambiar `GHOST_STARTS` en `maze.js` a los cuatro fantasmas con su `kind`. Prueba manual: al recargar se ven cuatro sprites distintos dentro de la pen.

4. En `game.js`, borrar la lógica de `kind` de `decideGhost` y dejar una llamada a `decideGhostDir`; eliminar `OPPOSITE` si queda sin uso. Mantener el orden de `game.ghosts.forEach` para que Blinky se mueva antes que Inky. Prueba manual: el juego sigue funcionando como antes del cambio, con cuatro fantasmas moviéndose.

5. En `render.js`, sustituir el array posicional `GHOST_COLORS` por un mapa por `kind` (rojo, rosa, cian, naranja) para que el color deje de depender del orden del array. Prueba manual: los cuatro colores son correctos y ningún sprite sale del laberinto.

6. Añadir la ayuda de verificación: flag `game.showGhostNames` (inicial `false`), listener de `G` en `main.js` que lo alterna, y en `draw` el nombre del fantasma dibujado sobre su sprite cuando el flag está activo. Prueba manual: pulsar `G` muestra BLINKY, PINKY, INKY y CLYDE sobre sus sprites; volver a pulsar las oculta.

7. Recorrido final de cada personalidad con `G` activo: Clyde alejándose de Pacman cuando está a menos de 8 celdas, e Inky describiendo una ruta distinta a Blinky y Pinky desde la misma posición inicial. Prueba manual: el juego se mantiene estable durante un par de minutos con los cuatro dentro del laberinto.

## Criterios de aceptación

- [ ] Al cargar `src/index.html` no aparece ningún error en la consola del navegador.
- [ ] Hay exactamente cuatro fantasmas en partida, identificables por sus cuatro colores canónicos (rojo, rosa, cian, naranja).
- [ ] Blinky se dirige hacia la celda en la que está Pacman.
- [ ] Pinky se dirige hacia la celda situada cuatro celdas por delante de Pacman según su dirección de avance.
- [ ] Inky se dirige hacia el punto medio entre Blinky y la celda situada dos celdas por delante de Pacman.
- [ ] Clyde se dirige hacia Pacman cuando la distancia Manhattan es mayor de 8 celdas, y hacia su esquina inferior izquierda cuando es menor o igual a 8.
- [ ] Al observar Blinky y Pinky desde la misma posición inicial, eligen direcciones distintas la mayoría de las veces.
- [ ] Pulsar `G` muestra el nombre de cada fantasma sobre su sprite; volver a pulsarlo los oculta.
- [ ] Los cuatro fantasmas se mueven a la misma velocidad que el fantasma actual (0.1 celda/frame).
- [ ] Ningún fantasma abandona el laberinto ni se queda atascado en una pared durante un recorrido completo de la partida.
- [ ] Comer todos los puntos sigue mostrando el overlay de victoria y perder las tres vidas sigue mostrando el de derrota.

## Decisiones

- **Sí:** las cuatro personalidades clásicas del arcade en vez de un set propio simplificado. Son cuatro comportamientos ya diseñados, distinguibles entre sí y reconocibles para quien conoce el juego original.
- **No:** replicar el bug del arcade donde "arriba" de Pinky e Inky desvía además a la izquierda. Se usa la dirección literal; el bug no aporta nada a este juego.
- **Sí:** los cuatro libres desde el primer frame. La salida progresiva por puntos o por tiempo es un mecanismo de dificultad aparte, y mezclarla aquí haría imposible atribuirle a la IA cualquier diferencia de dificultad.
- **No:** velocidades distintas por personaje. Con la misma velocidad, una diferencia de comportamiento se lee como IA y no como ritmo.
- **Sí:** IA en un archivo nuevo `src/js/ghosts.js`. `game.js` conserva reglas, movimiento y colisiones; el archivo de IA no toca el grid ni las vidas.
- **Sí:** un único `ghostTarget` por personaje y una única regla de elección compartida, en lugar de cuatro funciones de decisión completas. Los cuatro personajes se distinguen por el objetivo, que es exactamente el eje en el que difieren.
- **No:** puntos de poder ni estado asustado. Van de la mano y multiplican el alcance (colisiones, render, estados del juego).
- **Sí:** `kind` como identificador estable del personaje, en lugar del actual `'hunter'`/`'random'`, que describe comportamiento y no identidad. Blinky sigue siendo el cazador, pero ahora hay cuatro identidades.
- **No:** dispersión (scatter). En el original es la válvula de escape que hace el chase justo; sin ella, cuatro fantasmas a la misma velocidad son más agresivos de forma uniforme.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Cuatro fantasmas a la misma velocidad sin scatter suben la dificultad y alargan la partida | Es el cambio pedido. Se acepta a conciencia: si molesta, el scatter o el releasing por dots van en su propio spec. |
| Las etiquetas de `G` se olvidan en producción y quedan como ruido | Se activa por defecto apagado (`false`) y es una tecla suelta que no colisiona con las flechas. |
| Blinky se decide primero en el frame, así que Inky ve una posición ya movida de Blinky | Es el comportamiento elegido. Documentado aquí para que nadie lo lea como un error. |
| Queda una referencia al viejo `kind: 'random'` y un fantasma degrada a comportamiento aleatorio | El paso 4 borra la rama vieja entera; los criterios de aceptación verifican las cuatro comportamientos. |

## Lo que **no** está en este spec

- Puntos de poder, estado asustado y comer fantasmas.
- Fases de dispersión y liberación de la pen.
- Velocidades distintas, colores editables o skins.
- Niveles adicionales, vidas extra o marcador persistente.
- Cualquier cambio en el laberinto o en el comportamiento de Pacman.

Cada uno de esos, si aterriza, va en su propio spec.