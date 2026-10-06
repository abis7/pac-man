// ghosts.js
// IA de los fantasmas. Cada personaje se define por la celda que
// persigue (ghostTarget); la eleccion de direccion es comun
// (decideGhostDir). Depende de DIRS (game.js) en runtime, no al cargar.

const GHOST_NAMES = {
  blinky: 'BLINKY',
  pinky: 'PINKY',
  inky: 'INKY',
  clyde: 'CLYDE',
};

const CLYDE_CORNER = { x: 0, y: 30 }; // esquina inferior izquierda
const CLYDE_CHASE_DISTANCE = 8; // Manhattan, en celdas

const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

function cellOf( a ) {
  return { x: Math.round( a.x ), y: Math.round( a.y ) };
}

// Celda situada 'cells' por delante del actor segun su direccion actual.
function aheadOf( a, cells ) {
  const d = window.DIRS[ a.dir ] || { x: 0, y: 0 };
  const c = cellOf( a );
  return { x: c.x + d.x * cells, y: c.y + d.y * cells };
}

function manhattan( a, b ) {
  return Math.abs( a.x - b.x ) + Math.abs( a.y - b.y );
}

// Celda que el fantasma quiere alcanzar. La celda objetivo no necesita
// ser transitable: el fantasma se detiene al llegar a ella.
function ghostTarget( ghost, pacman, ghosts ) {
  const pcell = cellOf( pacman );

  switch ( ghost.kind ) {
    // Caza directa: la celda exacta de Pacman.
    case 'blinky':
      return pcell;

    // Emboscada: cuatro celdas por delante de Pacman.
    case 'pinky':
      return aheadOf( pacman, 4 );

    // Vector: punto medio entre Blinky y dos celdas por delante de Pacman.
    case 'inky': {
      const blinky = ghosts.find( ( g ) => g.kind === 'blinky' );
      const pivot = aheadOf( pacman, 2 );
      const b = cellOf( blinky || ghost );
      return {
        x: Math.round( ( b.x + pivot.x ) / 2 ),
        y: Math.round( ( b.y + pivot.y ) / 2 ),
      };
    }

    // Cazador timido: persigue de lejos, se retira a su esquina de cerca.
    case 'clyde':
      return manhattan( cellOf( ghost ), pcell ) > CLYDE_CHASE_DISTANCE
        ? pcell
        : CLYDE_CORNER;

    default:
      return pcell;
  }
}

// Direcciones legales del fantasma en su celda actual: se excluye la
// reversa, salvo que no quede ninguna salida (callejon).
function legalDirs( ghost, grid ) {
  const opts = Object.keys( window.DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ ghost.dir ] && window.canMove( grid, ghost.x, ghost.y, dir, 'ghost' )
  );
  return opts.length ? opts : [ OPPOSITE[ ghost.dir ] ];
}

// Modo asustado (frightened): huye eligiendo entre las direcciones legales
// la que mas aleja a Pacman. Los fantasmas 'eaten' no deciden aqui: salen
// de la pen por la ruta forzada de moveGhost.
function frightenedDir( ghost, pacman, grid ) {
  const opts = legalDirs( ghost, grid );
  const pcell = cellOf( pacman );
  let best = opts[ 0 ];
  let bestDist = -1;
  for ( const dir of opts ) {
    const d = window.DIRS[ dir ];
    const dist = manhattan( { x: ghost.x + d.x, y: ghost.y + d.y }, pcell );
    if ( dist > bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

// Elige, entre las direcciones legales, la que acerca mas el fantasma a
// su celda objetivo. Regla comun a los cuatro personajes.
function decideGhostDir( ghost, pacman, ghosts, grid ) {
  if ( ghost.state === 'frightened' ) return frightenedDir( ghost, pacman, grid );

  const target = ghostTarget( ghost, pacman, ghosts );
  const choices = legalDirs( ghost, grid );
  let best = choices[ 0 ];
  let bestDist = Infinity;

  for ( const dir of choices ) {
    const d = window.DIRS[ dir ];
    const dist = manhattan( { x: ghost.x + d.x, y: ghost.y + d.y }, target );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

window.GHOST_NAMES = GHOST_NAMES;
window.ghostTarget = ghostTarget;
window.decideGhostDir = decideGhostDir;
window.OPPOSITE = OPPOSITE;