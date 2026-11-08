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
let AC = null;
let lastSfx = 0;
function sfxAt(kind, x, y) { // sonidos de trabajo: solo si se ven en pantalla y con límite de frecuencia
  const t = performance.now(); if (t - lastSfx < 70 || !visibleAt(x, y)) return; const p = t2s(x, y); if (p.x < 0 || p.x > VW || p.y < 0 || p.y > VH) return; lastSfx = t; sfx(kind);
}
function sfx(kind) {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const notes = { chop: [[110, .045]], mine: [[1300, .03], [900, .04]], hammer: [[170, .04], [120, .04]], train: [[660, .08], [880, .12]], build: [[440, .08], [550, .08], [660, .12]], alert: [[220, .15], [180, .2]], age: [[440, .1], [550, .1], [660, .1], [880, .25]] }[kind] || [];
    let t = AC.currentTime;
    for (const [f, d] of notes) {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = kind === 'alert' ? 'sawtooth' : 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d); t += d;
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
    if (k === 'p') { G.paused = !G.paused; notify(G.paused ? 'Pausa' : 'Reanudado'); return; }
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
