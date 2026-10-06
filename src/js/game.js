// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

const POWER_PELLET_SCORE = 50;
const FRIGHTENED_DURATION = 360; // ~6 s a 60 fps (nivel 1 del arcade)
const FRIGHTENED_BLINK = 120;    // ultimos 2 s: parpadeo azul/blanco
const GHOST_EATEN_POINTS = [ 200, 400, 800, 1600 ];

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid )
    for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    showGhostNames: false,
    grid,
    frightened: { active: false, timer: 0, eatenCount: 0 },
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      state: 'normal',
      // true mientras el fantasma aun no ha salido de la pen: la IA
      // normal no se aplica hasta que sale (ver moveGhost).
      leavingPen: true,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman:      bloqueado por pared (1) y puerta (3)
//   ghost:       bloqueado por pared (1) y tambien por la puerta (3):
//                un fantasma normal ya liberado no vuelve a entrar en la pen
//   ghost-home:  solo bloqueado por pared (1); usa quien esta saliendo de
//                la pen o regresando a ella, y puede cruzar la puerta (3)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) return actor !== 'ghost-home';
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

// Activa el modo frightened al comer un power pellet: reinicia el temporizador
// y la cadena de comidos, y los fantasmas en modo normal se asustan y giran
// (reversion clasica). Los que estan 'eaten' no se ven afectados.
function frightenGhosts( game ) {
  const f = game.frightened;
  f.active = true;
  f.timer = FRIGHTENED_DURATION;
  f.eatenCount = 0;
  for ( const g of game.ghosts ) {
    if ( g.state !== 'normal' ) continue;
    g.state = 'frightened';
    g.dir = window.OPPOSITE[ g.dir ];
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    const tile = grid[ p.y ][ p.x ];
    if ( tile === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    } else if ( tile === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += POWER_PELLET_SCORE;
      game.dotsRemaining--;
      frightenGhosts( game );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// La IA vive en ghosts.js. Se llama solo cuando el fantasma esta alineado
// con la rejilla, y el orden de game.ghosts mantiene a Blinky (indice 0)
// actualizado antes que Inky.
function decideGhost( game, g ) {
  g.dir = window.decideGhostDir( g, game.pacman, game.ghosts, game.grid );
}

// La celda (x,y) pertenece al area de la pen (interior o puerta)?
function inPenCell( x, y ) {
  const P = window.PEN;
  const dentro =
    x >= P.minX && x <= P.maxX && y >= P.minY && y <= P.maxY;
  return dentro || ( y === P.doorY && P.doorXs.indexOf( x ) !== -1 );
}

// Direccion para salir de la pen desde la celda alineada (x,y): primero se
// avanza hasta las columnas de puerta y despues hacia arriba. Garantiza una
// salida ordenada aunque el fantasma arranque descentrado en el interior.
function exitDir( g ) {
  const P = window.PEN;
  if ( g.x < P.doorXs[ 0 ] ) return 'right';
  if ( g.x > P.doorXs[ P.doorXs.length - 1 ] ) return 'left';
  return 'up';
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );

    // Salida de la pen: mientras este en su interior o en la puerta se
    // fuerza la ruta hacia fuera; al quedar fuera, la IA normal toma el
    // control (y si venia 'eaten', se regenera como 'normal').
    if ( g.leavingPen ) {
      if ( inPenCell( g.x, g.y ) ) {
        g.dir = exitDir( g );
        if ( !canMove( grid, g.x, g.y, g.dir, 'ghost-home' ) ) return;
      } else {
        g.leavingPen = false;
        if ( g.state === 'eaten' ) g.state = 'normal';
      }
    }
    if ( !g.leavingPen ) {
      decideGhost( game, g );
      if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
    }
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  // Tras perder una vida el modo frightened se cancela y todos los
  // fantasmas vuelven a su punto inicial en modo normal.
  game.frightened.active = false;
  game.frightened.timer = 0;
  game.frightened.eatenCount = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = Math.round( GHOST_STARTS[ i ].x );
    g.y = Math.round( GHOST_STARTS[ i ].y );
    g.dir = 'up';
    g.state = 'normal';
    g.leavingPen = true;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

// Come a un fantasma 'frightened': suma la cadena de puntos, lo manda a su
// posicion de origen dentro de la pen y lo marca 'eaten'. Al salir de la pen
// se regenera como 'normal' (ver moveGhost).
function eatGhost( game, g ) {
  const idx = Math.min(
    game.frightened.eatenCount - 1,
    GHOST_EATEN_POINTS.length - 1
  );
  game.score += GHOST_EATEN_POINTS[ idx ];
  const home = GHOST_STARTS[ game.ghosts.indexOf( g ) ];
  g.x = home.x;
  g.y = home.y;
  g.dir = 'up';
  g.state = 'eaten';
  g.leavingPen = true;
}

function update( game ) {
  // Temporizador del modo frightened.
  if ( game.frightened.active ) {
    game.frightened.timer--;
    if ( game.frightened.timer <= 0 ) {
      game.frightened.active = false;
      for ( const g of game.ghosts ) {
        if ( g.state === 'frightened' ) g.state = 'normal';
      }
    }
  }

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( !collides( game.pacman, g ) ) continue;

    // Un fantasma comido de paso no hace nada.
    if ( g.state === 'eaten' ) continue;

    // En modo frightened, Pacman se lo come.
    if ( g.state === 'frightened' ) {
      game.frightened.eatenCount++;
      eatGhost( game, g );
      continue;
    }

    game.lives--;
    if ( game.lives <= 0 ) {
      game.state = 'lost';
      return;
    }
    resetPositions( game );
    break;
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
window.canMove = canMove;
window.FRIGHTENED_BLINK = FRIGHTENED_BLINK;
