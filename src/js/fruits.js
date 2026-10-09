// fruits.js
// Frutas y habilidades de Pacman. Una sola habilidad activa a la vez
// (game.pacman.ability). Los efectos se aplican en game.js (turbo, escudo,
// congelar) y adapt.js (niebla).

const FRUIT_DURATION = 570; // 9,5 s
const FRUIT_SPAWNS = [ 50, 120, 190, 250 ]; // dots comidos que sacan cada fruta
const FRUIT_KINDS = [
  { kind: 'cereza',  points: 100, ability: 'turbo',    duration: 300, label: 'TURBO',    color: '#ff2040' },
  { kind: 'fresa',   points: 300, ability: 'escudo',   duration: 300, label: 'ESCUDO',   color: '#ff6fa0' },
  { kind: 'naranja', points: 500, ability: 'congelar', duration: 180, label: 'CONGELAR', color: '#ff9a00' },
  { kind: 'manzana', points: 700, ability: 'niebla',   duration: 480, label: 'NIEBLA',   color: '#7ddc3a' },
];

function createFruit() {
  return { active: false, x: 13, y: 17, kind: null, timer: 0, spawned: 0, dotsEaten: 0 };
}

function fruitInfo( kind ) {
  return FRUIT_KINDS.find( ( f ) => f.kind === kind );
}

function abilityInfo( ability ) {
  return FRUIT_KINDS.find( ( f ) => f.ability === ability );
}

function tickFruit( game ) {
  const f = game.fruit;
  const p = game.pacman;

  // Habilidad activa: cuenta atras.
  if ( p.ability.kind ) {
    p.ability.timer--;
    if ( p.ability.timer <= 0 ) p.ability.kind = null;
  }

  // Aparicion.
  if ( !f.active && f.spawned < FRUIT_SPAWNS.length && f.dotsEaten >= FRUIT_SPAWNS[ f.spawned ] ) {
    f.kind = FRUIT_KINDS[ f.spawned ].kind;
    f.active = true;
    f.timer = FRUIT_DURATION;
    f.spawned++;
  }
  if ( !f.active ) return;

  f.timer--;
  if ( f.timer <= 0 ) { f.active = false; return; }

  // Comer: Pacman alineado sobre la celda de la fruta.
  if ( Math.abs( p.x - f.x ) < 1e-3 && Math.abs( p.y - f.y ) < 1e-3 ) {
    const info = fruitInfo( f.kind );
    game.score += info.points;
    p.ability.kind = info.ability;
    p.ability.timer = info.duration;
    p.ability.total = info.duration;
    f.active = false;
  }
}

window.FRUIT_KINDS = FRUIT_KINDS;
window.createFruit = createFruit;
window.tickFruit = tickFruit;
window.fruitInfo = fruitInfo;
window.abilityInfo = abilityInfo;
