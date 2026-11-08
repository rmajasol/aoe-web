'use strict';
/* ============ Interfaz y controles ============ */
const $ = id => document.getElementById(id);
let sel = [], selSet = new Set(), buildType = null, amoveMode = false, dragBox = null;
const mouse = { x: 0, y: 0, inCanvas: false };
const groups = {}, keys = {};
let lastClick = { t: 0, type: null }, idleIdx = 0, lastGroupKey = { k: null, t: 0 };

function setSel(list) {
  sel = list.filter(alive).slice(0, 80); selSet = new Set(sel.map(e => e.id));
  curSig = null; infoSig = null;
}

/* ---------- Sonido ---------- */
// Síntesis WebAudio sin archivos: ruido filtrado (impactos, roces) + tonos con barrido (cuerpo del golpe).
let AC = null, MG = null, NB = null;
function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const c = AC.createDynamicsCompressor(); MG = AC.createGain(); MG.gain.value = .3; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800; lp.Q.value = .5; MG.connect(lp); lp.connect(c); c.connect(AC.destination);
    NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AC.state === 'suspended') AC.resume();
}
function env(g, t, dur, vol) { g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .003); g.gain.exponentialRampToValueAtTime(.0005, t + dur); }
function nz(o, t, dur, vol, type, f, q, f2) { // ráfaga de ruido filtrado (f→f2 = barrido del filtro)
  const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = NB; s.loop = true; fl.type = type; fl.Q.value = q || 1; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, dur, vol); s.connect(fl); fl.connect(g); g.connect(o); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
}
function tn(o, t, dur, vol, type, f, f2, lp) { // tono con barrido de frecuencia (f→f2) y filtro paso-bajo opcional
  const s = AC.createOscillator(), g = AC.createGain(); s.type = type; s.frequency.setValueAtTime(f, t); if (f2) s.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, dur, vol); let n = s; if (lp) { const fl = AC.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; s.connect(fl); n = fl; }
  n.connect(g); g.connect(o); s.start(t); s.stop(t + dur + .02);
}
// r = variación aleatoria de tono (~0.92–1.08) para que dos golpes seguidos nunca suenen idénticos
const SND = {
  chop(o, t, r) { // hacha que muerde el tronco: filo + fibras de madera al partirse + golpe sordo (sin tonos puros, que suenan a taco)
    nz(o, t, .12, .6, 'lowpass', 2200 * r, .7, 450); nz(o, t + .01, .2, .3, 'bandpass', 650 * r, .6, 400); nz(o, t, .03, .2, 'bandpass', 2200, 1); tn(o, t, .13, .35, 'sine', 115 * r, 55);
  },
  mine(o, t, r) { // pico en roca: chasquido + tintineo metálico + golpe sordo
    nz(o, t, .05, .4, 'bandpass', 1800, .8); tn(o, t, .08, .6, 'sine', 150 * r, 65); tn(o, t, .1, .06, 'sine', 1180 * r);
  },
  mineGold(o, t, r) { // pico en veta de oro: más resonante y brillante
    nz(o, t, .04, .3, 'bandpass', 1800, .8); tn(o, t, .07, .5, 'sine', 170 * r, 80); tn(o, t, .2, .1, 'sine', 1300 * r); tn(o, t, .25, .06, 'sine', 1950 * r);
  },
  berry(o, t, r) { // roce de hojas al arrancar bayas
    nz(o, t, .18, .3, 'bandpass', 1500 * r, .6, 2200); nz(o, t + .09, .12, .2, 'bandpass', 1800 * r, .6, 1100);
  },
  farm(o, t, r) { // azada/hoz: silbido + golpe blando en tierra
    nz(o, t, .15, .2, 'bandpass', 800 * r, .6, 1600); nz(o, t + .13, .1, .4, 'lowpass', 700, .7); tn(o, t + .13, .09, .35, 'sine', 110 * r, 60);
  },
  butcher(o, t, r) { // cuchillo en carne: tajo + golpe húmedo
    nz(o, t, .05, .22, 'bandpass', 2200 * r, 1.5); nz(o, t + .02, .12, .5, 'lowpass', 520 * r, .8); tn(o, t + .02, .13, .5, 'sine', 125 * r, 55);
  },
  hammer(o, t, r) { // martillo sobre clavo/madera: golpe + tintineo corto
    nz(o, t, .04, .35, 'bandpass', 1300 * r, .9); tn(o, t, .1, .6, 'sine', 240 * r, 140); tn(o, t, .05, .25, 'triangle', 480 * r, 300);
  },
  timber(o, t, r) { // árbol que cae: crujido, follaje y golpe contra el suelo
    nz(o, t, .35, .35, 'bandpass', 1400, 1.6, 400); nz(o, t + .05, .5, .2, 'bandpass', 1800, .6, 900); nz(o, t + .55, .35, .6, 'lowpass', 400, .7); tn(o, t + .55, .4, .8, 'sine', 90 * r, 35);
  },
  dropw(o, t, r) { // troncos sobre la pila
    tn(o, t, .15, .5, 'sine', 150 * r, 70); nz(o, t, .09, .35, 'bandpass', 600 * r, 1); tn(o, t + .08, .1, .3, 'triangle', 300 * r, 180); nz(o, t + .08, .05, .15, 'bandpass', 900, .8);
  },
  dropf(o, t, r) { // saco/cesta de comida
    nz(o, t, .2, .8, 'lowpass', 900 * r, .7, 450); tn(o, t, .12, .5, 'sine', 95 * r, 60);
  },
  dropg(o, t, r) { // monedas/lingotes tintineando
    for (let i = 0; i < 3; i++) { const d = i * .06, f = (1500 + i * 350) * r; tn(o, t + d, .14, .2, 'sine', f); tn(o, t + d, .08, .06, 'sine', f * 1.5); }
  },
  drops(o, t, r) { // piedras al montón
    nz(o, t, .1, .5, 'bandpass', 1500 * r, 1); tn(o, t, .1, .5, 'sine', 130 * r, 60); nz(o, t + .07, .07, .25, 'bandpass', 1200 * r, .8);
  },
  sword(o, t, r) { // choque de acero: golpe + resonancia metálica
    nz(o, t, .06, .4, 'bandpass', 1500 * r, 1); tn(o, t, .1, .5, 'sine', 200 * r, 100); tn(o, t, .14, .07, 'sine', 900 * r);
  },
  bash(o, t, r) { // golpe contundente contra un edificio (ariete, mazazo)
    tn(o, t, .3, .85, 'sine', 95 * r, 38); nz(o, t, .22, .55, 'lowpass', 750, .7, 200); nz(o, t, .05, .2, 'bandpass', 1000, .8);
  },
  bow(o, t, r) { // cuerda del arco + silbido de la flecha
    tn(o, t, .12, .45, 'triangle', 330 * r, 150); nz(o, t, .09, .25, 'bandpass', 1400, .8); nz(o, t + .03, .2, .1, 'bandpass', 1000, .8, 1800);
  },
  arrowhit(o, t, r) { // flecha clavándose
    nz(o, t, .05, .7, 'bandpass', 1300 * r, 1.2); tn(o, t, .07, .7, 'sine', 270 * r, 110);
  },
  die(o, t, r) { // quejido breve
    tn(o, t, .28, .4, 'sawtooth', 200 * r, 100, 500); nz(o, t, .2, .18, 'bandpass', 700, 1.5);
  },
  crash(o, t, r) { // edificio que se derrumba: estruendo grave + escombros
    nz(o, t, .9, .8, 'lowpass', 700, .7, 120); tn(o, t, .8, .9, 'sine', 75 * r, 28);
    for (let i = 0; i < 5; i++) { nz(o, t + .1 + i * .11 + Math.random() * .06, .12, .3, 'bandpass', 600 + Math.random() * 1500, 1); tn(o, t + .1 + i * .11, .1, .25, 'sine', 120 + Math.random() * 60, 60); }
  },
};
const sfxGap = { chop: 140, mine: 140, mineGold: 140, berry: 180, farm: 180, butcher: 160, hammer: 140, sword: 55, bash: 110, bow: 45, arrowhit: 45, die: 90, dropw: 120, dropf: 120, dropg: 120, drops: 120, timber: 200, crash: 250 };
const sfxLast = {};
function sfxAt(kind, x, y) { // sonidos de mundo: solo si se ven en pantalla; límite por tipo; volumen y paneo según la posición en pantalla
  const t = performance.now(); if (t - (sfxLast[kind] || 0) < (sfxGap[kind] || 70) || !visibleAt(x, y)) return;
  const p = t2s(x, y); if (p.x < 0 || p.x > VW || p.y < 0 || p.y > VH) return; sfxLast[kind] = t;
  const dx = p.x / VW - .5, dy = p.y / VH - .5;
  sfx(kind, Math.max(-.8, Math.min(.8, dx * 1.6)), Math.max(.25, .8 - Math.hypot(dx, dy) * .8));
}
function sfx(kind, pan, vol) {
  try {
    audio(); const f = SND[kind];
    if (f) {
      const g = AC.createGain(); g.gain.value = vol == null ? 1 : vol;
      if (AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = pan || 0; g.connect(p); p.connect(MG); } else g.connect(MG);
      f(g, AC.currentTime + .005, .92 + Math.random() * .16); return;
    }
    const notes = { train: [[660, .08], [880, .12]], build: [[440, .08], [550, .08], [660, .12]], alert: [[220, .15], [180, .2]], age: [[440, .1], [550, .1], [660, .1], [880, .25]] }[kind] || []; // avisos de interfaz
    let t = AC.currentTime;
    for (const [fr, d] of notes) {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = kind === 'alert' ? 'sawtooth' : 'triangle'; o.frequency.value = fr; g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g); g.connect(MG); o.start(t); o.stop(t + d); t += d;
    }
  } catch (e) { }
}
function notify(msg, kind) {
  const box = $('alert'), d = document.createElement('div');
  d.className = 'msg ' + (kind || ''); d.textContent = msg; box.appendChild(d);
  while (box.children.length > 5) box.removeChild(box.firstChild);
  setTimeout(() => d.classList.add('out'), 4500); setTimeout(() => d.remove(), 5000);
}
function showEnd(victory) {
  $('end').classList.remove('hidden');
  $('end-title').textContent = victory ? '¡VICTORIA!' : 'DERROTA';
  $('end-title').className = victory ? 'win' : 'lose';
  $('end-sub').textContent = (victory ? 'Has destruido todos los edificios enemigos' : 'Has perdido todos tus edificios') + ' en ' + fmtTime(G.t) + '.';
}
const fmtTime = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

/* ---------- Selección ---------- */
function unitScr(u) { return { x: (isoX(u.x, u.y) - cam.x) * cam.zoom, y: (isoY(u.x, u.y) - cam.y) * cam.zoom - 15 * cam.zoom }; }
function bldScr(b) { return { x: (isoX(b.x + b.w / 2, b.y + b.h / 2) - cam.x) * cam.zoom, y: (isoY(b.x + b.w / 2, b.y + b.h / 2) - cam.y) * cam.zoom }; }
function inDiamond(px, py, cx, cy, hw, hh) { return Math.abs(px - cx) / hw + Math.abs(py - cy) / hh <= 1; }
function buildingHit(b, wx, wy) {
  const [H, RH] = BH[b.type], top = b.type === 'tower' ? 66 : H + RH * .6, cx = isoX(b.x + b.w / 2, b.y + b.h / 2), cy = isoY(b.x + b.w / 2, b.y + b.h / 2);
  for (let k = 0; k <= 4; k++) if (inDiamond(wx, wy, cx, cy - top * k / 4, b.w * TILE, b.w * TILE / 2)) return true;
  return false;
}
// Selección por coordenadas de pantalla (vista isométrica)
function pick(sx, sy) {
  const wx = sx / cam.zoom + cam.x, wy = sy / cam.zoom + cam.y;
  let best = null, bd = 1e9;
  for (const u of G.units) {
    if (u.dead || (u.owner !== 0 && !visibleAt(u.x, u.y))) continue;
    const ux = isoX(u.x, u.y), uy = isoY(u.x, u.y), h = UNIT_H[u.type], big = u.type === 'knight' || u.type === 'ram' ? 1.4 : 1;
    if (Math.abs(wx - ux) <= 13 * big && wy >= uy - h && wy <= uy + 7) { const d = Math.hypot(wx - ux, wy - (uy - h * .45)); if (d < bd) { bd = d; best = u; } }
  }
  if (best) return best;
  for (const a of G.animals) {
    if (a.dead || !visibleAt(a.x, a.y)) continue;
    const ax = isoX(a.x, a.y), ay = isoY(a.x, a.y);
    if (Math.abs(wx - ax) <= 20 && wy >= ay - 34 && wy <= ay + 8) { const d = Math.hypot(wx - ax, wy - (ay - 14)); if (d < bd) { bd = d; best = a; } }
  }
  if (best) return best;
  let bdp = -1e9;
  for (const b of G.buildings) {
    if (b.dead || !buildingHit(b, wx, wy)) continue;
    if (b.owner !== 0 && G.vis[Math.min(MAP_H - 1, Math.floor(b.y + b.h / 2)) * MAP_W + Math.floor(b.x + b.w / 2)] === 0) continue;
    const d = b.x + b.y + b.w; if (d > bdp) { bdp = d; best = b; }
  }
  if (best) return best;
  for (const n of G.nodes) {
    if (n.dead || G.vis[n.y * MAP_W + n.x] === 0) continue;
    const nx = isoX(n.x + .5, n.y + .5), ny = isoY(n.x + .5, n.y + .5), hh = n.type === 'tree' ? 52 : 22;
    if (Math.abs(wx - nx) <= (n.type === 'tree' ? 15 : 17) && wy >= ny - hh && wy <= ny + 8) { const d = n.x + n.y; if (d > bdp) { bdp = d; best = n; } }
  }
  return best;
}
function selectOnScreenSame(type) {
  return G.units.filter(u => { if (u.dead || u.owner !== 0 || u.type !== type) return false; const p = unitScr(u); return p.x >= 0 && p.x <= VW && p.y >= 0 && p.y <= VH; });
}
function mouseUp(e) {
  if (!dragBox) return;
  const db = dragBox; dragBox = null;
  const shift = e.shiftKey || e.ctrlKey || e.metaKey;
  if (Math.abs(db.x1 - db.x0) < 5 && Math.abs(db.y1 - db.y0) < 5) {
    const t = pick(db.x1, db.y1);
    if (!t) { if (!shift) setSel([]); return; }
    const now = performance.now();
    if (t.kind === 'unit' && t.owner === 0 && lastClick.type === t.type && now - lastClick.t < 400) { setSel(selectOnScreenSame(t.type)); lastClick = { t: 0, type: null }; return; }
    if (t.kind === 'building' && t.owner === 0 && lastClick.type === 'b:' + t.type && now - lastClick.t < 400) {
      setSel(G.buildings.filter(b => { if (b.dead || b.owner !== 0 || b.type !== t.type) return false; const p = bldScr(b); return p.x >= 0 && p.x <= VW && p.y >= 0 && p.y <= VH; })); lastClick = { t: 0, type: null }; return;
    }
    lastClick = { t: now, type: t.owner === 0 ? (t.kind === 'unit' ? t.type : t.kind === 'building' ? 'b:' + t.type : null) : null };
    if (shift && t.kind === 'building' && t.owner === 0 && sel.length && sel[0].kind === 'building' && sel[0].owner === 0) {
      setSel(selSet.has(t.id) ? sel.filter(s => s !== t) : sel.concat(t));
    } else
    if (shift && t.kind === 'unit' && t.owner === 0 && sel.length && sel[0].kind === 'unit' && sel[0].owner === 0) {
      setSel(selSet.has(t.id) ? sel.filter(s => s !== t) : sel.concat(t));
    } else setSel([t]);
  } else {
    const x0 = Math.min(db.x0, db.x1), x1 = Math.max(db.x0, db.x1), y0 = Math.min(db.y0, db.y1), y1 = Math.max(db.y0, db.y1);
    const found = G.units.filter(u => { if (u.dead || u.owner !== 0) return false; const p = unitScr(u); return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1; });
    if (found.length) setSel(shift && sel.length && sel[0].kind === 'unit' && sel[0].owner === 0 ? sel.concat(found.filter(f => !selSet.has(f.id))) : found);
    else {
      const bs = G.buildings.filter(b => { if (b.dead || b.owner !== 0) return false; const p = bldScr(b); return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1; });
      if (bs.length) setSel(shift && sel.length && sel[0].kind === 'building' && sel[0].owner === 0 ? sel.concat(bs.filter(f => !selSet.has(f.id))) : bs);
      else if (!shift) setSel([]);
    }
  }
}

/* ---------- Órdenes del jugador ---------- */
function ring(x, y, col) { G.fx.push({ type: 'ring', x, y, t: 0, dur: 0.6, col: col || '#5dff72' }); }
function contextCommand(sx, sy) {
  if (buildType) { buildType = null; return; }
  if (amoveMode) { amoveMode = false; return; }
  if (!sel.length || sel[0].owner !== 0) return;
  const tt = s2t(sx, sy), tx = tt.x, ty = tt.y, t = pick(sx, sy);
  if (sel[0].kind === 'building') {
    for (const b of sel) if (b.done && BUILDINGS[b.type].trains) b.rally = t && t.kind === 'node' ? { node: t } : { x: tx, y: ty };
    ring(tx, ty, '#ffffff'); return;
  }
  const units = sel.filter(e => e.kind === 'unit');
  if (t && t.kind === 'animal') { issueAttack(units, t); ring(t.x, t.y, '#ffb347'); }
  else if (t && t.owner === 1) { issueAttack(units, t); ring(tx, ty, '#ff5d5d'); }
  else if (t && t.kind === 'node') { issueGather(units, t); ring(t.x + .5, t.y + .5, '#ffe97a'); }
  else if (t && t.kind === 'building' && t.owner === 0 && t.type === 'farm' && t.done) { issueGather(units, t); ring(tx, ty, '#ffe97a'); }
  else if (t && t.kind === 'building' && t.owner === 0 && !t.done) { issueBuild(units, t); ring(tx, ty, '#7ad0ff'); }
  else { issueMove(units, tx, ty, false); ring(tx, ty); }
}
function minimapCommand(e, rightClick) {
  const r = mm.getBoundingClientRect(), k = MMK(), mx = (e.clientX - r.left) / r.width * mm.width, my = (e.clientY - r.top) / r.height * mm.height;
  const a = mx / k - MAP_H, b = my * 2 / k, tx = Math.max(0, Math.min(MAP_W, (a + b) / 2)), ty = Math.max(0, Math.min(MAP_H, (b - a) / 2));
  if (rightClick) {
    if (sel.length && sel[0].owner === 0 && sel[0].kind === 'unit') { issueMove(sel, tx, ty, amoveMode); amoveMode = false; ring(tx, ty); }
  } else centerCam(tx, ty);
}
function tryPlace(shift) {
  const D = BUILDINGS[buildType];
  if (!ghost || !ghost.ok) { notify('No se puede construir ahí.', 'warn'); return; }
  const p = G.players[0];
  if (!canAfford(p, D.cost)) { notify('Recursos insuficientes.', 'warn'); return; }
  const vs = sel.filter(u => u.type === 'villager');
  if (!vs.length) { buildType = null; return; }
  const b = placeBuilding(0, buildType, ghost.tx, ghost.ty);
  issueBuild(vs, b);
  if (!shift || !canAfford(p, D.cost)) buildType = null;
}
function deleteSel() {
  for (const e of sel) if (e.owner === 0 && !e.dead) { if (e.kind === 'building' && e.type === 'tc' && G.buildings.filter(b => b.owner === 0 && b.type === 'tc' && !b.dead).length === 1 && false) continue; killEntity(e); }
  setSel([]);
}

/* ---------- Panel de comandos ---------- */
const SLOT_KEYS = 'qwerasdfzxcv';
let curSig = null, infoSig = null, curCmds = [];
function getCommands() {
  const p = G.players[0], out = [];
  if (!sel.length || sel[0].owner !== 0) return out;
  const f = sel[0];
  if (f.kind === 'unit') {
    if (sel.some(u => u.type === 'villager')) {
      for (const t of ['house', 'farm', 'lumber', 'mill', 'mining', 'barracks', 'archery', 'stable', 'tower', 'tc']) {
        const D = BUILDINGS[t];
        out.push({
          id: 'b' + t, icon: D.icon, name: D.name, cost: D.cost, desc: D.desc + (D.age > p.age ? ' (Requiere ' + AGES[D.age] + ')' : ''), kind: 'build', t,
          ok: () => D.age > p.age ? 'Requiere ' + AGES[D.age] : !canAfford(p, D.cost) ? 'Recursos insuficientes' : '',
          run: () => { amoveMode = false; buildType = t; },
        });
      }
    } else out.push({ id: 'amove', icon: '⚔️', name: 'Atacar-mover', desc: 'Avanza atacando todo lo que encuentre.', run: () => { amoveMode = true; buildType = null; }, ok: () => '', toggle: () => amoveMode });
    out.push({ id: 'stop', icon: '✋', name: 'Detener', desc: 'Cancela la orden actual.', ok: () => '', run: () => sel.forEach(u => { if (u.kind === 'unit') { u.order = null; u.path = null; } }) });
    out.push({ id: 'del', icon: '🗑️', name: 'Eliminar', desc: 'Elimina las unidades seleccionadas.', ok: () => '', run: deleteSel });
  } else if (f.kind === 'building') {
    const D = BUILDINGS[f.type];
    const blds = sel.filter(b => b.kind === 'building' && b.owner === 0 && b.done);
    const multi = sel.length > 1;
    if (blds.length) {
      const types = [];
      for (const b of blds) for (const t of BUILDINGS[b.type].trains || []) if (!types.includes(t)) types.push(t);
      for (const t of types) {
        const U = UNITS[t], pop = U.pop || 1;
        const can = () => blds.filter(b => BUILDINGS[b.type].trains.includes(t));
        out.push({
          id: 't' + t, icon: U.icon, name: U.name, cost: U.cost, desc: U.desc + ' (' + U.time + 's)' + (U.age > p.age ? ' Requiere ' + AGES[U.age] : '') + (multi ? ' · Entrena una en cada edificio seleccionado que pueda.' : ''), kind: 'train',
          ok: () => U.age > p.age ? 'Requiere ' + AGES[U.age] : !canAfford(p, U.cost) ? 'Recursos insuficientes' : p.pop + pop > p.popCap ? 'Necesitas más casas' : can().every(b => b.queue.length >= 6) ? 'Cola llena' : '',
          run: () => {
            let n = 0;
            for (const b of can()) { if (b.queue.length >= 6 || p.pop + pop > p.popCap || !canAfford(p, U.cost)) continue; if (enqueue(b, t) !== false) n++; }
            if (multi && n && n < can().length) notify('Solo se pudieron entrenar ' + n + ' de ' + can().length + ' (recursos, población o cola).', 'warn');
          },
        });
      }
      const tc = blds.find(b => b.type === 'tc');
      if (tc && p.age < 3) {
        const c = AGE_COST[p.age + 1];
        out.push({ id: 'age', icon: '👑', name: 'Avanzar a ' + AGES[p.age + 1], cost: c, desc: 'Desbloquea nuevas unidades y edificios, y mejora tus unidades.', ok: () => p.researching ? 'Ya investigando' : !canAfford(p, c) ? 'Recursos insuficientes' : '', run: () => startResearch(tc) });
      }
    }
    out.push({ id: 'del', icon: '🗑️', name: f.done ? 'Derribar' : 'Cancelar', desc: 'Destruye el edificio.', ok: () => '', run: deleteSel });
  }
  return out;
}
function refreshCmds() {
  const p = G.players[0];
  const sig = sel.map(e => e.id + (e.kind === 'building' ? (e.done ? 'd' : 'u') : '')).join(',') + '|' + p.age;
  const box = $('cmds');
  if (sig !== curSig) {
    curSig = sig; curCmds = getCommands(); box.innerHTML = '';
    curCmds.forEach((c, i) => {
      c.key = SLOT_KEYS[i];
      const b = document.createElement('button');
      b.className = 'cmd'; b.innerHTML = `<span class="ic">${c.icon}</span><i>${c.key.toUpperCase()}</i>`;
      b.onclick = () => { const r = c.ok(); if (r) { notify(r, 'warn'); return; } c.run(); refreshInfo(true); };
      b.onmouseenter = () => showTip(b, c);
      b.onmouseleave = hideTip;
      c.el = b; box.appendChild(b);
    });
  }
  for (const c of curCmds) {
    const bad = c.ok();
    c.el.classList.toggle('off', !!bad);
    c.el.classList.toggle('on', !!((c.kind === 'build' && buildType === c.t) || (c.toggle && c.toggle())));
  }
}
function showTip(el, c) {
  const t = $('tip'), r = el.getBoundingClientRect();
  const bad = c.ok();
  t.innerHTML = `<b>${c.name}</b> <span class="k">[${c.key.toUpperCase()}]</span><br>${c.cost ? '<span class="cost">' + costStr(c.cost) + '</span><br>' : ''}${c.desc || ''}${bad ? '<br><span class="bad">' + bad + '</span>' : ''}`;
  t.style.display = 'block'; t.style.left = Math.max(4, Math.min(innerWidth - 260, r.left - 100)) + 'px'; t.style.top = (r.top - t.offsetHeight - 6) + 'px';
}
function hideTip() { $('tip').style.display = 'none'; }

/* ---------- Panel de información ---------- */
function refreshInfo(force) {
  const box = $('info');
  const sig = sel.map(e => e.id + (e.kind === 'building' ? (e.done ? 'd' : 'u') + e.queue.map(q => q.type).join('.') + (e.research ? 'r' : '') : '')).join(',');
  if (sig !== infoSig || force) {
    infoSig = sig;
    if (!sel.length) { box.innerHTML = '<div class="hint">Selecciona unidades o edificios.<br><small>Clic izq: seleccionar · Clic der: mover/atacar/recolectar</small></div>'; return; }
    if (sel.length === 1) {
      const e = sel[0];
      let h = '';
      if (e.kind === 'unit') {
        const D = UNITS[e.type];
        h = `<div class="portrait" style="border-color:${PCOL[e.owner]}">${D.icon}</div><div class="det"><h3>${D.name}</h3>
          <div id="i-hp">❤️</div><div class="st">⚔️ ${D.atk}${D.range ? ' · 🎯 ' + D.range : ''} · 🛡️ ${D.mArm}/${D.pArm} · 👁️ ${D.sight}</div>
          ${e.type === 'villager' ? '<div id="i-carry"></div>' : ''}</div>`;
      } else if (e.kind === 'building') {
        const D = BUILDINGS[e.type];
        h = `<div class="portrait" style="border-color:${PCOL[e.owner]}">${D.icon}</div><div class="det"><h3>${D.name}</h3><div id="i-hp">❤️</div>
          ${e.done ? '' : '<div class="bar"><div id="i-prog"></div></div><div class="st">En construcción</div>'}
          ${e.type === 'farm' ? '<div id="i-food"></div>' : ''}
          ${e.owner === 0 && e.done ? '<div class="queue" id="i-queue"></div><div class="bar"><div id="i-qp"></div></div>' : ''}</div>`;
      } else {
        const D = e.kind === 'animal' ? ANIMALS[e.type] : NODE[e.type];
        if (e.kind === 'animal') h = `<div class="portrait">${D.icon}</div><div class="det"><h3>${D.name}</h3><div id="i-hp">❤️</div><div class="st">🍖 ${D.food} de comida${D.fights ? ' · ⚠️ ataca si lo hieres' : D.skittish ? ' · huye rápido' : ''}</div></div>`;
        else h = `<div class="portrait">${D.icon}</div><div class="det"><h3>${D.name}</h3><div id="i-hp">${RES_ICON[e.res]} ${RES_NAME[e.res]}: ${Math.ceil(e.amount)}</div></div>`;
      }
      box.innerHTML = h;
      const q = $('i-queue');
      if (q) e.queue.forEach((it, i) => {
        const d = document.createElement('div'); d.className = 'qi'; d.textContent = UNITS[it.type].icon; d.title = 'Cancelar (clic)';
        d.onclick = () => { cancelQueue(e, i); infoSig = null; }; q.appendChild(d);
      });
    } else {
      const counts = {}; sel.forEach(e => { const k = e.kind === 'unit' ? e.type : e.type; (counts[k] = counts[k] || []).push(e); });
      box.innerHTML = '<div class="multi"></div>';
      const m = box.firstChild;
      for (const k in counts) {
        const D = UNITS[k] || BUILDINGS[k] || NODE[k], b = document.createElement('button');
        b.className = 'grp'; b.title = D.name; b.innerHTML = `<span>${D.icon}</span><b>${counts[k].length}</b>`;
        b.onclick = () => setSel(counts[k]); m.appendChild(b);
      }
    }
  }
  // actualizaciones dinámicas
  if (sel.length === 1) {
    const e = sel[0];
    if (e.dead) return;
    const hp = $('i-hp');
    if (hp) {
      if (e.kind === 'node') hp.textContent = RES_ICON[e.res] + ' ' + RES_NAME[e.res] + ': ' + Math.ceil(e.amount);
      else hp.textContent = '❤️ ' + Math.ceil(e.hp) + ' / ' + Math.ceil(e.maxhp);
    }
    const cr = $('i-carry'); if (cr) cr.textContent = e.carry > 0.5 ? 'Lleva: ' + RES_ICON[e.ctype] + ' ' + Math.floor(e.carry) : '';
    const pr = $('i-prog'); if (pr) pr.style.width = (e.progress * 100) + '%';
    const fd = $('i-food'); if (fd) fd.textContent = '🍖 ' + Math.ceil(e.food);
    const qp = $('i-qp');
    if (qp) {
      if (e.research) qp.style.width = (e.research.t / e.research.total * 100) + '%';
      else if (e.queue.length) qp.style.width = (e.qt / UNITS[e.queue[0].type].time * 100) + '%'; else qp.style.width = '0';
      qp.style.background = e.research ? '#e8c53a' : '';
    }
  }
}
function updateTop() {
  const p = G.players[0];
  for (const k of ['food', 'wood', 'gold', 'stone']) {
    const v = Math.floor(p.res[k]), el = $('r-' + k), prev = +el.textContent;
    if (v !== prev) {
      el.textContent = v; const box = el.parentElement, cls = v > prev ? 'up' : 'down';
      if (Math.abs(v - prev) >= 5) { box.classList.remove('up', 'down'); void box.offsetWidth; box.classList.add(cls); }
    }
  }
  const pop = $('r-pop'); pop.textContent = p.pop + '/' + p.popCap; pop.parentElement.classList.toggle('warn', p.pop >= p.popCap);
  $('age').textContent = AGES[p.age] + (p.researching ? ' ⏳' : '');
  $('clock').textContent = fmtTime(G.t); $('btn-speed').textContent = '⏩ x' + G.speed;
}

/* ---------- Entrada ---------- */
function initInput() {
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('mousedown', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (e.button === 0) {
      if (buildType) { tryPlace(e.shiftKey); return; }
      if (amoveMode) {
        const w = s2t(e.clientX, e.clientY);
        if (sel.length && sel[0].owner === 0) { issueMove(sel.filter(x => x.kind === 'unit'), w.x, w.y, true); ring(w.x, w.y, '#ff5d5d'); }
        amoveMode = false; return;
      }
      dragBox = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
    } else if (e.button === 2) contextCommand(e.clientX, e.clientY);
    else if (e.button === 1) { panning = { x: e.clientX, y: e.clientY }; e.preventDefault(); }
  });
  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.inCanvas = e.target === cv;
    if (dragBox) { dragBox.x1 = e.clientX; dragBox.y1 = e.clientY; }
    if (panning) { cam.x -= (e.clientX - panning.x) / cam.zoom; cam.y -= (e.clientY - panning.y) / cam.zoom; panning = { x: e.clientX, y: e.clientY }; clampCam(); }
    if (mmDrag) minimapCommand(e, false);
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) { mouseUp(e); mmDrag = false; } if (e.button === 1) panning = null; });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const before = s2w(e.clientX, e.clientY);
    cam.zoom *= e.deltaY < 0 ? 1.1 : 0.9; cam.zoom = Math.max(0.5, Math.min(1.8, cam.zoom));
    cam.x = before.x - e.clientX / cam.zoom; cam.y = before.y - e.clientY / cam.zoom; clampCam();
  }, { passive: false });
  mm.addEventListener('mousedown', e => { e.preventDefault(); if (e.button === 0) { mmDrag = true; minimapCommand(e, false); } else if (e.button === 2) minimapCommand(e, true); });
  mm.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('keydown', e => {
    if (!gameRunning) return;
    keys[e.key.toLowerCase()] = true;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (k === 'escape') { buildType = null; amoveMode = false; return; }
    if (k === 'delete') { deleteSel(); return; }
    if (k === 'p') { G.paused = !G.paused; LOG.event(G.paused ? 'pausa' : 'reanudar'); notify(G.paused ? 'Pausa' : 'Reanudado'); return; }
    if (k === '+' || k === '=') { G.speed = Math.min(4, G.speed + 1); return; }
    if (k === '-') { G.speed = Math.max(1, G.speed - 1); return; }
    if (k === 'h') { const tc = G.buildings.find(b => b.owner === 0 && b.type === 'tc' && !b.dead); if (tc) centerCam(tc.x + 2, tc.y + 2); return; }
    if (k === '.' || k === ',') { const v = G.units.filter(u => u.owner === 0 && u.type === 'villager' && !u.order && !u.dead); if (v.length) { const u = v[idleIdx++ % v.length]; setSel([u]); centerCam(u.x, u.y); } else notify('No hay aldeanos inactivos.'); return; }
    if (/^[0-9]$/.test(k)) {
      if (e.ctrlKey) { groups[k] = sel.slice(); notify('Grupo ' + k + ' asignado'); e.preventDefault(); }
      else if (groups[k]) {
        const g = groups[k].filter(alive); setSel(g);
        const now = performance.now(); if (g.length && lastGroupKey.k === k && now - lastGroupKey.t < 400) { const c = center(g[0]); centerCam(c.x, c.y); }
        lastGroupKey = { k, t: now };
      }
      return;
    }
    if (e.ctrlKey || e.altKey) return;
    const idx = SLOT_KEYS.indexOf(k);
    if (idx >= 0 && curCmds[idx]) { const c = curCmds[idx], r = c.ok(); if (r) notify(r, 'warn'); else { c.run(); refreshInfo(true); } }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  $('btn-speed').onclick = () => { G.speed = G.speed >= 3 ? 1 : G.speed + 1; };
  $('btn-pause').onclick = () => { G.paused = !G.paused; };
  window.addEventListener('resize', resize);
}
let panning = null, mmDrag = false;

function updateCamera(dt) {
  if (!gameRunning) return;
  let dx = 0, dy = 0;
  if (keys['arrowleft']) dx -= 1; if (keys['arrowright']) dx += 1; if (keys['arrowup']) dy -= 1; if (keys['arrowdown']) dy += 1;
  if (mouse.inCanvas && !panning && !dragBox) {
    if (mouse.x < 6) dx -= 1; if (mouse.x > VW - 6) dx += 1; if (mouse.y < 6) dy -= 1; if (mouse.y > VH - 6) dy += 1;
  }
  if (dx || dy) { const s = 850 / cam.zoom * dt; cam.x += dx * s; cam.y += dy * s; clampCam(); }
  cv.style.cursor = buildType ? 'copy' : amoveMode ? 'crosshair' : 'default';
}
