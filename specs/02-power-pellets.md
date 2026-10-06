# SPEC 02 — Power Pellets

> **Estado:** Aprobado
> **Depende de:** —
> **Fecha:** 2026-10-06
> **Objetivo:** Añadir cuatro Power Pellets que, al ser comidos, activan un modo "frightened" limitado: durante este modo Pac-Man puede comer fantasmas, que al ser comidos vuelven a la casa (pen) para reactivarse. Añadir representación visual, estados de fantasmas y colisiones correctas.

## Por qué existe este spec

Actualmente el juego solo permite que Pac-Man muera al tocar un fantasma. En el Pac-Man arcade clásico, al comer un Power Pellet los fantasmas pasan a estado "frightened" (azul, parpadeando al acercarse el fin), Pac-Man puede comerlos y recibir puntos en cadena (200, 400, 800, 1600), y los fantasmas comidos vuelven al "ghost house" (pen) para salir de nuevo. Necesitamos añadir esta mecánica.

## Alcance

**Dentro:**

- Colocar exactamente 4 Power Pellets en posiciones clásicas del nivel 1 (simétricas respecto al eje central).
- Representar Power Pellets como puntos más grandes que los dots normales. El render debe distinguirlos visualmente (parpadeo opcional o simplemente mayor tamaño).
- Al comer un Power Pellet (cuando Pac-Man está centrado en su celda), se elimina de `game.grid`, se suma puntuación (habitualmente 50, igual que clásico), se activa modo `frightened` con duración limitada, y se establece contador de fantasmas comidos en la cadena a 0.
- Modo `frightened`: fantasmas se muestran en estado asustado (color azul). En los últimos ~2 segundos deben parpadear (azul/blanco) para indicar fin.
- Durante modo `frightened`, Pac-Man **no muere** al colisionar con un fantasma: colisión significa que Pac-Man come al fantasma.
- Al comer un fantasma en estado `frightened`: sumar puntos según cadena (200, 400, 800, 1600) para 1..4 fantasmas consecutivos en el mismo Power Pellet; el fantasma vuelve a la casa (pen). Mientras vuelve/está en pen, no debe matar a Pac-Man en el reingreso hasta que salga y recupere su estado normal.
- Al terminar la duración del modo `frightened`, todos los fantasmas que no estén "comidos" vuelven a su estado normal (chase). Si ya fueron comidos, permanecen "en casa" hasta que se reactivan.
- Fantasmas comidos: no siguen IA de persecución mientras están en casa; deben salir del pen y reanudarse en modo normal cuando corresponda. No bloquear la puerta (tile `3`) de forma incorrecta.
- Colisiones: usar la misma lógica de proximidad (`collides`) pero con regla según estado (muere si fantasma está en modo normal; come fantasma si está frightened).
- Solo añade lógica. No cambia el orden de carga, mantiene comunicación por `window` y carga scripts tal cual `index.html`.

**Fuera de alcance:**

- Fases de `scatter`/`chase` cíclicas (solo `frightened` + estado normal).
- Progresión de niveles, frutas, bonus.
- Persistencia entre sesiones.
- Cambios en velocidad de fantasmas (clásico baja velocidad en frightened, pero para mantener cambios mínimos no obligatorio salvo comportamiento).
- Sonido.

## Modelo de datos

- Marcar Power Pellets en el mapa con un código nuevo: usar `4` en `MAZE` (tiles: `#`=1 pared, `.`=2 dot, espacio=0, `-`=3 puerta). `MAZE` debe seguir siendo pristino; `game.grid` copia e interpreta `4` como Power Pellet (consumible).
- Extender estado de partida (`game`):
  - `frightened: { active: boolean, timer: number, duration: number, eatenCount: number }`
- Extender estado de cada fantasma (`game.ghosts[i]`):
  - `state: 'normal' | 'frightened' | 'eaten'` (o equivalente)
  - `respawnTimer?: number` (opcional) o lógica de retorno a pen y reactivación
- Constantes: `POWER_PELLET_SCORE=50`, `FRIGHTENED_DURATION=~6-8s` (recomendado ~6 segundos a 60fps aproximado, pero en este juego con rAF basta con frames o ms acumulados; usar frames coherentes con bucle de `main.js`), cadena de puntos `EATEN_CHAIN = [200,400,800,1600]`.

**Decisión:** Usar `4` para Power Pellet en `maze.js`. No reutilizar otros códigos.

## Plan de implementación

1. **maze.js**: añadir 4 Power Pellets en posiciones clásicas (p. ej. cerca de esquinas superiores: (1,1), (26,1), (1,29), (26,29) o posiciones canónicas). Actualizar `parseTile` si necesario (o insertar directamente valores 4). Mantener formato legible o editar `MAZE` generado. Asegurar `MAZE` sigue intacto; `createGame` copia tal cual.
2. **game.js**: 
   - Detectar Power Pellet al comer (`grid[y][x]===4`): poner a 0, sumar 50, activar frightened (reset timer, eatenCount=0), aplicar efecto a fantasmas (poner `state='frightened'`, invertir dirección si alineado? clásico invierte al activarse).
   - Añadir lógica de colisiones según estado: si fantasma está `eaten`, no matar; si fantasma está `frightened`, Pac-Man lo come (incrementar cadena, añadir puntos, pasar fantasma a `eaten` y devolverlo a pen). Si está `normal`, Pac-Man muere (comportamiento actual).
   - Gestionar temporizador frightened: decrementar por frame/update, al expirar restaurar fantasmas `normal` (los que no estén `eaten`).
   - Al comer fantasma: calcular puntos `EATEN_CHAIN[eatenCount-1] || 1600`, `eatenCount++`, mover fantasma a posición de pen (coincidir con zona pen, p. ej. centro pen `y=14`, `x` cercano a salida) y poner `state='eaten'`. Debe poder salir y reactivarse (transición a `normal` cuando alineado y pueda moverse hacia fuera, respetando puerta).
3. **ghosts.js**: añadir comportamiento según estado.
   - Si `state==='frightened'`: IA alternativa (aleatoria entre direcciones legales, o simplemente evitar reversa y elegir camino que maximice distancia a Pac-Man? clásico usa movimiento aleatorio/aleatorio dirigido; mínimo: elegir dirección legal distinta a reversa con criterio simple, o aleatorio). Para mantenerlo fiel pero simple: en frightened, al decidir, elegir entre direcciones legales (excluyendo reversa si hay otras) la que da **mayor** distancia Manhattan a Pac-Man (huida) o aleatorio. Recomendado: huida simple (maximizar distancia) o selección aleatoria ponderada; documentar elección.
   - Si `state==='eaten'`: objetivo es volver al pen (punto de reentrada/salida, centro pen). Al llegar al pen, debe reactivarse a `normal`. Durante `eaten`, el fantasma puede atravesar puerta (`3`) si necesario? (clásico: comido vuelve por pasillos y entra a pen).
   - Si `state==='normal'`: comportamiento actual por `kind` (Blinky/Pinky/Inky/Clyde) sin cambios.
4. **render.js**: dibujar Power Pellets con radio mayor (p. ej. 4-5px vs 2.5px) y color blanco/amarillento. Opcional parpadeo sutil. Dibujar fantasmas según estado: `frightened` azul (#0000ff), parpadeando blanco/azul últimos 2s; `eaten` gris claro o semitransparente (para distinguir). Mantener ojos visibles en eaten.
5. **Integración**: ajustar `update()` en `game.js` para gestionar temporizador, colisiones y transiciones; mantener compatibilidad con código existente.

## Criterios de aceptación

- [ ] Existen exactamente 4 Power Pellets en el laberinto.
- [ ] Power Pellet se dibuja mayor que dot normal.
- [ ] Al comer Power Pellet: se suma 50 puntos, grid se limpia, modo frightened se activa.
- [ ] Durante frightened, fantasmas se muestran azules; últimos 2s parpadean azul/blanco.
- [ ] Durante frightened, colisión con fantasma no quita vida: Pac-Man come al fantasma.
- [ ] Comer fantasma en frightened suma puntos en cadena 200/400/800/1600 correctamente (secuencia según número comido en ese modo).
- [ ] Fantasma comido vuelve al pen, pasa a estado eaten y luego se reactiva a normal.
- [ ] Al terminar frightened, fantasmas no comidos vuelven a normal.
- [ ] No se puede comer fantasma ya comido (no genera puntos dobles).
- [ ] Power Pellets solo se consumen una vez.
- [ ] Juego sigue funcional tras comer varios Power Pellets (reinicia cadena correctamente).

## Decisiones tomadas y descartadas

- **Código tile 4 para Power Pellet.** (Tomado) Coherente con códigos existentes (1,2,0,3). `MAZE` pristino, `game.grid` interpreta 4.
- **Huida simple para frightened.** (Tomado) En lugar de movimiento totalmente aleatorio, maximizar distancia Manhattan a Pac-Man entre direcciones legales (evitando reversa) es fiel y fácil.
- **Fantasmas comidos van directo al pen.** (Tomado) Al entrar a pen se reactivan a estado normal.
- **No cambiar velocidades.** (Descartado cambio, pero comportamiento suficiente con IA distinta). Mantener `GHOST_SPEED` constante.

## Riesgos identificados

- **Colisiones dobles**: al comer fantasma, resetear posiciones puede crear colisiones; gestionar bien estado `eaten`.
- **Puerta del pen**: fantasmas `eaten` deben poder atravesar tile `3` (puerta) mientras regresan; fantasmas normales no atraviesan puerta.
- **Reversión de dirección al activar frightened**: clásico invierte; añadir si no complica.
- **Temporizador**: sincronizar con rAF (frames) sin depender de Date.

