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

function tickMapShift( game ) {
}

window.createMapShift = createMapShift;
window.tickMapShift = tickMapShift;
window.gateById = gateById;
