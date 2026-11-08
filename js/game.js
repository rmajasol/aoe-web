'use strict';
/* ============ Motor del juego ============ */
const W = MAP_W, H = MAP_H;
const G = {
  t: 0, speed: 1, over: false, paused: false, nextId: 1,
  units: [], buildings: [], nodes: [], animals: [], proj: [], fx: [],
  players: [], byId: new Map(),
  terrain: null, blk: null, occ: null, pv: 0, vis: null,
  fogT: 0, dirty: false, rand: Math.random, lastAlert: -99, starts: [],
};

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const alive = e => !!e && !e.dead;
const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
function isBlk(px, py) {
  const x = Math.floor(px), y = Math.floor(py);
  return x < 0 || y < 0 || x >= W || y >= H || G.blk[y * W + x] !== 0;
}
function distRect(px, py, r) {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w)), dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}
const isPt = e => e.kind === 'unit' || e.kind === 'animal';
function center(e) { return isPt(e) ? { x: e.x, y: e.y } : { x: e.x + e.w / 2, y: e.y + e.h / 2 }; }
function distEnt(u, t) {
  if (isPt(t)) return Math.max(0, Math.hypot(u.x - t.x, u.y - t.y) - 0.3);
  return distRect(u.x, u.y, t);
}
function defOf(e) { return e.kind === 'unit' ? UNITS[e.type] : e.kind === 'animal' ? ANIMALS[e.type] : BUILDINGS[e.type]; }

/* ---------- Mapa ---------- */
function resetWorld() {
  G.terrain = new Uint8Array(W * H); G.blk = new Uint8Array(W * H); G.occ = new Uint8Array(W * H);
  G.vis = new Uint8Array(W * H);
  G.units = []; G.buildings = []; G.nodes = []; G.animals = []; G.proj = []; G.fx = [];
  G.byId.clear(); G.nextId = 1; G.pv++;
}
function addNode(type, x, y) {
  if (!inMap(x, y)) return null;
  const i = y * W + x;
  if (G.blk[i] || G.occ[i] || G.terrain[i]) return null;
  const d = NODE[type];
  const n = { id: G.nextId++, kind: 'node', type, owner: -1, x, y, w: 1, h: 1, res: d.res, amount: d.amount, max: d.amount, v: Math.floor(G.rand() * 4) };
  G.nodes.push(n); G.byId.set(n.id, n);
  G.blk[i] = 1; G.occ[i] = 1;
  return n;
}
function genMap(seed) {
  resetWorld();
  const R = mulberry32(seed); G.rand = R;
  const starts = [{ x: 11, y: 56 }, { x: 57, y: 12 }];
  G.starts = starts;
  const cs = starts.map(s => ({ x: s.x + 2, y: s.y + 2 }));
  const nearBase = (x, y, r) => cs.some(c => Math.hypot(x - c.x, y - c.y) < r);
  // lagos
  const lakes = 4 + Math.floor(R() * 3);
  for (let k = 0; k < lakes; k++) {
    let cx, cy, tries = 0;
    do { cx = 6 + R() * (W - 12); cy = 6 + R() * (H - 12); tries++; } while (nearBase(cx, cy, 20) && tries < 50);
    const r = 2 + R() * 3.2, ph = R() * 6;
    for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
      if (!inMap(x, y) || nearBase(x, y, 14)) continue;
      const a = Math.atan2(y - cy, x - cx);
      const rr = r * (0.8 + 0.3 * Math.sin(a * 3 + ph));
      if (Math.hypot(x - cx, y - cy) < rr) { G.terrain[y * W + x] = 1; G.blk[y * W + x] = 1; }
    }
  }
  const free = (x, y) => inMap(x, y) && !G.terrain[y * W + x] && !G.occ[y * W + x] && !nearBase(x, y, 6);
  // bosques
  const forests = 16;
  for (let k = 0; k < forests; k++) {
    let cx, cy, tries = 0;
    do { cx = 2 + Math.floor(R() * (W - 4)); cy = 2 + Math.floor(R() * (H - 4)); tries++; } while ((nearBase(cx, cy, 9) || !free(cx, cy)) && tries < 80);
    let x = cx, y = cy; const n = 22 + Math.floor(R() * 40);
    for (let i = 0; i < n; i++) {
      if (free(x, y) && R() < 0.88) addNode('tree', x, y);
      const d = Math.floor(R() * 4); x += [1, -1, 0, 0][d]; y += [0, 0, 1, -1][d];
      if (R() < 0.12) { x = cx + Math.floor((R() - 0.5) * 6); y = cy + Math.floor((R() - 0.5) * 6); }
    }
  }
  // cluster helper
  function cluster(type, cx, cy, n, spread) {
    const cand = [];
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const x = Math.round(cx) + dx, y = Math.round(cy) + dy;
      if (inMap(x, y) && !G.terrain[y * W + x] && !G.occ[y * W + x]) cand.push({ x, y, d: dx * dx + dy * dy + R() * spread });
    }
    cand.sort((a, b) => a.d - b.d);
    let placed = 0;
    for (const c of cand) { if (placed >= n) break; if (nearBase(c.x, c.y, 5.5)) continue; if (addNode(type, c.x, c.y)) placed++; }
  }
  // Recursos por base
  cs.forEach((c, i) => {
    const ang = Math.atan2(H / 2 - c.y, W / 2 - c.x);
    const at = (a, d) => ({ x: Math.min(W - 4, Math.max(3, c.x + Math.cos(a) * d)), y: Math.min(H - 4, Math.max(3, c.y + Math.sin(a) * d)) });
    let p = at(ang + 0.9, 7.5); cluster('berry', p.x, p.y, 7, 3);
    p = at(ang - 0.9, 10); cluster('gold', p.x, p.y, 6, 2);
    p = at(ang + 2.3, 10); cluster('stone', p.x, p.y, 5, 2);
    p = at(ang + Math.PI, 9); cluster('tree', p.x, p.y, 22, 14);
    p = at(ang - 2.3, 11); cluster('tree', p.x, p.y, 20, 14);
  });
  // Recursos en el centro
  cluster('gold', W / 2 - 4, H / 2 + 3, 6, 2); cluster('gold', W / 2 + 4, H / 2 - 3, 6, 2);
  cluster('stone', W / 2, H / 2 - 7, 5, 2); cluster('stone', W / 2, H / 2 + 7, 5, 2);
  cluster('berry', W / 2 - 10, H / 2 - 10, 6, 3); cluster('berry', W / 2 + 10, H / 2 + 10, 6, 3);
  // fauna
  const herd = (type, n, cx, cy, spread) => { for (let i = 0; i < n; i++) for (let k = 0; k < 14; k++) { const x = cx + (R() - .5) * spread * 2, y = cy + (R() - .5) * spread * 2, tx = Math.floor(x), ty = Math.floor(y); if (inMap(tx, ty) && !G.blk[ty * W + tx] && !nearBase(x, y, 7)) { addAnimal(type, x, y); break; } } };
  cs.forEach(c => {
    const ang = Math.atan2(H / 2 - c.y, W / 2 - c.x), at = (a, d) => ({ x: Math.min(W - 4, Math.max(4, c.x + Math.cos(a) * d)), y: Math.min(H - 4, Math.max(4, c.y + Math.sin(a) * d)) });
    let p = at(ang + 1.7, 10); herd('pig', 3, p.x, p.y, 2.2);
    p = at(ang - 1.7, 11); herd('sheep', 3, p.x, p.y, 2.2);
    p = at(ang + .2, 17); herd('boar', 1, p.x, p.y, 1.5);
    p = at(ang - .5, 15); herd('deer', 4, p.x, p.y, 3);
  });
  for (let k = 0; k < 6; k++) { let cx, cy, tries = 0; do { cx = 6 + R() * (W - 12); cy = 6 + R() * (H - 12); tries++; } while ((nearBase(cx, cy, 18) || G.blk[Math.floor(cy) * W + Math.floor(cx)]) && tries < 40); herd(k % 3 === 2 ? 'boar' : 'deer', k % 3 === 2 ? 2 : 5, cx, cy, 3.5); }
  // conectividad
  const seen = new Uint8Array(W * H), q = [Math.floor(cs[0].y) * W + Math.floor(cs[0].x)];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue;
      const ni = ny * W + nx; if (seen[ni] || G.blk[ni]) continue; seen[ni] = 1; q.push(ni);
    }
  }
  return seen[Math.floor(cs[1].y) * W + Math.floor(cs[1].x)] === 1;
}

/* ---------- Entidades ---------- */
function occupy(b, v) {
  const D = BUILDINGS[b.type];
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
    G.occ[y * W + x] = v; G.blk[y * W + x] = (v && !D.passable) ? 1 : 0;
  }
  G.pv++;
}
function addBuilding(owner, type, x, y, done) {
  const D = BUILDINGS[type];
  const b = {
    id: G.nextId++, kind: 'building', type, owner, x, y, w: D.size, h: D.size,
    maxhp: D.hp, hp: done ? D.hp : Math.max(1, D.hp * 0.1), done: !!done, progress: done ? 1 : 0, bn: 0,
    queue: [], qt: 0, rally: null, cool: 0, scan: 0, target: null, food: D.food || 0, research: null, flash: 0,
  };
  G.buildings.push(b); G.byId.set(b.id, b); occupy(b, 1);
  if (done) recalcPop(owner);
  return b;
}
function addUnit(owner, type, x, y, countPop) {
  const D = UNITS[type], p = G.players[owner], m = 1 + 0.06 * p.age;
  const u = {
    id: G.nextId++, kind: 'unit', type, owner, x, y, hp: D.hp * m, maxhp: D.hp * m,
    order: null, path: null, pi: 0, dir: Math.random() * 6.28, cool: 0, carry: 0, ctype: null,
    scan: Math.random() * 0.5, flash: 0, anim: 0, swing: 0, pathT: 0, pv: G.pv, retry: 0, born: G.t,
  };
  G.units.push(u); G.byId.set(u.id, u);
  if (countPop) p.pop += D.pop || 1;
  return u;
}
function recalcPop(owner) {
  let cap = 0;
  for (const b of G.buildings) if (b.owner === owner && b.done && !b.dead) cap += BUILDINGS[b.type].pop || 0;
  G.players[owner].popCap = Math.min(POP_MAX, cap);
}
function killEntity(e) {
  if (e.dead) return;
  e.dead = true; G.dirty = true; G.byId.delete(e.id);
  if (e.kind === 'unit') {
    G.players[e.owner].pop -= UNITS[e.type].pop || 1;
    G.fx.push({ type: 'blood', x: e.x, y: e.y, t: 0, dur: 6 });
    G.fx.push({ type: 'corpse', x: e.x, y: e.y, ut: e.type, owner: e.owner, dir: e.dir, side: Math.random() < .5 ? 1 : -1, t: 0, dur: 9 });
    for (let i = 0; i < 5; i++) chip(e.x, e.y, 18, i % 2 ? '#8a1a14' : '#b82a20', 'drop');
  } else if (e.kind === 'building') {
    occupy(e, 0);
    const p = G.players[e.owner];
    for (const q of e.queue) p.pop -= UNITS[q.type].pop || 1;
    if (e.research) p.researching = null;
    recalcPop(e.owner);
    G.fx.push({ type: 'boom', x: e.x + e.w / 2, y: e.y + e.h / 2, t: 0, dur: 1.2, r: e.w });
    if (e.type !== 'farm') {
      G.fx.push({ type: 'rubble', x: e.x, y: e.y, w: e.w, seed: e.id, t: 0, dur: 40 });
      for (let i = 0; i < 6 + e.w * 3; i++) chip(e.x + Math.random() * e.w, e.y + Math.random() * e.h, 20 + Math.random() * 30, ['#8a8478', '#6a5a48', '#4a3a2a', PCOL[e.owner]][i % 4], 'chip');
      for (let i = 0; i < e.w * 3; i++) G.fx.push({ type: 'smoke', x: e.x + Math.random() * e.w, y: e.y + Math.random() * e.h, t: -Math.random() * 1.5, dur: 3 + Math.random() * 2, s: e.w });
    }
    if (e.owner === 0) notify('¡Has perdido: ' + BUILDINGS[e.type].name + '!', 'danger');
    checkEnd();
  } else if (e.kind === 'animal') {
    addCarcass(e);
    G.fx.push({ type: 'blood', x: e.x, y: e.y, t: 0, dur: 5 });
    for (let i = 0; i < 6; i++) G.fx.push({ type: 'dust', x: e.x + (Math.random() - .5) * .6, y: e.y + (Math.random() - .5) * .6, t: 0, dur: .8 });
  } else {
    if (!e.noblock) { G.occ[e.y * W + e.x] = 0; G.blk[e.y * W + e.x] = 0; G.pv++; }
    if (e.type === 'tree') {
      G.fx.push({ type: 'fell', x: e.x + .5, y: e.y + .5, v: e.v, dir: Math.random() < .5 ? 1 : -1, t: 0, dur: 1.3 });
      for (let i = 0; i < 10; i++) chip(e.x + .5, e.y + .5, 36 + Math.random() * 20, ['#2f8434', '#58b24a', '#7ccb5a', '#8a5a2a'][i % 4], 'leaf');
    }
  }
}
function cleanup() {
  if (!G.dirty) return;
  G.animals = G.animals.filter(e => !e.dead); G.units = G.units.filter(e => !e.dead); G.buildings = G.buildings.filter(e => !e.dead); G.nodes = G.nodes.filter(e => !e.dead);
  G.dirty = false;
}
function checkEnd() {
  if (G.over) return;
  const mine = G.buildings.some(b => b.owner === 0 && !b.dead);
  const theirs = G.buildings.some(b => b.owner === 1 && !b.dead);
  if (!mine || !theirs) { G.over = true; showEnd(theirs); }
}
function evict(b) {
  for (const u of G.units) {
    if (u.x >= b.x - 0.2 && u.x <= b.x + b.w + 0.2 && u.y >= b.y - 0.2 && u.y <= b.y + b.h + 0.2 && isBlk(u.x, u.y)) {
      const f = nearestFree(u.x, u.y); u.x = f.x; u.y = f.y; u.path = null;
    }
  }
}
function nearestFree(x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (inMap(tx, ty) && !G.blk[ty * W + tx]) return { x, y };
  for (let r = 1; r < 12; r++) {
    let best = null, bd = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = tx + dx, ny = ty + dy;
      if (!inMap(nx, ny) || G.blk[ny * W + nx]) continue;
      const d = Math.hypot(nx + 0.5 - x, ny + 0.5 - y);
      if (d < bd) { bd = d; best = { x: nx + 0.5, y: ny + 0.5 }; }
    }
    if (best) return best;
  }
  return { x, y };
}

/* ---------- Fauna ---------- */
function addAnimal(type, x, y) {
  const D = ANIMALS[type];
  const a = { id: G.nextId++, kind: 'animal', type, owner: -1, x, y, hx: x, hy: y, dir: Math.random() * 6.28, hp: D.hp, maxhp: D.hp, st: 'graze', t: Math.random() * 3, tx: x, ty: y, flash: 0, anim: Math.random() * 10, swing: 0, cool: 0, target: null, fleeT: 0, fightT: 0, male: Math.random() < .6 };
  G.animals.push(a); G.byId.set(a.id, a); return a;
}
function addCarcass(a) {
  const D = ANIMALS[a.type], tx = Math.max(0, Math.min(W - 1, Math.floor(a.x))), ty = Math.max(0, Math.min(H - 1, Math.floor(a.y)));
  const n = { id: G.nextId++, kind: 'node', type: 'carcass', animal: a.type, owner: -1, x: tx, y: ty, fx: a.x, fy: a.y, w: 1, h: 1, res: 'food', amount: D.food, max: D.food, v: 0, dir: a.dir, noblock: true, male: a.male };
  G.nodes.push(n); G.byId.set(n.id, n); return n;
}
function chip(x, y, h0, col, shape) { // partícula con física (astillas, chispas, hojas)
  if (G.fx.length > 260) return;
  const ang = Math.random() * 6.28, sp = 25 + Math.random() * 45;
  G.fx.push({ type: 'chip', x, y, h0, vx: Math.cos(ang) * sp, vz: 30 + Math.random() * 55, rot: (Math.random() - .5) * 3, col, shape: shape || 'chip', s: 1.5 + Math.random() * 1.6, t: 0, dur: .6 + Math.random() * .45 });
}
function steerTo(a, tx, ty, speed, dt) {
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  if (d < 0.2) return true;
  const want = Math.atan2(dy, dx); let diff = ((want - a.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  a.dir += Math.max(-1, Math.min(1, diff)) * Math.min(1, dt * 9);
  for (const off of [0, .7, -.7, 1.4, -1.4]) {
    const nx = a.x + Math.cos(a.dir + off) * speed * dt, ny = a.y + Math.sin(a.dir + off) * speed * dt;
    if (!isBlk(nx, ny) && nx > .5 && ny > .5 && nx < W - .5 && ny < H - .5) { a.x = nx; a.y = ny; a.dir += off * .35; a.stuck = 0; return false; }
  }
  a.stuck = (a.stuck || 0) + 1; return a.stuck > 8;
}
function startFlee(a, from) {
  const dx = a.x - from.x, dy = a.y - from.y, d = Math.hypot(dx, dy) || 1, f = nearestFree(Math.max(2, Math.min(W - 2, a.x + dx / d * 9 + (Math.random() - .5) * 4)), Math.max(2, Math.min(H - 2, a.y + dy / d * 9 + (Math.random() - .5) * 4)));
  a.st = 'flee'; a.tx = f.x; a.ty = f.y; a.fleeT = 4 + Math.random() * 2;
}
function animalHit(a, att) {
  const D = ANIMALS[a.type];
  if (D.fights && att && att.kind === 'unit') { a.st = 'fight'; a.target = att; a.fightT = 12; }
  else if (att) startFlee(a, att);
  for (const o of G.animals) if (o !== a && !o.dead && o.type === a.type && Math.hypot(o.x - a.x, o.y - a.y) < 7 && att && !ANIMALS[o.type].fights) startFlee(o, att);
}
function updateAnimal(a, dt) {
  const D = ANIMALS[a.type]; a.anim += dt; a.flash = Math.max(0, a.flash - dt); a.cool = Math.max(0, a.cool - dt); a.swing = Math.max(0, a.swing - dt);
  a.run = false;
  if (a.st === 'fight') {
    const t = a.target;
    if (!alive(t) || Math.hypot(t.x - a.x, t.y - a.y) > 13 || (a.fightT -= dt) <= 0) { a.st = 'graze'; a.t = 2; a.target = null; }
    else {
      const d = Math.hypot(t.x - a.x, t.y - a.y) - .3; a.run = true;
      if (d <= 1) { a.dir = Math.atan2(t.y - a.y, t.x - a.x); if (a.cool <= 0) { a.cool = 1.3; a.swing = .35; dealDamage(a, t, D.atk); } } else steerTo(a, t.x, t.y, D.run, dt);
      return;
    }
  }
  if (a.st === 'flee') {
    a.run = true;
    if ((a.fleeT -= dt) <= 0) { a.st = 'graze'; a.t = 2 + Math.random() * 3; }
    else { if (steerTo(a, a.tx, a.ty, D.run, dt)) a.fleeT = 0; if (Math.random() < dt * 6 && G.fx.length < 220) G.fx.push({ type: 'dust', x: a.x, y: a.y, t: 0, dur: .5 }); return; }
  }
  if (D.skittish) for (const u of G.units) if (!u.dead && Math.hypot(u.x - a.x, u.y - a.y) < D.skittish) { startFlee(a, u); a.run = true; return; }
  if (a.st === 'graze') {
    if ((a.t -= dt) <= 0) {
      const ang = Math.random() * 6.28, r = 1.5 + Math.random() * 4.5, f = nearestFree(Math.max(2, Math.min(W - 2, a.hx + Math.cos(ang) * r)), Math.max(2, Math.min(H - 2, a.hy + Math.sin(ang) * r)));
      a.tx = f.x; a.ty = f.y; a.st = 'walk'; a.walkT = 7;
    }
  } else if (a.st === 'walk') {
    if (steerTo(a, a.tx, a.ty, D.walk, dt) || (a.walkT -= dt) <= 0) { a.st = 'graze'; a.t = 2 + Math.random() * 5; }
  }
}

/* ---------- Economía ---------- */
const canAfford = (p, c) => Object.keys(c).every(k => p.res[k] >= c[k]);
function pay(p, c) { for (const k in c) p.res[k] -= c[k]; }
function refund(p, c) { for (const k in c) p.res[k] += c[k]; }
function gatherMul(owner) { const p = G.players[owner]; return p.ai ? p.ai.d.mul : 1; }

function canPlace(type, tx, ty, owner, margin) {
  const D = BUILDINGS[type], m = margin || 0;
  for (let y = ty - m; y < ty + D.size + m; y++) for (let x = tx - m; x < tx + D.size + m; x++) {
    const inside = x >= tx && x < tx + D.size && y >= ty && y < ty + D.size;
    if (!inMap(x, y)) { if (inside) return false; continue; }
    const i = y * W + x;
    if (inside && G.terrain[i]) return false;
    if (G.occ[i]) return false;
  }
  if (owner === 0) {
    const i = (ty + (D.size >> 1)) * W + tx + (D.size >> 1);
    if (G.vis[i] === 0) return false;
  }
  return true;
}
function placeBuilding(owner, type, tx, ty) {
  const D = BUILDINGS[type];
  pay(G.players[owner], D.cost);
  const b = addBuilding(owner, type, tx, ty, false);
  evict(b);
  return b;
}

function enqueue(b, type) {
  const p = G.players[b.owner], D = UNITS[type];
  if (!b.done || b.queue.length >= 6 || p.age < D.age || !canAfford(p, D.cost)) return false;
  const pop = D.pop || 1;
  if (p.pop + pop > p.popCap) { if (b.owner === 0) notify('Necesitas más casas.', 'warn'); return false; }
  pay(p, D.cost); p.pop += pop; b.queue.push({ type });
  return true;
}
function cancelQueue(b, i) {
  const q = b.queue[i]; if (!q) return;
  const p = G.players[b.owner]; refund(p, UNITS[q.type].cost); p.pop -= UNITS[q.type].pop || 1;
  b.queue.splice(i, 1); if (i === 0) b.qt = 0;
}
function startResearch(b) {
  const p = G.players[b.owner];
  if (b.type !== 'tc' || !b.done || p.age >= 3 || p.researching) return false;
  const c = AGE_COST[p.age + 1]; if (!canAfford(p, c)) return false;
  pay(p, c); b.research = { t: 0, total: AGE_TIME[p.age + 1] }; p.researching = b; return true;
}
function exitTile(b) {
  const D = BUILDINGS[b.type], target = b.rally ? (b.rally.node ? center(b.rally.node) : b.rally) : { x: b.x + b.w / 2, y: b.y + b.h + 3 };
  let best = null, bd = 1e9;
  for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) {
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) continue;
    if (!inMap(x, y) || G.blk[y * W + x]) continue;
    const d = Math.hypot(x + 0.5 - target.x, y + 0.5 - target.y) + Math.random() * 0.8;
    if (d < bd) { bd = d; best = { x: x + 0.5, y: y + 0.5 }; }
  }
  return best || nearestFree(b.x + b.w / 2, b.y + b.h + 1);
}
function finishBuilding(b) {
  b.done = true; b.progress = 1; b.hp = b.maxhp; recalcPop(b.owner);
  G.fx.push({ type: 'done', x: b.x + b.w / 2, y: b.y + b.h / 2, r: b.w, t: 0, dur: 1.4 });
  if (b.owner === 0) { notify(BUILDINGS[b.type].name + ' completado.', 'ok'); sfx('build'); }
}

/* ---------- Pathfinding (A*) ---------- */
const NN = W * H;
const A = { g: new Float32Array(NN), par: new Int32Array(NN), seen: new Int32Array(NN), closed: new Int32Array(NN), stamp: 0 };
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
function los(x0, y0, x1, y1, c) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
  if (d < 0.01) return true;
  const n = Math.ceil(d / 0.25), nx = -dy / d * c, ny = dx / d * c;
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = x0 + dx * t, y = y0 + dy * t;
    if (isBlk(x, y) || (c > 0 && (isBlk(x + nx, y + ny) || isBlk(x - nx, y - ny)))) return false;
  }
  return true;
}
function findPath(sx, sy, goal, partial) {
  const stx = Math.floor(sx), sty = Math.floor(sy);
  if (!inMap(stx, sty)) return null;
  const st = ++A.stamp;
  const gcx = goal.x + goal.w / 2, gcy = goal.y + goal.h / 2, slack = Math.max(goal.w, goal.h) / 2 + goal.reach;
  const hf = (x, y) => Math.max(0, Math.hypot(x + 0.5 - gcx, y + 0.5 - gcy) - slack);
  const hF = [], hI = [];
  const push = (f, i) => {
    let k = hF.length; hF.push(f); hI.push(i);
    while (k > 0) { const p = (k - 1) >> 1; if (hF[p] <= f) break; hF[k] = hF[p]; hI[k] = hI[p]; k = p; }
    hF[k] = f; hI[k] = i;
  };
  const pop = () => {
    const ri = hI[0], lf = hF.pop(), li = hI.pop(), n = hF.length;
    if (n > 0) {
      let k = 0;
      for (;;) {
        let c = 2 * k + 1; if (c >= n) break;
        if (c + 1 < n && hF[c + 1] < hF[c]) c++;
        if (hF[c] >= lf) break;
        hF[k] = hF[c]; hI[k] = hI[c]; k = c;
      }
      hF[k] = lf; hI[k] = li;
    }
    return ri;
  };
  const si = sty * W + stx;
  A.g[si] = 0; A.par[si] = -1; A.seen[si] = st;
  let best = si, bestH = hf(stx, sty), found = -1, iter = 0;
  push(bestH, si);
  while (hF.length) {
    const i = pop();
    if (A.closed[i] === st) continue;
    A.closed[i] = st;
    const x = i % W, y = (i / W) | 0;
    if (distRect(x + 0.5, y + 0.5, goal) <= goal.reach) { found = i; break; }
    if (++iter > 9000) break;
    for (let k = 0; k < 8; k++) {
      const d = DIRS[k], nx = x + d[0], ny = y + d[1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (G.blk[ni]) continue;
      if (k >= 4 && (G.blk[y * W + nx] || G.blk[ny * W + x])) continue;
      const ng = A.g[i] + d[2];
      if (A.seen[ni] === st && ng >= A.g[ni]) continue;
      A.seen[ni] = st; A.g[ni] = ng; A.par[ni] = i;
      const h = hf(nx, ny);
      if (h < bestH) { bestH = h; best = ni; }
      push(ng + h, ni);
    }
  }
  let end = found;
  if (end < 0) { if (!partial || best === si) return null; end = best; }
  const tiles = [];
  for (let i = end; i !== si && i >= 0; i = A.par[i]) tiles.push({ x: (i % W) + 0.5, y: ((i / W) | 0) + 0.5 });
  tiles.reverse();
  // suavizado
  const out = []; let ax = sx, ay = sy, i = 0;
  while (i < tiles.length) {
    let j = i;
    for (let k = tiles.length - 1; k > i; k--) if (los(ax, ay, tiles[k].x, tiles[k].y, 0.28)) { j = k; break; }
    out.push(tiles[j]); ax = tiles[j].x; ay = tiles[j].y; i = j + 1;
  }
  return out;
}
function goalFor(e, reach) {
  const unit = isPt(e);
  return { x: unit ? e.x : e.x, y: e.y, w: unit ? 0 : e.w, h: unit ? 0 : e.h, reach };
}
function pathTo(u, goal, partial) {
  const p = findPath(u.x, u.y, goal, partial);
  if (!p) { u.path = null; return false; }
  u.path = p; u.pi = 0; u.pathT = 0; u.pv = G.pv; return true;
}
function stepAlong(u, dt) {
  if (!u.path) return 'done';
  u.pathT += dt;
  if (u.pv !== G.pv) {
    u.pv = G.pv;
    for (let k = u.pi; k < Math.min(u.path.length, u.pi + 6); k++) if (isBlk(u.path[k].x, u.path[k].y)) { u.path = null; return 'blocked'; }
  }
  let move = UNITS[u.type].speed * dt;
  while (move > 0 && u.pi < u.path.length) {
    const p = u.path[u.pi], dx = p.x - u.x, dy = p.y - u.y, d = Math.hypot(dx, dy);
    if (d > 0.001) u.dir = Math.atan2(dy, dx);
    if (d <= move) { u.x = p.x; u.y = p.y; u.pi++; move -= d; }
    else { u.x += dx / d * move; u.y += dy / d * move; move = 0; }
  }
  if (u.pi >= u.path.length) { u.path = null; return 'done'; }
  return 'moving';
}

/* ---------- Combate ---------- */
function calcDmg(att, t) {
  const D = defOf(att), T = defOf(t);
  let a = D.atk * (1 + 0.06 * G.players[att.owner].age);
  if (D.bonus && D.bonus[T.cls]) a *= D.bonus[T.cls];
  const arm = D.atkType === 'melee' ? T.mArm : T.pArm;
  return Math.max(1, a - arm);
}
function alertAttack(t) {
  if (G.t - G.lastAlert > 10) {
    G.lastAlert = G.t; notify('¡Te están atacando!', 'danger'); sfx('alert');
    const c = center(t); G.fx.push({ type: 'ping', x: c.x, y: c.y, t: 0, dur: 3 });
  }
}
function dealDamage(att, t, dmg) {
  if (t.dead) return;
  t.hp -= dmg; t.flash = 0.12;
  const c = center(t);
  if (G.fx.length < 200) G.fx.push({ type: 'spark', x: c.x + (Math.random() - .5) * .4, y: c.y + (Math.random() - .5) * .4, t: 0, dur: 0.3 });
  if (t.owner === 0 && att && att.owner !== 0) alertAttack(t);
  if (t.hp <= 0) { killEntity(t); return; }
  if (t.kind === 'animal') { animalHit(t, att); return; }
  if (t.kind === 'unit' && !t.order && att && alive(att) && att.kind === 'unit') {
    const D = UNITS[t.type];
    if (D.cls !== 'vil' && !D.bldOnly) setOrder(t, { type: 'attack', target: att, auto: true });
  }
}
function attackOnce(u, t) {
  const D = UNITS[u.type], hunting = u.type === 'villager' && t.kind === 'animal', dmg = hunting ? 10 : calcDmg(u, t);
  if (D.range > 0 || hunting) {
    const c = center(t);
    G.proj.push({ sx: u.x, sy: u.y, x: u.x, y: u.y, target: t, last: c, dmg, att: u, spear: hunting, t: 0, dur: Math.max(0.15, distEnt(u, t) / (hunting ? 11 : 14)) });
  } else dealDamage(u, t, dmg);
}
function updateProj(dt) {
  for (const pr of G.proj) {
    pr.t += dt;
    const k = Math.min(1, pr.t / pr.dur);
    if (alive(pr.target)) pr.last = center(pr.target);
    pr.x = pr.sx + (pr.last.x - pr.sx) * k; pr.y = pr.sy + (pr.last.y - pr.sy) * k;
    if (k >= 1) {
      const hit = alive(pr.target);
      if (hit) dealDamage(pr.att, pr.target, pr.dmg);
      if ((!hit || pr.target.kind === 'building') && G.fx.length < 240) G.fx.push({ type: 'stuck', x: pr.x + (Math.random() - .5) * .3, y: pr.y + (Math.random() - .5) * .3, a: Math.atan2(pr.last.y - pr.sy, pr.last.x - pr.sx), spear: pr.spear, t: 0, dur: 6 });
      pr.done = true;
    }
  }
  G.proj = G.proj.filter(p => !p.done);
}
// Busca el enemigo más cercano
function acquire(u, range) {
  const D = UNITS[u.type];
  let best = null, bd = range;
  if (!D.bldOnly) for (const e of G.units) {
    if (e.dead || e.owner === u.owner) continue;
    const d = Math.hypot(e.x - u.x, e.y - u.y) + (UNITS[e.type].cls === 'vil' ? 1.5 : 0);
    if (d < bd) { bd = d; best = e; }
  }
  if (best) return best;
  bd = range;
  for (const b of G.buildings) {
    if (b.dead || b.owner === u.owner) continue;
    const d = distRect(u.x, u.y, b);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function chase(u, t, dt, auto) {
  const D = UNITS[u.type], hunting = u.type === 'villager' && t.kind === 'animal', rng = hunting ? 3.6 : D.range, reach = rng > 0 ? rng : 0.95, d = distEnt(u, t);
  if (d <= reach) {
    u.path = null;
    const c = center(t); u.dir = Math.atan2(c.y - u.y, c.x - u.x);
    if (u.cool <= 0) { attackOnce(u, t); u.cool = hunting ? 1.9 : D.rate; u.swing = 0.25; }
    return true;
  }
  if (auto && d > D.sight + 3) return false;
  const moved = isPt(t) && Math.hypot(t.x - (u.tx || 0), t.y - (u.ty || 0)) > 1.3;
  if (!u.path || (moved && u.pathT > 0.5)) {
    const rg = rng > 0 ? Math.max(0.8, rng - 0.7) : 0.8;
    if (!pathTo(u, goalFor(t, rg))) return false;
    u.tx = t.x; u.ty = t.y;
  }
  if (stepAlong(u, dt) === 'blocked') u.path = null;
  return true;
}

/* ---------- Órdenes ---------- */
function setOrder(u, o) { u.order = o; u.path = null; u.retry = 0; }
function assignFormation(us, x, y) {
  const cx = Math.floor(x), cy = Math.floor(y), cand = [];
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
    const tx = cx + dx, ty = cy + dy;
    if (inMap(tx, ty) && !G.blk[ty * W + tx]) cand.push({ x: tx + .5, y: ty + .5, d: dx * dx + dy * dy + Math.random() * .5 });
  }
  cand.sort((a, b) => a.d - b.d);
  const ord = us.map((u, i) => i).sort((a, b) => Math.hypot(us[a].x - x, us[a].y - y) - Math.hypot(us[b].x - x, us[b].y - y));
  const out = new Array(us.length);
  ord.forEach((ui, k) => { out[ui] = cand[k] || { x, y }; });
  return out;
}
function issueMove(list, x, y, amove) {
  const us = list.filter(e => e.kind === 'unit' && !e.dead); if (!us.length) return;
  const tg = us.length === 1 ? [nearestFree(x, y)] : assignFormation(us, x, y);
  us.forEach((u, i) => setOrder(u, { type: amove ? 'amove' : 'move', x: tg[i].x, y: tg[i].y, target: null }));
}
function issueAttack(list, t) {
  for (const u of list) {
    if (u.kind !== 'unit' || u.dead) continue;
    if (UNITS[u.type].bldOnly && isPt(t)) { issueMove([u], t.x, t.y); continue; }
    setOrder(u, { type: 'attack', target: t });
  }
}
function nodeRes(n) { return n.kind === 'building' ? 'food' : n.res; }
function nearbyNode(x, y, type, maxD) {
  let best = null, bd = maxD;
  for (const n of G.nodes) {
    if (!alive(n) || (type && n.type !== type)) continue;
    const d = Math.hypot(n.x + .5 - x, n.y + .5 - y);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
function issueGather(list, n) {
  const move = [];
  for (const u of list) {
    if (u.kind !== 'unit' || u.dead) continue;
    if (u.type === 'villager') setOrder(u, { type: 'gather', node: n, st: 'go', res: nodeRes(n), rx: n.x, ry: n.y });
    else move.push(u);
  }
  if (move.length) issueMove(move, n.x + .5, n.y + 1.5);
}
function issueBuild(list, b) {
  for (const u of list) if (u.kind === 'unit' && !u.dead && u.type === 'villager') {
    const prev = u.order && u.order.type === 'gather' ? u.order : (u.order && u.order.type === 'build' ? u.order.prev : null);
    setOrder(u, { type: 'build', b, prev: prev && alive(prev.node) ? prev : null });
  }
}
function farmLoads() {
  const m = new Map();
  for (const u of G.units) if (u.order && u.order.type === 'gather' && u.order.node && u.order.node.kind === 'building') m.set(u.order.node.id, (m.get(u.order.node.id) || 0) + 1);
  return m;
}
function findNode(res, x, y, owner, maxD) {
  let best = null, bd = maxD || 1e9;
  if (res === 'food') {
    const loads = farmLoads();
    for (const b of G.buildings) if (b.type === 'farm' && b.owner === owner && b.done && !b.dead && b.food > 0) {
      const l = loads.get(b.id) || 0; if (l >= 5) continue;
      const d = Math.hypot(b.x + 1.5 - x, b.y + 1.5 - y) + l * 2;
      if (d < bd) { bd = d; best = b; }
    }
  }
  for (const n of G.nodes) if (!n.dead && n.res === res && n.amount > 0) {
    const d = Math.hypot(n.x + .5 - x, n.y + .5 - y);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
function findDropoff(u, res) {
  let best = null, bd = 1e9;
  for (const b of G.buildings) {
    if (b.owner !== u.owner || !b.done || b.dead) continue;
    const dr = BUILDINGS[b.type].drop; if (!dr || !dr.includes(res)) continue;
    const d = Math.hypot(b.x + b.w / 2 - u.x, b.y + b.h / 2 - u.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function afterBuild(u, b) {
  const c = center(b);
  if (b.type === 'farm') { issueGather([u], b); return; }
  const kind = { mill: 'food', lumber: 'wood' }[b.type];
  if (kind) { const n = findNode(kind, c.x, c.y, u.owner, 14); if (n) { issueGather([u], n); return; } }
  if (b.type === 'mining') {
    const g = findNode('gold', c.x, c.y, u.owner, 10), s = findNode('stone', c.x, c.y, u.owner, 10);
    const n = g && s ? (Math.hypot(g.x - c.x, g.y - c.y) <= Math.hypot(s.x - c.x, s.y - c.y) ? g : s) : (g || s);
    if (n) { issueGather([u], n); return; }
  }
  let nb = null, bd = 12;
  for (const o of G.buildings) if (!o.dead && !o.done && o.owner === u.owner) { const d = Math.hypot(o.x - u.x, o.y - u.y); if (d < bd) { bd = d; nb = o; } }
  if (nb) { const prev = u.order && u.order.prev; setOrder(u, { type: 'build', b: nb, prev }); return; }
  const pv = u.order && u.order.prev;
  if (pv && alive(pv.node)) { issueGather([u], pv.node); return; }
  u.order = null;
}

/* ---------- Actualización de unidades ---------- */
function updateUnit(u, dt) {
  const D = UNITS[u.type];
  u.cool = Math.max(0, u.cool - dt); u.flash = Math.max(0, u.flash - dt); u.swing = Math.max(0, u.swing - dt); u.anim += dt;
  const o = u.order;
  if (!o) {
    if (D.atk > 0 && D.cls !== 'vil') {
      u.scan -= dt;
      if (u.scan <= 0) {
        u.scan = 0.4 + Math.random() * 0.2;
        const t = acquire(u, D.sight);
        if (t) setOrder(u, { type: 'attack', target: t, auto: true });
      }
    }
    return;
  }
  switch (o.type) {
    case 'move': {
      if (!u.path && !pathTo(u, { x: o.x, y: o.y, w: 0, h: 0, reach: 0.75 }, true)) { u.order = null; break; }
      const r = stepAlong(u, dt);
      if (r === 'done') u.order = null;
      else if (r === 'blocked' && ++u.retry > 6) u.order = null;
      break;
    }
    case 'attack': {
      const t = o.target;
      if (!alive(t)) {
        if (u.type === 'villager' && t.kind === 'animal') { let c = null, bd = 4; for (const n of G.nodes) if (!n.dead && n.type === 'carcass') { const d = Math.hypot(n.fx - t.x, n.fy - t.y); if (d < bd) { bd = d; c = n; } } if (c) { issueGather([u], c); break; } }
        u.order = null; u.path = null; break;
      }
      if (!chase(u, t, dt, o.auto)) { u.order = null; u.path = null; }
      break;
    }
    case 'amove': {
      if (!alive(o.target)) {
        o.target = null;
        u.scan -= dt;
        if (u.scan <= 0) { u.scan = 0.3; o.target = acquire(u, D.sight + 1); if (o.target) u.path = null; }
      }
      if (o.target) {
        if (!chase(u, o.target, dt, true)) { o.target = null; u.path = null; }
      } else {
        if (!u.path && !pathTo(u, { x: o.x, y: o.y, w: 0, h: 0, reach: 0.75 }, true)) { u.order = null; break; }
        const r = stepAlong(u, dt);
        if (r === 'done') u.order = null;
        else if (r === 'blocked' && ++u.retry > 6) u.order = null;
      }
      break;
    }
    case 'build': {
      const b = o.b;
      if (!alive(b)) { u.order = null; break; }
      if (b.done) { afterBuild(u, b); break; }
      if (distEnt(u, b) <= 1.0) {
        u.path = null; b.bn++; u.dir = Math.atan2(b.y + b.h / 2 - u.y, b.x + b.w / 2 - u.x);
        if (crossed(u.anim, dt, 1.0, .72)) { const fx = u.x + Math.cos(u.dir) * .7, fy = u.y + Math.sin(u.dir) * .7; for (let i = 0; i < 4; i++) chip(fx, fy, 14, ['#d8b27a', '#c8c0b0', '#8a6a3a'][i % 3], 'chip'); G.fx.push({ type: 'dust', x: fx, y: fy, t: 0, dur: .5 }); sfxAt('hammer', u.x, u.y); }
      } else {
        if (!u.path && !pathTo(u, goalFor(b, 0.8))) { u.order = null; break; }
        if (stepAlong(u, dt) === 'blocked' && ++u.retry > 6) u.order = null;
      }
      break;
    }
    case 'gather': updateGather(u, o, dt); break;
  }
}
function crossed(anim, dt, T, at) { const a = (((anim - dt) / T) % 1 + 1) % 1, b = (anim / T) % 1; return (a < at && b >= at) || (b < a && (a < at || b >= at)); }
function onStrike(u, n) {
  const x = n.fx != null ? n.fx : n.x + .5, y = n.fy != null ? n.fy : n.y + .5;
  if (n.type === 'tree') {
    n.shake = .34; for (let i = 0; i < 6; i++) chip(x, y, 20 + Math.random() * 16, ['#d8b27a', '#b08a58', '#ecd0a0'][i % 3], 'chip');
    if (Math.random() < .6) chip(x, y, 54, ['#58b24a', '#7ccb5a', '#2f8434'][Math.floor(Math.random() * 3)], 'leaf');
    sfxAt('chop', u.x, u.y);
  } else if (n.type === 'gold' || n.type === 'stone') {
    n.shake = .26; for (let i = 0; i < 5; i++) chip(x, y, 14 + Math.random() * 10, i % 2 ? '#ffe48a' : '#9aa0a6', i % 2 ? 'spark' : 'chip');
    if (n.type === 'gold') chip(x, y, 16, '#ffd23a', 'chip');
    sfxAt('mine', u.x, u.y);
  } else if (n.type === 'berry') {
    n.shake = .4; for (let i = 0; i < 3; i++) chip(x, y, 14 + Math.random() * 10, i === 0 ? '#e8284a' : '#58b24a', i === 0 ? 'chip' : 'leaf');
  } else if (n.type === 'carcass') {
    for (let i = 0; i < 2; i++) chip(x, y, 8, '#b02a2a', 'chip');
  } else if (n.kind === 'building') { // granja
    for (let i = 0; i < 3; i++) chip(u.x, u.y, 16, '#e0c048', 'leaf');
  }
}
function updateGather(u, o, dt) {
  let n = o.node;
  if (o.st !== 'drop' && !alive(n)) {
    n = findNode(o.res, o.rx, o.ry, u.owner, 16);
    if (n) { o.node = n; o.rx = n.x; o.ry = n.y; o.st = 'go'; u.path = null; }
    else if (u.carry > 0) { o.st = 'drop'; u.path = null; }
    else { u.order = null; return; }
  }
  if (o.st === 'go') {
    if (u.carry >= CARRY - 0.01 || (u.carry > 0 && u.ctype && u.ctype !== o.res)) {
      if (u.ctype !== o.res) { u.carry = 0; u.ctype = null; } else { o.st = 'drop'; u.path = null; }
      return;
    }
    if (distEnt(u, n) <= 1.0) { u.path = null; o.st = 'work'; return; }
    if (!u.path && !pathTo(u, goalFor(n, 0.8))) { u.order = null; return; }
    if (stepAlong(u, dt) === 'blocked') u.path = null;
  } else if (o.st === 'work') {
    if (!alive(n) || distEnt(u, n) > 1.4) { o.st = 'go'; return; }
    u.ctype = o.res;
    const isFarm = n.kind === 'building';
    const rate = (isFarm ? FARM_RATE : NODE[n.type].rate) * gatherMul(u.owner);
    const amt = isFarm ? n.food : n.amount;
    const T = isFarm ? 2.2 : n.type === 'tree' ? .95 : (n.type === 'berry' || n.type === 'carcass') ? 1.8 : 1.1, at = (n.type === 'tree' || n.type === 'gold' || n.type === 'stone') ? .72 : .5;
    if (crossed(u.anim, dt, T, at)) onStrike(u, n);
    const take = Math.min(rate * dt, amt, CARRY - u.carry);
    u.carry += take;
    if (isFarm) { n.food -= take; if (n.food <= 0.01) killEntityQuiet(n); }
    else { n.amount -= take; if (n.amount <= 0.01) killEntity(n); }
    const c = center(n); u.dir = Math.atan2(c.y - u.y, c.x - u.x);
    if (u.carry >= CARRY - 0.01) { o.st = 'drop'; u.path = null; }
  } else if (o.st === 'drop') {
    const d = findDropoff(u, u.ctype || o.res);
    if (!d) { u.order = null; return; }
    if (distEnt(u, d) <= 1.0) {
      G.players[u.owner].res[u.ctype || o.res] += Math.round(u.carry);
      if (u.owner === 0 && u.carry >= 1) G.fx.push({ type: 'float', x: u.x, y: u.y, txt: '+' + Math.round(u.carry), res: u.ctype || o.res, t: 0, dur: 1.4 });
      u.carry = 0; u.path = null; o.st = 'go';
      if (!alive(o.node)) { const nn = findNode(o.res, o.rx, o.ry, u.owner, 16); if (nn) { o.node = nn; o.rx = nn.x; o.ry = nn.y; } else u.order = null; }
      return;
    }
    if (!u.path && !pathTo(u, goalFor(d, 0.8))) { u.order = null; return; }
    if (stepAlong(u, dt) === 'blocked') u.path = null;
  }
}
function killEntityQuiet(b) { // granja agotada
  b.dead = true; G.dirty = true; G.byId.delete(b.id); occupy(b, 0);
}

function separate(dt) {
  const us = G.units, k = Math.min(1, dt * 8);
  for (let i = 0; i < us.length; i++) {
    const a = us[i]; if (a.dead) continue;
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j]; if (b.dead) continue;
      const dx = b.x - a.x; if (dx > 0.6 || dx < -0.6) continue;
      const dy = b.y - a.y; if (dy > 0.6 || dy < -0.6) continue;
      let d = Math.hypot(dx, dy); if (d >= 0.55) continue;
      let nx, ny;
      if (d < 0.001) { const r = Math.random() * 6.28; nx = Math.cos(r); ny = Math.sin(r); d = 0; } else { nx = dx / d; ny = dy / d; }
      const ov = (0.55 - d) * 0.5 * k;
      const wa = a.path ? 1 : 0.3, wb = b.path ? 1 : 0.3, s = wa + wb;
      const ax = a.x - nx * ov * (wa / s) * 2, ay = a.y - ny * ov * (wa / s) * 2;
      const bx = b.x + nx * ov * (wb / s) * 2, by = b.y + ny * ov * (wb / s) * 2;
      if (!isBlk(ax, ay)) { a.x = ax; a.y = ay; }
      if (!isBlk(bx, by)) { b.x = bx; b.y = by; }
    }
  }
}

/* ---------- Edificios ---------- */
function updateBuilding(b, dt) {
  const D = BUILDINGS[b.type];
  b.flash = Math.max(0, b.flash - dt);
  if (!b.done) {
    if (b.bn > 0) {
      const rate = Math.pow(b.bn, 0.7);
      b.progress = Math.min(1, b.progress + rate * dt / D.time);
      b.hp = Math.min(b.maxhp, b.hp + b.maxhp * 0.9 * rate * dt / D.time);
      if (b.progress >= 1) finishBuilding(b);
    }
    b.bn = 0; return;
  }
  const p = G.players[b.owner];
  if (b.queue.length) {
    b.qt += dt;
    const q = b.queue[0], UD = UNITS[q.type];
    if (b.qt >= UD.time) {
      b.qt = 0; b.queue.shift();
      const e = exitTile(b), u = addUnit(b.owner, q.type, e.x, e.y, false);
      if (b.rally) {
        const r = b.rally;
        // Recuerda posición y tipo del recurso para poder sustituirlo si se agota
        if (r.node && r.px == null) { r.px = r.node.x; r.py = r.node.y; r.rtype = r.node.type; }
        let node = r.node && alive(r.node) ? r.node : null;
        if (u.type === 'villager') {
          // Recurso agotado, o punto de reunión en el suelo junto a un recurso: busca el más cercano
          if (!node) node = nearbyNode(r.px != null ? r.px : r.x, r.py != null ? r.py : r.y, r.rtype, r.rtype ? 10 : 1.8);
        }
        if (node && u.type === 'villager') issueGather([u], node);
        else issueMove([u], r.x != null ? r.x : r.px + .5, r.y != null ? r.y : r.py + .5);
      }
      if (b.owner === 0) sfx('train');
    }
  }
  if (b.research) {
    b.research.t += dt;
    if (b.research.t >= b.research.total) {
      b.research = null; p.researching = null; p.age++;
      if (b.owner === 0) { notify('¡Avanzaste a la ' + AGES[p.age] + '!', 'ok'); sfx('age'); }
      else notify('El enemigo avanzó a la ' + AGES[p.age] + '.', 'warn');
    }
  }
  if (D.atk) {
    b.cool = Math.max(0, b.cool - dt); b.scan -= dt;
    const c = center(b);
    if (b.scan <= 0) {
      b.scan = 0.4; b.target = null; let bd = D.range;
      for (const e of G.units) if (!e.dead && e.owner !== b.owner) { const d = Math.hypot(e.x - c.x, e.y - c.y) - b.w / 2; if (d < bd) { bd = d; b.target = e; } }
    }
    if (alive(b.target) && b.cool <= 0 && Math.hypot(b.target.x - c.x, b.target.y - c.y) - b.w / 2 <= D.range + 0.5) {
      b.cool = D.rate;
      G.proj.push({ sx: c.x, sy: c.y, x: c.x, y: c.y, target: b.target, last: { x: b.target.x, y: b.target.y }, dmg: calcDmg(b, b.target), att: b, t: 0, dur: 0.35 });
    }
  }
}

/* ---------- Niebla de guerra (jugador) ---------- */
function updateFog() {
  const v = G.vis; G.fogStamp = (G.fogStamp || 0) + 1;
  for (let i = 0; i < v.length; i++) if (v[i] === 2) v[i] = 1;
  const reveal = (cx, cy, r) => {
    const r2 = r * r;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
        const dx = x + .5 - cx, dy = y + .5 - cy;
        if (dx * dx + dy * dy <= r2) v[y * W + x] = 2;
      }
  };
  for (const u of G.units) if (u.owner === 0 && !u.dead) reveal(u.x, u.y, UNITS[u.type].sight);
  for (const b of G.buildings) if (b.owner === 0 && !b.dead) reveal(b.x + b.w / 2, b.y + b.h / 2, b.done ? BUILDINGS[b.type].sight + b.w / 2 : 3);
}
function visibleAt(x, y) { const tx = Math.floor(x), ty = Math.floor(y); return inMap(tx, ty) && G.vis[ty * W + tx] === 2; }

/* ---------- Bucle de simulación ---------- */
function update(dt) {
  if (G.over && G.paused) return;
  G.t += dt;
  for (const p of G.players) if (p.ai) aiUpdate(p, dt);
  for (const b of G.buildings) if (!b.dead) updateBuilding(b, dt);
  for (const u of G.units) if (!u.dead) updateUnit(u, dt);
  for (const a of G.animals) if (!a.dead) updateAnimal(a, dt);
  for (const n of G.nodes) if (n.shake > 0) n.shake = Math.max(0, n.shake - dt);
  separate(dt);
  updateProj(dt);
  for (const u of G.units) if (u.path && !u.dead && G.fx.length < 200 && Math.random() < dt * (u.type === 'knight' ? 7 : u.type === 'ram' ? 3 : 1.2)) G.fx.push({ type: 'dust', x: u.x - Math.cos(u.dir) * .25, y: u.y - Math.sin(u.dir) * .25, t: 0, dur: .6 });
  for (const f of G.fx) f.t += dt;
  G.fx = G.fx.filter(f => f.t < f.dur);
  G.fogT -= dt;
  if (G.fogT <= 0) { G.fogT = 0.25; updateFog(); }
  cleanup();
}

/* ---------- Inicio de partida ---------- */
function startGame(diffKey) {
  let seed = Math.floor(Math.random() * 1e9);
  while (!genMap(seed)) seed++;
  G.t = 0; G.over = false; G.paused = false; G.speed = 1; G.lastAlert = -99;
  G.players = [0, 1].map(i => ({
    id: i, name: i ? 'Enemigo' : 'Jugador', res: { food: 200, wood: 200, gold: 100, stone: 100 },
    age: 0, pop: 0, popCap: 0, researching: null, ai: null,
  }));
  const d = DIFFS[diffKey] || DIFFS.normal;
  G.players[1].ai = { d, tick: 1, nextAttack: d.first, wave: 0, attacking: false, defendT: 0 };
  if (d.bonus) for (const k in d.bonus) G.players[1].res[k] += d.bonus[k];
  G.starts.forEach((s, i) => {
    const tc = addBuilding(i, 'tc', s.x, s.y, true);
    for (let k = 0; k < 5; k++) {
      const e = exitTile(tc);
      const u = addUnit(i, 'villager', e.x, e.y, true);
      if (i === 0) {
        const n = k < 3 ? findNode('food', tc.x + 2, tc.y + 2, 0, 20) : findNode('wood', tc.x + 2, tc.y + 2, 0, 30);
        if (n) issueGather([u], n);
      }
    }
  });
  updateFog();
}
