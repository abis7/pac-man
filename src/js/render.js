// render.js
// Dibujo arcade sobre canvas. Usa game.grid (no MAZE) para reflejar dots comidos.

const TILE = 20;
const WALL_COLOR = '#2121ff';
const DOOR_COLOR = '#ffb8ff';
const DOT_COLOR = '#ffb897';

function cellCenter( x, y ) {
  return { cx: x * TILE + TILE / 2, cy: y * TILE + TILE / 2 };
}

// Paredes estilo arcade: lineas finas redondeadas que conectan los centros
// de celdas-pared adyacentes. Produce el trazado continuo del original.
function drawWalls( ctx, grid ) {
  const H = grid.length;
  const W = grid[ 0 ].length;
  ctx.strokeStyle = WALL_COLOR;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for ( let y = 0; y < H; y++ ) {
    for ( let x = 0; x < W; x++ ) {
      if ( grid[ y ][ x ] !== 1 ) continue;
      const { cx, cy } = cellCenter( x, y );
      // Conectar solo hacia derecha y abajo evita trazos duplicados.
      if ( x + 1 < W && grid[ y ][ x + 1 ] === 1 ) {
        ctx.moveTo( cx, cy );
        ctx.lineTo( cx + TILE, cy );
      }
      if ( y + 1 < H && grid[ y + 1 ][ x ] === 1 ) {
        ctx.moveTo( cx, cy );
        ctx.lineTo( cx, cy + TILE );
      }
      // Celda-pared aislada (sin vecino): punto corto para que se vea.
      const lone =
        ( x + 1 >= W || grid[ y ][ x + 1 ] !== 1 ) &&
        ( x - 1 < 0 || grid[ y ][ x - 1 ] !== 1 ) &&
        ( y + 1 >= H || grid[ y + 1 ][ x ] !== 1 ) &&
        ( y - 1 < 0 || grid[ y - 1 ][ x ] !== 1 );
      if ( lone ) {
        ctx.moveTo( cx - 3, cy );
        ctx.lineTo( cx + 3, cy );
      }
    }
  }
  ctx.stroke();
}

function drawDoor( ctx, grid ) {
  const H = grid.length;
  const W = grid[ 0 ].length;
  ctx.strokeStyle = DOOR_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for ( let y = 0; y < H; y++ ) {
    for ( let x = 0; x < W; x++ ) {
      if ( grid[ y ][ x ] !== 3 ) continue;
      const px = x * TILE;
      const py = y * TILE + TILE / 2;
      ctx.moveTo( px, py );
      ctx.lineTo( px + TILE, py );
    }
  }
  ctx.stroke();
}

function drawDots( ctx, grid ) {
  for ( let y = 0; y < grid.length; y++ ) {
    for ( let x = 0; x < grid[ 0 ].length; x++ ) {
      const v = grid[ y ][ x ];
      if ( v !== 2 && v !== 4 ) continue;
      const { cx, cy } = cellCenter( x, y );
      ctx.beginPath();
      if ( v === 4 ) {
        // Power pellet: notablemente mas grande y blanco.
        ctx.fillStyle = '#ffffff';
        ctx.arc( cx, cy, 5, 0, Math.PI * 2 );
      } else {
        ctx.fillStyle = DOT_COLOR;
        ctx.arc( cx, cy, 2.5, 0, Math.PI * 2 );
      }
      ctx.fill();
    }
  }
}

function drawPacman( ctx, p, frame ) {
  const { cx, cy } = cellCenter( p.x, p.y );
  let rot = 0;
  if ( p.dir === 'right' ) rot = 0;
  else if ( p.dir === 'down' ) rot = Math.PI / 2;
  else if ( p.dir === 'left' ) rot = Math.PI;
  else if ( p.dir === 'up' ) rot = -Math.PI / 2;

  // Boca animada: abre/cierra con el frame.
  const open = ( Math.sin( frame * 0.3 ) * 0.5 + 0.5 ) * 0.28 + 0.02;

  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.moveTo( cx, cy );
  ctx.arc( cx, cy, TILE / 2 - 1, rot + open * Math.PI, rot - open * Math.PI );
  ctx.closePath();
  ctx.fill();
}

function drawGhost( ctx, g, color ) {
  const { cx, cy } = cellCenter( g.x, g.y );
  const r = TILE / 2 - 1;
  const top = cy - r;
  const bottom = cy + r;
  const left = cx - r;
  const right = cx + r;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc( cx, cy - 1, r, Math.PI, 0, false ); // cabeza
  ctx.lineTo( right, bottom );
  // falda ondulada (3 picos)
  ctx.lineTo( right - r * 0.66, bottom - 4 );
  ctx.lineTo( cx, bottom );
  ctx.lineTo( left + r * 0.66, bottom - 4 );
  ctx.lineTo( left, bottom );
  ctx.closePath();
  ctx.fill();

  // ojos mirando segun direccion
  const dir = DIRS[ g.dir ] || { x: 0, y: 0 };
  const ex = dir.x * 1.6;
  const ey = dir.y * 1.6;
  for ( const off of [ -3.5, 3.5 ] ) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc( cx + off, cy - 1, 3, 0, Math.PI * 2 );
    ctx.fill();
    ctx.fillStyle = '#0000bb';
    ctx.beginPath();
    ctx.arc( cx + off + ex, cy - 1 + ey, 1.5, 0, Math.PI * 2 );
    ctx.fill();
  }
}

// Nombre del fantasma sobre su sprite. Ayuda a verificar las cuatro
// personalidades sin instrumentar nada mas (tecla G).
function drawGhostName( ctx, g ) {
  const { cx, cy } = cellCenter( g.x, g.y );
  ctx.fillStyle = '#fff';
  ctx.font = '8px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText( window.GHOST_NAMES[ g.kind ] || '', cx, cy - TILE / 2 + 1 );
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}

function drawHUD( ctx, game, W ) {
  ctx.fillStyle = '#fff';
  ctx.font = '14px "Courier New", monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText( 'SCORE ' + game.score, 8, 4 );
  ctx.textAlign = 'center';
  ctx.fillText(
    'IA ' + Math.round( window.effectiveLevel( game ) * 100 ) + '%',
    W * TILE / 2,
    4
  );
  ctx.textAlign = 'right';
  ctx.fillText( 'VIDAS ' + game.lives, W * TILE - 8, 4 );
}

// Fruta: circulo de color con tallo; parpadea los ultimos 2 s.
function drawFruit( ctx, game, frame ) {
  const f = game.fruit;
  if ( !f.active ) return;
  if ( f.timer < 120 && Math.floor( frame / 8 ) % 2 === 0 ) return;
  const { cx, cy } = cellCenter( f.x, f.y );
  ctx.fillStyle = window.fruitInfo( f.kind ).color;
  ctx.beginPath();
  ctx.arc( cx, cy + 1, 6, 0, Math.PI * 2 );
  ctx.fill();
  ctx.strokeStyle = '#3c9d2f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo( cx, cy - 4 );
  ctx.lineTo( cx + 3, cy - 8 );
  ctx.stroke();
}

// Aviso de cambio de mapa: las celdas de la compuerta parpadean
// (rojo = se cierra, verde = se abre).
function drawShiftWarning( ctx, game, frame ) {
  const pend = game.mapShift.pending;
  if ( !pend || Math.floor( frame / 10 ) % 2 === 0 ) return;
  const mark = ( id, color ) => {
    if ( !id ) return;
    ctx.fillStyle = color;
    for ( const c of window.gateById( id ).cells )
      ctx.fillRect( c.x * TILE, c.y * TILE, TILE, TILE );
  };
  mark( pend.close, 'rgba(255, 60, 60, 0.6)' );
  mark( pend.open, 'rgba(60, 255, 90, 0.6)' );
}

// Depuracion (tecla H): calor del jugador y celda predicha por la IA.
function drawAdaptDebug( ctx, game ) {
  const heat = game.adapt.heat;
  let max = 0;
  for ( const row of heat ) for ( const v of row ) if ( v > max ) max = v;
  if ( max > 0 ) {
    for ( let y = 0; y < heat.length; y++ ) {
      for ( let x = 0; x < heat[ y ].length; x++ ) {
        if ( heat[ y ][ x ] <= 0 ) continue;
        ctx.fillStyle = 'rgba(255, 0, 0, ' + ( 0.6 * heat[ y ][ x ] / max ).toFixed( 2 ) + ')';
        ctx.fillRect( x * TILE, y * TILE, TILE, TILE );
      }
    }
  }
  const t = window.predictPacman( game, 4 );
  const { cx, cy } = cellCenter( t.x, t.y );
  ctx.strokeStyle = '#0f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo( cx - 6, cy - 6 );
  ctx.lineTo( cx + 6, cy + 6 );
  ctx.moveTo( cx + 6, cy - 6 );
  ctx.lineTo( cx - 6, cy + 6 );
  ctx.stroke();
}

const GHOST_COLORS = {
  blinky: '#ff0000',
  pinky: '#ffb8ff',
  inky: '#00ffff',
  clyde: '#ffb852',
};

// Color del cuerpo segun el estado del fantasma: 'eaten' en gris claro,
// 'frightened' en azul y en los ultimos 2 s parpadeando azul/blanco.
function ghostBodyColor( g, game ) {
  if ( g.state === 'eaten' ) return '#bbbbbb';
  if ( g.state === 'frightened' ) {
    const t = game.frightened.timer;
    const parpadea =
      t <= window.FRIGHTENED_BLINK && Math.floor( t / 15 ) % 2 === 0;
    return parpadea ? '#ffffff' : '#2121ff';
  }
  return GHOST_COLORS[ g.kind ] || '#ff0000';
}

function draw( ctx, game, frame ) {
  const grid = game.grid;
  const W = grid[ 0 ].length;
  const H = grid.length;

  ctx.fillStyle = '#000';
  ctx.fillRect( 0, 0, W * TILE, H * TILE );

  drawWalls( ctx, grid );
  drawDoor( ctx, grid );
  drawDots( ctx, grid );
  if ( game.showAdaptDebug ) drawAdaptDebug( ctx, game );
  drawShiftWarning( ctx, game, frame );
  drawFruit( ctx, game, frame );
  drawPacman( ctx, game.pacman, frame );
  game.ghosts.forEach( ( g ) => drawGhost( ctx, g, ghostBodyColor( g, game ) ) );
  if ( game.showGhostNames ) game.ghosts.forEach( ( g ) => drawGhostName( ctx, g ) );
  drawHUD( ctx, game, W );
}

window.draw = draw;
