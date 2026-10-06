# SPEC 03 — Corrección de salida de fantasmas desde el punto inicial

> **Estado:** Aprobado
> **Depende de:** —
> **Fecha:** 2026-10-06
> **Objetivo:** Corregir el comportamiento de los fantasmas al salir de su punto inicial (casa/pen): establecer correctamente su posición y dirección en la salida, evitar que aparezcan "encajados" o se muevan erráticamente al iniciar o al reingresar, y hacerlo por etapas para facilitar implementación y verificación.

## Por qué existe este spec

Al observar el comportamiento actual, los fantasmas empiezan en el pen (`GHOST_STARTS` en `y=14`, distribuidos en `x=14,13,12,11` para Blinky,Pinky,Inky,Clyde). Al moverse desde esas posiciones, especialmente al alinearse con la rejilla por primera vez, puede haber un "parpadeo" o comportamiento no deseado al decidir dirección y al atravesar la puerta del pen (`tile 3` en `y=12`, fila de puerta). También al resetear posiciones tras muerte de Pac-Man o al reingresar desde estado `eaten`, necesitamos que la transición sea limpia y consistente.

## Alcance

**Dentro:**

- Definir posiciones de inicio y de salida del pen de forma explícita (no dejarlo solo a valores dispersos).
- Establecer dirección inicial válida al salir del pen para cada fantasma (o dirección por defecto coherente).
- Asegurar que cuando un fantasma está en el interior/entrada del pen, respeta las restricciones de la puerta (tile `3`): fantasmas normales no atraviesan la puerta hacia dentro del área cerrada excepto lógica de salida; fantasmas en estado `eaten` (si se implementa junto con SPEC 02) pueden volver a través de ella — pero este spec se centra en salida normal.
- Corregir la lógica de `resetPositions()` para que coloque fantasmas en estado consistente (posición alineada, dirección válida, listos para decidir movimiento al primer frame alineado).
- Evitar que fantasmas "den marcha atrás" inmediatamente al salir del pen sin motivo, siguiendo comportamiento clásico (salen hacia arriba o hacia la puerta según caso).
- Hacerlo **por etapas**: cambios incrementales verificables en navegador (cada etapa deja el sistema funcional).

**Fuera de alcance:**

- Liberación progresiva por tiempo/puntos (release timers) — se mantiene simple: todos salen desde inicio (igual que actual).
- Estados frightened/eaten (dependen de SPEC 02) — este spec no los introduce, solo asegura comportamiento base.
- Cambios de velocidades o IA por tipo más allá de asegurar dirección inicial coherente.

## Modelo de datos

- Definir constantes explícitas para pen:
  - `PEN_Y = 14`, `PEN_EXIT_Y = 12` (fila de puerta), `PEN_CENTER_X = 13` o 14 según geometría.
- Posiciones iniciales claras en `GHOST_STARTS` (mantener orden Blinky,Pinky,Inky,Clyde y significado: índice 0 = Blinky actualizado primero).
- Posición de "espera" vs "salida": p. ej. Blinky puede estar fuera del pen o justo en salida; Pinky/otros dentro. Ajustar para evitar solapamiento y movimiento brusco.

## Plan de implementación (por etapas)

**Etapa 1 — Análisis y puntos de ajuste**
1. Identificar en código actual (`maze.js`, `game.js`, `ghosts.js`) dónde se decide dirección primera vez.
2. Verificar tile `3` (puerta): comportamiento de `isWall` para fantasmas (`actor==='ghost'` no bloquea tile 3? Revisar: `if (v===3 && actor==='pacman') return true; else if(v===3 && actor==='ghost') return false` — actualmente puerta no bloquea fantasma). Confirmar y documentar.

**Etapa 2 — Posiciones y reset limpio**
1. Ajustar `GHOST_STARTS` si necesario para que posiciones estén alineadas con rejilla y salida sea natural.
2. Modificar `resetPositions()` para poner `x,y` redondeados (`Math.round`) y dirección inicial coherente (p. ej. `up` hacia puerta, o `left/right` según posición).
3. Asegurar que al crear partida (`createGame()`), fantasmas empiezan en estado estable.

**Etapa 3 — Dirección al salir del pen**
1. En `moveGhost()`, cuando fantasma está alineado en celda justo antes/entrando a zona de salida, forzar dirección hacia fuera del pen (hacia `up` hasta superar `PEN_EXIT_Y`) hasta que esté fuera del área del pen. Después deja que IA decida.
2. Añadir bandera opcional `inPen` o detectar por `y >= PEN_EXIT_Y` (área pen). Transición única al salir.

**Etapa 4 — Verificación y ajustes finos**
1. Probar reinicio tras muerte (resetPositions) — no debe haber salto.
2. Probar inicio de partida — todos salen suavemente, sin quedar atascados.
3. Verificar orden de actualización (Blinky primero) no afecta salida.

## Criterios de aceptación

- [ ] Fantasmas inician en posiciones estables (alineadas a celda) al crear partida.
- [ ] Al iniciar partida, los cuatro fantasmas salen del pen de forma ordenada sin "teletransportes" ni parpadeos visibles.
- [ ] Dirección inicial al salir es coherente (evita retroceso inmediato no deseado).
- [ ] Tras `resetPositions()` (muerte de Pac-Man), fantasmas vuelven a posiciones correctas y salen correctamente.
- [ ] No quedan atascados en la puerta (`tile 3`) ni en celdas adyacentes.
- [ ] Comportamiento es consistente frame a frame (sin cambios erráticos entre frames alineados).

## Decisiones tomadas y descartadas

- **Mantener salida simple (sin timers de release).** (Tomado) Coherente con código actual.
- **Forzar dirección "up" al salir del pen mientras están dentro del área del pen.** (Tomado) Evita decisiones erróneas de IA mientras atraviesan zona especial.
- **Detectar área pen por coordenada Y.** (Tomado) Suficiente para este laberinto.

## Riesgos identificados

- **Conflicto con IA**: forzar dirección solo mientras está en pen para evitar interferencia con `decideGhostDir`.
- **Orden de fantasmas**: mantener posiciones que no se solapen al salir.
