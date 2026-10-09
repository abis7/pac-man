// adapt.js
// Perfil del jugador y prediccion. Los fantasmas "aprenden" con dos
// estadisticas simples: un mapa de calor de celdas visitadas y la
// frecuencia de giros en cada interseccion. Depende en runtime de
// MAZE, TUNNEL_ROW (maze.js), DIRS y canMove (game.js), no al cargar.

const ADAPT_MAX = 0.8;        // el aprendizaje nunca llega al 100 %
const SAMPLES_FULL = 120;     // decisiones para alcanzar ADAPT_MAX
const ADAPT_THRESHOLD = 0.4;  // desde aqui se activan Blinky y Clyde adaptativos
const MIN_TURN_SAMPLES = 3;   // minimo de observaciones para fiarse de un giro
const HEAT_DECAY_EVERY = 600; // frames (~10 s)
const HEAT_DECAY = 0.9;       // lo antiguo pesa menos

function createAdapt() {
  return {
    level: 0,
    samples: 0,
    heat: MAZE.map( ( row ) => row.map( () => 0 ) ),
    turns: {},
    lastCell: null,
    lastDir: null,
    decayTimer: 0,
  };
}

// Interseccion: celda con 3 o mas salidas transitables para Pacman.
function isIntersection( grid, x, y ) {
  let n = 0;
  for ( const dir of Object.keys( window.DIRS ) ) {
    if ( window.canMove( grid, x, y, dir, 'pacman' ) ) n++;
  }
  return n >= 3;
}

// Se llama desde movePacman cuando Pacman esta alineado y ya aplico su giro:
// p.dir es la direccion con la que sale de la celda.
function recordPacman( game ) {
  const a = game.adapt;
  const p = game.pacman;
  if ( p.ability.kind === 'niebla' ) return;
  if ( a.lastCell && a.lastCell.x === p.x && a.lastCell.y === p.y ) return;

  a.heat[ p.y ][ p.x ] += 1;
  if ( a.lastDir && isIntersection( game.grid, p.x, p.y ) ) {
    const key = p.x + ',' + p.y + ',' + a.lastDir;
    const t = a.turns[ key ] || ( a.turns[ key ] = { left: 0, right: 0, up: 0, down: 0 } );
    t[ p.dir ]++;
    a.samples++;
  }
  a.lastCell = { x: p.x, y: p.y };
  a.lastDir = p.dir;
}

// Una vez por frame: decaimiento del calor y nivel de aprendizaje.
function tickAdapt( game ) {
  const a = game.adapt;
  a.decayTimer++;
  if ( a.decayTimer >= HEAT_DECAY_EVERY ) {
    a.decayTimer = 0;
    for ( const row of a.heat )
      for ( let x = 0; x < row.length; x++ ) row[ x ] *= HEAT_DECAY;
  }
  a.level = ADAPT_MAX * Math.min( 1, a.samples / SAMPLES_FULL );
}

// Con la habilidad Niebla los fantasmas vuelven a la IA clasica.
function effectiveLevel( game ) {
  if ( !game || !game.adapt ) return 0;
  if ( game.pacman.ability && game.pacman.ability.kind === 'niebla' ) return 0;
  return game.adapt.level;
}

// Celda a la que llegara Pacman tras 'steps' celdas siguiendo sus giros
// mas frecuentes. Limita por pasos (no por distancia), asi el tunel no
// puede causar bucles.
function predictPacman( game, steps ) {
  const grid = game.grid;
  const W = grid[ 0 ].length;
  const opp = window.OPPOSITE;
  let x = Math.round( game.pacman.x );
  let y = Math.round( game.pacman.y );
  let dir = game.pacman.dir;

  for ( let i = 0; i < steps; i++ ) {
    if ( isIntersection( grid, x, y ) ) {
      const t = game.adapt.turns[ x + ',' + y + ',' + dir ];
      if ( t ) {
        let total = 0;
        let best = null;
        for ( const d of Object.keys( t ) ) {
          total += t[ d ];
          if ( d !== opp[ dir ] && window.canMove( grid, x, y, d, 'pacman' ) &&
               ( best === null || t[ d ] > t[ best ] ) ) best = d;
        }
        if ( best && total >= MIN_TURN_SAMPLES ) dir = best;
      }
    }
    if ( !window.canMove( grid, x, y, dir, 'pacman' ) ) {
      const alt = Object.keys( window.DIRS ).find(
        ( d ) => d !== opp[ dir ] && window.canMove( grid, x, y, d, 'pacman' )
      );
      if ( !alt ) break;
      dir = alt;
    }
    x += window.DIRS[ dir ].x;
    y += window.DIRS[ dir ].y;
    if ( y === TUNNEL_ROW ) x = ( x + W ) % W;
  }
  return { x, y };
}

// Celda con mas calor a distancia Manhattan mayor que minDist de 'from'.
function hotspot( game, from, minDist ) {
  const heat = game.adapt.heat;
  let best = null;
  let bestHeat = 0;
  for ( let y = 0; y < heat.length; y++ ) {
    for ( let x = 0; x < heat[ y ].length; x++ ) {
      if ( heat[ y ][ x ] <= bestHeat ) continue;
      if ( Math.abs( x - from.x ) + Math.abs( y - from.y ) <= minDist ) continue;
      bestHeat = heat[ y ][ x ];
      best = { x, y };
    }
  }
  return best;
}

window.ADAPT_THRESHOLD = ADAPT_THRESHOLD;
window.createAdapt = createAdapt;
window.recordPacman = recordPacman;
window.tickAdapt = tickAdapt;
window.effectiveLevel = effectiveLevel;
window.predictPacman = predictPacman;
window.hotspot = hotspot;
