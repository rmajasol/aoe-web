'use strict';
/* ============ IA enemiga ============ */
const DIFFS = {
  easy:   { vils: 16, mul: 0.8,  first: 420, waveBase: 6,  waveInc: 3, think: 1.6, farms: 4, bonus: null },
  normal: { vils: 26, mul: 1.0,  first: 330, waveBase: 10, waveInc: 4, think: 1.0, farms: 6, bonus: null },
  hard:   { vils: 36, mul: 1.25, first: 240, waveBase: 14, waveInc: 5, think: 0.7, farms: 8, bonus: { food: 200, wood: 200, gold: 100 } },
};

function findSpot(type, cx, cy, rmin, rmax, margin) {
  const D = BUILDINGS[type];
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * 6.283, r = rmin + Math.random() * (rmax - rmin);
    const tx = Math.round(cx + Math.cos(a) * r - D.size / 2), ty = Math.round(cy + Math.sin(a) * r - D.size / 2);
    if (canPlace(type, tx, ty, 1, margin)) return { x: tx, y: ty };
  }
  return null;
}
function aiBuild(p, type, cx, cy, rmin, rmax, margin, nBuilders, vils) {
  if (!canAfford(p, BUILDINGS[type].cost)) return null;
  const spot = findSpot(type, cx, cy, rmin, rmax, margin); if (!spot) return null;
  const cand = vils.filter(v => !v.order || v.order.type !== 'build').sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, nBuilders);
  if (!cand.length) return null;
  const b = placeBuilding(p.id, type, spot.x, spot.y);
  issueBuild(cand, b);
  return b;
}

function aiUpdate(p, dt) {
  const a = p.ai; a.tick -= dt; if (a.tick > 0) return;
  a.tick = a.d.think;
  const d = a.d, my = G.units.filter(u => u.owner === p.id && !u.dead), mb = G.buildings.filter(b => b.owner === p.id && !b.dead);
  const tcs = mb.filter(b => b.type === 'tc' && b.done);
  const tc = tcs[0] || mb[0]; if (!tc) return;
  const home = center(tc);
  const vils = my.filter(u => u.type === 'villager');
  const army = my.filter(u => UNITS[u.type].cls !== 'vil');
  const cnt = t => mb.filter(b => b.type === t).length;
  const enemyBuildings = G.buildings.filter(b => b.owner !== p.id && !b.dead);

  // Ahorro para subir de edad
  const nextCost = p.age < 3 ? AGE_COST[p.age + 1] : null;
  const ageNeed = [0, 0.5, 0.75, 0.9][p.age];
  const wantAge = nextCost && !p.researching && vils.length >= d.vils * ageNeed && (p.age > 0 || vils.length >= 11);
  const afford2 = c => canAfford(p, wantAge && !(a.defendT > 0) ?Object.keys(c).reduce((o, k) => (o[k] = c[k] + (nextCost[k] || 0), o), {}) : c);

  // 1. Aldeanos
  const queuedVils = tcs.reduce((n, t) => n + t.queue.filter(q => q.type === 'villager').length, 0);
  for (const t of tcs) if (t.queue.length < 2 && vils.length + queuedVils < d.vils) enqueue(t, 'villager');

  // 2. Casas
  const unfinishedHouse = mb.some(b => b.type === 'house' && !b.done);
  const margin = 4 + Math.floor(mb.filter(b => BUILDINGS[b.type].trains && b.done).length * 1.5);
  if (p.popCap < POP_MAX && p.popCap - p.pop <= margin && !unfinishedHouse) {
    if (!aiBuild(p, 'house', home.x, home.y, 5, 11, 1, 1, vils)) a.needWood = true; else a.needWood = false;
  }

  // 3. Aldeanos inactivos
  const idle = vils.filter(v => !v.order);
  const have = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const v of vils) if (v.order && v.order.type === 'gather') have[v.order.res]++;
  const mix = p.age === 0 ? { food: .45, wood: .4, gold: .15, stone: 0 } : p.age === 1 ? { food: .38, wood: .3, gold: .24, stone: .08 } : { food: .33, wood: .27, gold: .28, stone: .12 };
  const total = Math.max(1, vils.length);
  if (idle.length) {
    for (const v of idle) {
      let bestR = 'food', bs = -1e9;
      for (const r in mix) { let s = mix[r] * total - have[r]; if (r === 'wood' && a.needWood) s += 2; if (r === 'food' && wantAge && p.res.food < 600) s += 1.5; if (s > bs) { bs = s; bestR = r; } }
      if (aiAssign(p, v, bestR, tc, home, mb, vils, a)) have[bestR]++;
    }
  } else if (vils.length > 8) {
    // reequilibrar: mover un aldeano del recurso más sobrante al más deficitario
    let need = null, nd = 1.5, extra = null, ed = 1.5;
    for (const r in mix) {
      const diff = mix[r] * total - have[r];
      if (diff > nd) { nd = diff; need = r; }
      if (-diff > ed) { ed = -diff; extra = r; }
    }
    if (need && extra) {
      const v = vils.find(x => x.order && x.order.type === 'gather' && x.order.res === extra && x.carry < 3 && x.order.st !== 'drop');
      if (v) aiAssign(p, v, need, tc, home, mb, vils, a);
    }
  }

  // 4. Edificios militares
  const prodWanted = [
    ['barracks', 0, 1, 10], ['archery', 1, 1, 14], ['stable', 2, 1, 18], ['barracks', 1, 2, 22], ['archery', 2, 2, 26], ['stable', 3, 2, 30],
  ];
  if (!wantAge || p.res.wood > 400) for (const [type, age, n, minVils] of prodWanted) {
    if (p.age >= age && cnt(type) < n && vils.length >= Math.min(minVils, d.vils - 2) && !mb.some(b => !b.done && BUILDINGS[b.type].trains && b.type !== 'tc')) {
      if (aiBuild(p, type, home.x, home.y, 6, 13, 1, 2, vils)) break;
    }
  }

  // 5. Subir de edad
  if (wantAge) for (const t of tcs) if (t.queue.length === 0 && !p.researching) { startResearch(t); break; }

  // 6. Producción militar
  const prods = mb.filter(b => b.done && b.type !== 'tc' && BUILDINGS[b.type].trains);
  const enemyCav = G.units.filter(u => u.owner !== p.id && UNITS[u.type].cls === 'cav').length;
  const rams = army.filter(u => u.type === 'ram').length;
  if (vils.length >= Math.min(10, d.vils - 3)) for (const b of prods) {
    if (b.queue.length >= 2) continue;
    let type;
    if (b.type === 'archery') type = 'archer';
    else if (b.type === 'stable') type = 'knight';
    else {
      const r = Math.random();
      if (p.age >= 3 && r < 0.4) type = 'champion';
      else if (p.age >= 2 && rams < 2 + a.wave && r < 0.3) type = 'ram';
      else if (enemyCav > 2 || r < 0.4) type = 'spearman';
      else type = 'swordsman';
    }
    if (afford2(UNITS[type].cost)) enqueue(b, type);
  }

  // 7. Ejército: defensa y ataque
  const threats = G.units.filter(u => u.owner !== p.id && !u.dead && Math.hypot(u.x - home.x, u.y - home.y) < 15 && UNITS[u.type].cls !== 'vil');
  const raiders = G.units.filter(u => u.owner !== p.id && !u.dead && Math.hypot(u.x - home.x, u.y - home.y) < 15);
  if (threats.length || raiders.length) {
    const t = (threats[0] || raiders[0]);
    a.defendT = 5;
    for (const u of army) if (!u.order || (u.order.type !== 'attack' && u.order.type !== 'amove')) setOrder(u, { type: 'amove', x: t.x, y: t.y, target: null });
  } else {
    a.defendT = Math.max(0, a.defendT - d.think);
    const idleArmy = army.filter(u => !u.order);
    const waveSize = Math.min(45, d.waveBase + a.wave * d.waveInc);
    if (!a.attacking) {
      if (G.t >= a.nextAttack && army.length >= waveSize && enemyBuildings.length) {
        a.attacking = true; a.wave++;
        const tgt = nearestTo(enemyBuildings, home);
        issueMove(army, tgt.x + tgt.w / 2, tgt.y + tgt.h / 2, true);
        notify('¡El enemigo lanza un ataque!', 'danger'); sfx('alert');
      } else {
        const en = enemyBuildings[0] ? center(enemyBuildings[0]) : home;
        const dx = en.x - home.x, dy = en.y - home.y, dd = Math.hypot(dx, dy) || 1;
        const sx = home.x + dx / dd * 8, sy = home.y + dy / dd * 8;
        const far = idleArmy.filter(u => Math.hypot(u.x - sx, u.y - sy) > 6);
        if (far.length) issueMove(far, sx, sy);
      }
    } else {
      if (army.length < Math.max(3, waveSize * 0.15) || !enemyBuildings.length) { a.attacking = false; a.nextAttack = G.t + 45; }
      else for (const u of idleArmy) {
        const tgt = nearestTo(enemyBuildings, u);
        issueMove([u], tgt.x + tgt.w / 2, tgt.y + tgt.h / 2, true);
      }
    }
  }
}
function nearestTo(list, pt) {
  let best = list[0], bd = 1e9;
  for (const b of list) { const d = Math.hypot(b.x + b.w / 2 - pt.x, b.y + b.h / 2 - pt.y); if (d < bd) { bd = d; best = b; } }
  return best;
}
function aiAssign(p, v, res, tc, home, mb, vils, a) {
  if (res === 'food') {
    const berry = findNode('food', home.x, home.y, p.id, 22);
    if (berry && berry.kind === 'node') {
      const c = { x: berry.x, y: berry.y };
      const dd = findDropoff(v, 'food');
      if (dd && Math.hypot(dd.x + dd.w / 2 - c.x, dd.y + dd.h / 2 - c.y) > 6 && !mb.some(b => b.type === 'mill') && aiBuildNear(p, 'mill', c, v)) return true;
      issueGather([v], berry); return true;
    }
    if (berry) { issueGather([v], berry); return true; }
    const farms = G.buildings.filter(b => b.owner === p.id && b.type === 'farm' && !b.dead).length;
    if (farms < a.d.farms && canAfford(p, BUILDINGS.farm.cost)) {
      const mill = mb.find(b => b.type === 'mill' && b.done), ref = mill ? center(mill) : home;
      const spot = findSpot('farm', ref.x, ref.y, 3, 9, 0);
      if (spot) { const b = placeBuilding(p.id, 'farm', spot.x, spot.y); issueBuild([v], b); return true; }
    }
    return aiAssign(p, v, 'wood', tc, home, mb, vils, a);
  }
  const n = findNode(res, home.x, home.y, p.id, 40);
  if (!n) return false;
  const dd = findDropoff(v, res);
  if (!dd || Math.hypot(dd.x + dd.w / 2 - n.x, dd.y + dd.h / 2 - n.y) > 7) {
    const type = res === 'wood' ? 'lumber' : 'mining';
    const pending = mb.some(b => b.type === type && !b.done && Math.hypot(b.x - n.x, b.y - n.y) < 9);
    if (pending) { const b = mb.find(b => b.type === type && !b.done); setOrder(v, { type: 'build', b }); return true; }
    if (aiBuildNear(p, type, n, v)) return true;
  }
  issueGather([v], n); return true;
}
function aiBuildNear(p, type, pt, v) {
  if (!canAfford(p, BUILDINGS[type].cost)) return false;
  const spot = findSpot(type, pt.x + .5, pt.y + .5, 1.5, 4, 0); if (!spot) return false;
  const b = placeBuilding(p.id, type, spot.x, spot.y);
  issueBuild([v], b); return true;
}
