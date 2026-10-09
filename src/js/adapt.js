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

// Se llama desde movePacman cuando Pacman esta alineado y ya aplico su giro:
// p.dir es la direccion con la que sale de la celda.
function recordPacman( game ) {
}

// Una vez por frame: decaimiento del calor y nivel de aprendizaje.
function tickAdapt( game ) {
}

// Nivel de aprendizaje efectivo (lo usan los fantasmas y el HUD).
function effectiveLevel( game ) {
  return 0;
}

// Celda a la que llegara Pacman tras 'steps' celdas siguiendo sus giros
// mas frecuentes.
function predictPacman( game, steps ) {
  return { x: Math.round( game.pacman.x ), y: Math.round( game.pacman.y ) };
}

// Celda con mas calor a distancia Manhattan mayor que minDist de 'from'.
function hotspot( game, from, minDist ) {
  return null;
}

window.ADAPT_THRESHOLD = ADAPT_THRESHOLD;
window.createAdapt = createAdapt;
window.recordPacman = recordPacman;
window.tickAdapt = tickAdapt;
window.effectiveLevel = effectiveLevel;
window.predictPacman = predictPacman;
window.hotspot = hotspot;
