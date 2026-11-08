'use strict';
/* ============ Datos del juego ============ */
const TILE = 32, MAP_W = 72, MAP_H = 72, CARRY = 10, POP_MAX = 200;
const PCOL = ['#3b7bff', '#e0403a'];
const PDARK = ['#1d46a8', '#8e1f1b'];
const AGES = ['Edad Oscura', 'Edad Feudal', 'Edad de los Castillos', 'Edad Imperial'];
const AGE_COST = [null, { food: 500 }, { food: 800, gold: 200 }, { food: 1000, gold: 800 }];
const AGE_TIME = [0, 20, 26, 32];
const RES_ICON = { food: '🍖', wood: '🪵', gold: '🪙', stone: '🪨' };
const RES_NAME = { food: 'Comida', wood: 'Madera', gold: 'Oro', stone: 'Piedra' };

// Nodos de recursos del mapa
const NODE = {
  tree:  { res: 'wood',  amount: 100, name: 'Árbol',              rate: 0.9, icon: '🌲' },
  berry: { res: 'food',  amount: 200, name: 'Arbusto de bayas',   rate: 1.0, icon: '🫐' },
  gold:  { res: 'gold',  amount: 800, name: 'Mina de oro',        rate: 0.8, icon: '🪙' },
  stone: { res: 'stone', amount: 800, name: 'Cantera de piedra',  rate: 0.8, icon: '🪨' },
};
const FARM_RATE = 0.6;

// Unidades. rate = segundos entre ataques, speed = casillas/seg, range en casillas
const UNITS = {
  villager:  { name: 'Aldeano',    icon: '🧑‍🌾', cost: { food: 50 },             time: 9,  hp: 25,  atk: 3,  atkType: 'melee',  range: 0, rate: 1.5, speed: 2.2, sight: 6, mArm: 0, pArm: 0, cls: 'vil',  age: 0, at: 'tc',       desc: 'Recolecta recursos y construye.' },
  swordsman: { name: 'Espadachín', icon: '🗡️', cost: { food: 50, gold: 25 },    time: 12, hp: 60,  atk: 9,  atkType: 'melee',  range: 0, rate: 1.4, speed: 2.1, sight: 6, mArm: 1, pArm: 1, cls: 'inf',  age: 0, at: 'barracks', desc: 'Infantería versátil.' },
  spearman:  { name: 'Lancero',    icon: '🔱', cost: { food: 35, wood: 25 },    time: 10, hp: 45,  atk: 4,  atkType: 'melee',  range: 0, rate: 1.5, speed: 2.2, sight: 6, mArm: 0, pArm: 1, cls: 'inf',  age: 0, at: 'barracks', bonus: { cav: 5 }, desc: 'Letal contra caballería.' },
  archer:    { name: 'Arquero',    icon: '🏹', cost: { wood: 25, gold: 45 },    time: 13, hp: 35,  atk: 6,  atkType: 'pierce', range: 6, rate: 1.7, speed: 2.2, sight: 8, mArm: 0, pArm: 0, cls: 'arc',  age: 1, at: 'archery',  bonus: { inf: 1.3 }, desc: 'Ataque a distancia. Fuerte contra infantería.' },
  knight:    { name: 'Caballero',  icon: '🐎', cost: { food: 60, gold: 75 },    time: 17, hp: 110, atk: 11, atkType: 'melee',  range: 0, rate: 1.6, speed: 3.6, sight: 6, mArm: 2, pArm: 2, cls: 'cav',  age: 2, at: 'stable',   bonus: { arc: 1.5 }, desc: 'Caballería pesada, rápida. Fuerte contra arqueros.' },
  ram:       { name: 'Ariete',     icon: '🪵', cost: { wood: 160, gold: 75 },   time: 24, hp: 160, atk: 8,  atkType: 'melee',  range: 0, rate: 2.5, speed: 1.6, sight: 5, mArm: 0, pArm: 8, cls: 'siege',age: 2, at: 'barracks', bonus: { bld: 5 }, bldOnly: true, pop: 2, desc: 'Solo ataca edificios. Casi inmune a flechas.' },
  champion:  { name: 'Campeón',    icon: '⚔️', cost: { food: 80, gold: 55 },    time: 15, hp: 105, atk: 14, atkType: 'melee',  range: 0, rate: 1.3, speed: 2.3, sight: 6, mArm: 3, pArm: 3, cls: 'inf',  age: 3, at: 'barracks', desc: 'Infantería de élite.' },
};

// Edificios (size en casillas)
const BUILDINGS = {
  house:    { name: 'Casa',               icon: '🏠', size: 2, hp: 300,  cost: { wood: 30 },               time: 15, age: 0, pop: 5,  sight: 3, desc: '+5 de población.' },
  farm:     { name: 'Granja',             icon: '🌾', size: 3, hp: 120,  cost: { wood: 60 },               time: 10, age: 0, food: 350, passable: true, sight: 2, desc: 'Fuente de comida renovable.' },
  lumber:   { name: 'Aserradero',         icon: '🪓', size: 2, hp: 400,  cost: { wood: 100 },              time: 15, age: 0, drop: ['wood'], sight: 4, desc: 'Punto de entrega de madera.' },
  mill:     { name: 'Molino',             icon: '🌬️', size: 2, hp: 400,  cost: { wood: 100 },              time: 15, age: 0, drop: ['food'], sight: 4, desc: 'Punto de entrega de comida.' },
  mining:   { name: 'Campamento minero',  icon: '⛏️', size: 2, hp: 400,  cost: { wood: 100 },              time: 15, age: 0, drop: ['gold', 'stone'], sight: 4, desc: 'Entrega de oro y piedra.' },
  barracks: { name: 'Cuartel',            icon: '🛡️', size: 3, hp: 900,  cost: { wood: 150 },              time: 30, age: 0, trains: ['swordsman', 'spearman', 'ram', 'champion'], sight: 5, desc: 'Entrena infantería y arietes.' },
  archery:  { name: 'Campo de tiro',      icon: '🎯', size: 3, hp: 900,  cost: { wood: 150 },              time: 30, age: 1, trains: ['archer'], sight: 5, desc: 'Entrena arqueros.' },
  stable:   { name: 'Establo',            icon: '🐴', size: 3, hp: 900,  cost: { wood: 150 },              time: 30, age: 1, trains: ['knight'], sight: 5, desc: 'Entrena caballería.' },
  tower:    { name: 'Torre de vigilancia',icon: '🗼', size: 2, hp: 700,  cost: { wood: 50, stone: 100 },   time: 25, age: 1, atk: 8, atkType: 'pierce', range: 7, rate: 2, sight: 9, desc: 'Dispara a enemigos cercanos.' },
  tc:       { name: 'Centro urbano',      icon: '🏰', size: 4, hp: 1500, cost: { wood: 300, stone: 200 },  time: 60, age: 2, pop: 8, drop: ['food', 'wood', 'gold', 'stone'], trains: ['villager'], atk: 5, atkType: 'pierce', range: 6, rate: 2.2, sight: 9, desc: 'Centro de tu civilización.' },
};
for (const k in BUILDINGS) {
  const b = BUILDINGS[k];
  b.cls = 'bld'; b.mArm = 2; b.pArm = 10;
  if (k === 'farm') { b.mArm = 0; b.pArm = 0; }
}
function costStr(c) { return Object.keys(c).map(k => RES_ICON[k] + c[k]).join(' '); }
