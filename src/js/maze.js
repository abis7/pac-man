// maze.js
// Laberinto 28x31 fiel a la geometria del nivel 1 de Pac-Man.
// Se escribe como 31 strings de 28 chars (legible) y se parsea a numeros.
//   '#' pared(1) · '.' dot(2) · ' ' vacio transitable(0) · '-' puerta pen(3)
//   'O' power pellet(4) en las cuatro posiciones clasicas del nivel 1.
// Coordenadas: celda (x,y), origen arriba-izquierda. x in [0,27], y in [0,30].
// Simetrico respecto al eje vertical central (entre cols 13 y 14).

const MAZE_STR = [
  '############################', // 0  borde
  '#............##............#', // 1
  '#.####.#####.##.#####.####.#', // 2
  '#O####.#####.##.#####.####O#', // 3  power pellets (1,3) y (26,3)
  '#.####.#####.##.#####.####.#', // 4
  '#..........................#', // 5
  '#.####.##.########.##.####.#', // 6
  '#.####.##.########.##.####.#', // 7
  '#......##....##....##......#', // 8
  '######.#####.##.#####.######', // 9
  '######.#####.##.#####.######', // 10
  '######.##..........##.######', // 11
  '######.##.###--###.##.######', // 12  puerta pen cols 13-14
  '######.##.#      #.##.######', // 13  interior pen
  '          #      #          ', // 14  tunel (extremos abiertos) + pen
  '######.##.#      #.##.######', // 15  interior pen
  '######.##.########.##.######', // 16  fondo pen
  '######.##..........##.######', // 17
  '######.#####.##.#####.######', // 18
  '######.#####.##.#####.######', // 19
  '#............##............#', // 20
  '#.####.#####.##.#####.####.#', // 21
  '#.####.#####.##.#####.####.#', // 22
  '#O..##................##..O#', // 23  power pellets (1,23) y (26,23); fila inicio Pacman (13,23)
  '###.##.##.########.##.##.###', // 24
  '###.##.##.########.##.##.###', // 25
  '#......##....##....##......#', // 26
  '#.##########.##.##########.#', // 27
  '#.##########.##.##########.#', // 28
  '#..........................#', // 29
  '############################', // 30  borde
];

function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === '-' ) return 3;
  if ( ch === 'O' ) return 4; // power pellet
  return 0; // espacio = vacio transitable
}

// Matriz numerica pristina (no se muta; cada partida copia esto).
const MAZE = MAZE_STR.map( ( row ) => row.split( '' ).map( parseTile ) );

const TUNNEL_ROW = 14;
const PACMAN_START = { x: 13, y: 23 };

// Geometria de la casa de fantasmas (pen). Interior x 11-16 / y 13-15;
// la puerta (tiles '-') esta en la fila 12, columnas 13-14.
const PEN = {
  minX: 11,
  maxX: 16,
  minY: 13,
  maxY: 15,
  doorY: 12,
  doorXs: [ 13, 14 ],
};
// Orden significativo: Blinky es el indice 0 y se actualiza primero en
// cada frame, que es lo que Inky necesita para calcular su objetivo.
const GHOST_STARTS = [
  { x: 14, y: 14, kind: 'blinky' },
  { x: 13, y: 14, kind: 'pinky' },
  { x: 12, y: 14, kind: 'inky' },
  { x: 11, y: 14, kind: 'clyde' },
];

// Compuertas del mapa dinamico (ver mapshift.js). Pares de celdas simetricos
// respecto al eje central. En MAZE_STR las abiertas ya son '.' y las
// cerradas '#', asi que MAZE no cambia. Cualquier combinacion abierta/cerrada
// mantiene el laberinto conectado y sin callejones.
const MAZE_GATES = [
  { id: 'A', cells: [ { x: 13, y: 1 }, { x: 14, y: 1 } ], startsOpen: false },
  { id: 'B', cells: [ { x: 13, y: 8 }, { x: 14, y: 8 } ], startsOpen: false },
  { id: 'C', cells: [ { x: 13, y: 20 }, { x: 14, y: 20 } ], startsOpen: false },
  { id: 'D', cells: [ { x: 13, y: 26 }, { x: 14, y: 26 } ], startsOpen: false },
  { id: 'E', cells: [ { x: 13, y: 5 }, { x: 14, y: 5 } ], startsOpen: true },
  { id: 'F', cells: [ { x: 13, y: 29 }, { x: 14, y: 29 } ], startsOpen: true },
];

window.MAZE = MAZE;
window.MAZE_GATES = MAZE_GATES;
window.TUNNEL_ROW = TUNNEL_ROW;
window.PACMAN_START = PACMAN_START;
window.GHOST_STARTS = GHOST_STARTS;
window.PEN = PEN;
