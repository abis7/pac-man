// mapshift.js
// Mapa dinamico: abre y cierra compuertas (MAZE_GATES, maze.js) a medida
// que se comen dots. Muta game.grid, nunca MAZE.

const SHIFT_WARNING = 120; // 2 s de aviso parpadeante antes de cambiar
const SHIFT_RETRY = 30;    // reintento si un actor ocupa una celda a cerrar

function createMapShift() {
  const open = {};
  for ( const g of MAZE_GATES ) open[ g.id ] = g.startsOpen;
  return { open, triggers: [ 210, 140, 70 ], pending: null };
}

function gateById( id ) {
  return MAZE_GATES.find( ( g ) => g.id === id );
}

function gateHeat( game, gate ) {
  let h = 0;
  for ( const c of gate.cells ) h += game.adapt.heat[ c.y ][ c.x ];
  return h;
}

// Cierra la compuerta abierta con mas calor y abre la cerrada mas lejana
// de Pacman. Cualquiera de los dos lados puede faltar.
function pickShift( game ) {
  const ms = game.mapShift;
  let close = null;
  let open = null;
  let bestHeat = -1;
  let bestDist = -1;
  for ( const g of MAZE_GATES ) {
    if ( ms.open[ g.id ] ) {
      const h = gateHeat( game, g );
      if ( h > bestHeat ) { bestHeat = h; close = g.id; }
    } else {
      const c = g.cells[ 0 ];
      const d = Math.abs( c.x - game.pacman.x ) + Math.abs( c.y - game.pacman.y );
      if ( d > bestDist ) { bestDist = d; open = g.id; }
    }
  }
  return { close, open, timer: SHIFT_WARNING };
}

// Algun actor ocupa (o esta cruzando) una celda de la compuerta?
function gateOccupied( game, gate ) {
  const actors = [ game.pacman ].concat( game.ghosts );
  for ( const a of actors ) {
    const xs = [ Math.floor( a.x + 1e-3 ), Math.ceil( a.x - 1e-3 ) ];
    const ys = [ Math.floor( a.y + 1e-3 ), Math.ceil( a.y - 1e-3 ) ];
    for ( const c of gate.cells )
      if ( xs.indexOf( c.x ) !== -1 && ys.indexOf( c.y ) !== -1 ) return true;
  }
  return false;
}

function countDots( grid ) {
  let n = 0;
  for ( const row of grid )
    for ( const v of row ) if ( v === 2 || v === 4 ) n++;
  return n;
}

function applyGate( game, id, open ) {
  const gate = gateById( id );
  for ( const c of gate.cells ) game.grid[ c.y ][ c.x ] = open ? 2 : 1;
  game.mapShift.open[ id ] = open;
}

function tickMapShift( game ) {
  const ms = game.mapShift;

  if ( !ms.pending ) {
    if ( ms.triggers.length && game.dotsRemaining < ms.triggers[ 0 ] ) {
      ms.triggers.shift();
      const p = pickShift( game );
      if ( p.close || p.open ) ms.pending = p;
    }
    return;
  }

  ms.pending.timer--;
  if ( ms.pending.timer > 0 ) return;
  if ( ms.pending.close && gateOccupied( game, gateById( ms.pending.close ) ) ) {
    ms.pending.timer = SHIFT_RETRY;
    return;
  }
  if ( ms.pending.close ) applyGate( game, ms.pending.close, false );
  if ( ms.pending.open ) applyGate( game, ms.pending.open, true );
  game.dotsRemaining = countDots( game.grid );
  ms.pending = null;
}

window.createMapShift = createMapShift;
window.tickMapShift = tickMapShift;
window.gateById = gateById;
