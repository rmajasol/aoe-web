'use strict';
/* ============ Renderizado ============ */
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const mm = document.getElementById('minimap'), mctx = mm.getContext('2d');
const cam = { x: 0, y: 0, zoom: 1 };
let VW = innerWidth, VH = innerHeight, DPR = 1;
const BOTTOM_H = 180;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  VW = innerWidth; VH = innerHeight;
  cv.width = VW * DPR; cv.height = VH * DPR; cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  clampCam();
}
function clampCam() {
  cam.zoom = Math.max(0.5, Math.min(1.8, cam.zoom));
  const mw = MAP_W * TILE, mh = MAP_H * TILE, vw = VW / cam.zoom, vh = (VH - BOTTOM_H + 20) / cam.zoom;
  cam.x = vw >= mw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, cam.x));
  cam.y = vh >= mh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, cam.y));
}
const s2w = (sx, sy) => ({ x: sx / cam.zoom + cam.x, y: sy / cam.zoom + cam.y });
function centerCam(tx, ty) {
  cam.x = tx * TILE - VW / cam.zoom / 2; cam.y = ty * TILE - (VH - BOTTOM_H) / cam.zoom / 2; clampCam();
}

/* ---------- Utilidades de color ---------- */
function shade(hex, a) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (a >= 0) { r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a; } else { r *= 1 + a; g *= 1 + a; b *= 1 + a; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function mkCanvas(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d')); return c; }
function blob(g, x, y, r, c0, c1) {
  const gr = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
  gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
}
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/* ---------- Sprites pre-renderizados ---------- */
const SPR = {};
function buildSprites() {
  const R = mulberry32(777);
  SPR.tree = [0, 1, 2, 3].map(v => mkCanvas(50, 64, g => {
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(25, 57, 16, 5.5, 0, 0, 7); g.fill();
    const tg = g.createLinearGradient(21, 0, 30, 0); tg.addColorStop(0, '#6b4524'); tg.addColorStop(1, '#3d2411');
    g.fillStyle = tg; g.fillRect(21, 38, 8, 19);
    if (v < 2) { // frondoso
      const dk = v ? '#12401a' : '#14461c', md = v ? '#2a7a30' : '#2f8434';
      blob(g, 25, 36, 14, md, dk); blob(g, 15, 29, 11, '#3f9a3e', dk); blob(g, 35, 29, 11, '#378c38', dk);
      blob(g, 25, 21, 14, '#58b24a', '#1d5a24'); blob(g, 19, 15, 8, '#7ccb5a', '#2f8434');
      for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${150 + R() * 80 | 0},${200 + R() * 55 | 0},90,.35)`; g.beginPath(); g.arc(8 + R() * 34, 8 + R() * 36, 1.4, 0, 7); g.fill(); }
    } else { // pino
      const tri = (cx, top, bot, hw, c0, c1) => { const gr = g.createLinearGradient(cx - hw, 0, cx + hw, 0); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.beginPath(); g.moveTo(cx, top); g.lineTo(cx + hw, bot); g.lineTo(cx - hw, bot); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke(); };
      tri(25, 30, 52, 17, '#2f7a3a', '#0f3a1c'); tri(25, 18, 42, 14, '#3a8c45', '#145026'); tri(25, 4, 30, 11, '#4ba055', '#1a5a2c');
    }
  }));
  SPR.berry = mkCanvas(36, 36, g => {
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(18, 29, 13, 5, 0, 0, 7); g.fill();
    blob(g, 18, 20, 12, '#4aa04a', '#1d5524'); blob(g, 12, 17, 8, '#5cb85c', '#256b2b'); blob(g, 24, 18, 8, '#4aa04a', '#1d5524');
    [[10, 14], [18, 12], [23, 19], [14, 23], [18, 18], [8, 21], [26, 24], [21, 25]].forEach(p => { blob(g, p[0], p[1], 2.8, '#ff6a80', '#a01028'); });
  });
  const rock = (base, hi, gold) => mkCanvas(36, 36, g => {
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(18, 30, 14, 5, 0, 0, 7); g.fill();
    const facets = [[[3, 28], [6, 13], [17, 6], [18, 24]], [[17, 6], [29, 10], [33, 28], [18, 24]], [[3, 28], [18, 24], [33, 28], [18, 32]]];
    const cols = [shade(base, .18), shade(base, -.05), shade(base, -.35)];
    facets.forEach((f, i) => { g.fillStyle = cols[i]; g.beginPath(); g.moveTo(...f[0]); for (let k = 1; k < f.length; k++) g.lineTo(...f[k]); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.stroke(); });
    g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(8, 14); g.lineTo(17, 8); g.lineTo(17, 14); g.closePath(); g.fill();
    if (gold) [[13, 20], [22, 16], [26, 24], [17, 12], [10, 26]].forEach(p => { blob(g, p[0], p[1], 3.6, '#fff2a0', '#d89a10'); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(p[0] - 1.5, p[1] - 2, 1.5, 1.5); });
  });
  SPR.gold = rock('#6f6a62', 0, true); SPR.stone = rock('#7d8288', 0, false);
}

/* ---------- Terreno (generado por píxel) ---------- */
let terrainCanvas = null, fogCanvas = null, fogCtx = null, fogImg = null, fogBig = null, fogBigCtx = null, mmTerrain = null, waterTiles = [];
function buildTerrain() {
  const T = G.terrain, MW = MAP_W, MH = MAP_H, S = 2, PW = MW * TILE / S, PH = MH * TILE / S;
  const mk = (tx, ty) => (tx < 0 || ty < 0 || tx >= MW || ty >= MH) ? 0 : T[ty * MW + tx];
  const wmask = (x, y) => {
    const fx = x - 0.5, fy = y - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
    return mk(x0, y0) * (1 - u) * (1 - v) + mk(x0 + 1, y0) * u * (1 - v) + mk(x0, y0 + 1) * (1 - u) * v + mk(x0 + 1, y0 + 1) * u * v;
  };
  const small = document.createElement('canvas'); small.width = PW; small.height = PH;
  const sctx = small.getContext('2d'), img = sctx.createImageData(PW, PH), d = img.data;
  for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
    const tx = px * S / TILE, ty = py * S / TILE;
    const n1 = vn(tx * 0.13, ty * 0.13), n2 = vn(tx * 1.4, ty * 1.4), n3 = vn(tx * 0.5 + 40, ty * 0.5 + 40);
    let r = 58 + n1 * 28 + n2 * 9 + n3 * 8, g = 102 + n1 * 30 + n2 * 11 + n3 * 8, b = 38 + n1 * 12 + n2 * 4;
    const wm = wmask(tx, ty);
    if (wm > 0) {
      const w = wm + (vn(tx * 3.1, ty * 3.1) - 0.5) * 0.32;
      if (w > 0.5) {
        const dp = Math.min(1, (w - 0.5) * 2.6), rip = vn(tx * 2.6 + 9, ty * 2.6) * 14;
        r = 62 - 38 * dp + rip * .4; g = 150 - 55 * dp + rip; b = 190 - 28 * dp + rip;
        if (w < 0.57) { const f = (0.57 - w) / 0.07 * 0.75; r += (235 - r) * f; g += (245 - g) * f; b += (250 - b) * f; }
      } else if (w > 0.28) {
        const t = Math.min(1, (w - 0.28) / 0.2 * 1.3), wet = w > 0.42 ? 0.86 : 1;
        r += (214 * wet - r) * t; g += (194 * wet - g) * t; b += (132 * wet - b) * t;
      }
    }
    const i = (py * PW + px) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  const R = mulberry32(4242);
  terrainCanvas = mkCanvas(MW * TILE, MH * TILE, g => {
    g.imageSmoothingEnabled = true; g.drawImage(small, 0, 0, MW * TILE, MH * TILE);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (T[y * MW + x] === 1 || wmask(x + .5, y + .5) > 0.05) continue;
      const px = x * TILE, py = y * TILE;
      const n = Math.floor(2 + R() * 3);
      for (let k = 0; k < n; k++) {
        const gx = px + R() * TILE, gy = py + 4 + R() * (TILE - 4), h = 3 + R() * 4;
        g.strokeStyle = `hsla(${88 + R() * 25},${40 + R() * 15}%,${22 + R() * 14}%,.75)`; g.lineWidth = 1;
        g.beginPath(); g.moveTo(gx, gy); g.quadraticCurveTo(gx + (R() - .5) * 3, gy - h / 2, gx + (R() - .5) * 4, gy - h); g.stroke();
      }
      if (R() < 0.05) { const c = ['#f4e27a', '#fafafa', '#e892c0', '#a8c8ff'][Math.floor(R() * 4)]; const fx = px + R() * TILE, fy = py + R() * TILE; g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(fx - 1, fy + 1, 3, 1); g.fillStyle = c; g.beginPath(); g.arc(fx, fy, 1.7, 0, 7); g.fill(); }
      else if (R() < 0.04) { g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(px + R() * TILE + 1, py + R() * TILE + 2, 3, 1.5, 0, 0, 7); g.fill(); g.fillStyle = '#8c8f93'; g.beginPath(); g.ellipse(px + R() * TILE, py + R() * TILE, 2.6, 1.8, 0, 0, 7); g.fill(); }
    }
  });
  waterTiles = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (T[y * MW + x] === 1) waterTiles.push({ x, y, s: hash(x, y) * 6.28 });
  fogCanvas = mkCanvas(MW, MH, () => { });
  fogCtx = fogCanvas.getContext('2d'); fogImg = fogCtx.createImageData(MW, MH);
  fogBig = mkCanvas(MW * 8, MH * 8, () => { }); fogBigCtx = fogBig.getContext('2d');
  mmTerrain = mkCanvas(MW, MH, g => {
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const w = wmask(x + .5, y + .5); g.fillStyle = w > 0.5 ? '#2f7fb0' : w > 0.28 ? '#c9b67c' : `hsl(${100 + vn(x * .13, y * .13) * 14},38%,${30 + vn(x * .13, y * .13) * 8}%)`; g.fillRect(x, y, 1, 1); }
  });
}
function updateFogImage() {
  const d = fogImg.data;
  for (let i = 0; i < MAP_W * MAP_H; i++) {
    const v = G.vis[i];
    d[i * 4] = 6; d[i * 4 + 1] = 9; d[i * 4 + 2] = 16;
    d[i * 4 + 3] = v === 2 ? 0 : v === 1 ? 125 : 255;
  }
  fogCtx.putImageData(fogImg, 0, 0);
  fogBigCtx.clearRect(0, 0, fogBig.width, fogBig.height);
  fogBigCtx.imageSmoothingEnabled = true; fogBigCtx.filter = 'blur(7px)';
  fogBigCtx.drawImage(fogCanvas, -4, -4, fogBig.width + 8, fogBig.height + 8);
  fogBigCtx.filter = 'none';
}

/* ---------- Barras y nodos ---------- */
function hpBar(x, y, w, frac) {
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x - 1.5, y - 1.5, w + 3, 7);
  const c = frac > .5 ? ['#7dff7d', '#2fae3a'] : frac > .25 ? ['#ffe55a', '#c9a010'] : ['#ff7a6a', '#b52a1c'];
  const g = ctx.createLinearGradient(0, y, 0, y + 4); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
  ctx.fillStyle = g; ctx.fillRect(x, y, w * Math.max(0, frac), 4);
}
function drawNode(n) {
  const px = n.x * TILE, py = n.y * TILE;
  if (n.type === 'tree') { ctx.drawImage(SPR.tree[n.v], px - 9, py + TILE - 58); return; }
  const k = 0.6 + 0.4 * (n.amount / n.max);
  ctx.save(); ctx.translate(px + 16, py + 30); ctx.scale(k, k); ctx.drawImage(SPR[n.type], -18, -32); ctx.restore();
}

/* ---------- Unidades ---------- */
function drawUnit(u) {
  const x = u.x * TILE, y = u.y * TILE, col = PCOL[u.owner], dk = PDARK[u.owner], flash = u.flash > 0;
  const moving = !!u.path;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(1, 6, u.type === 'knight' ? 15 : u.type === 'ram' ? 17 : 9, u.type === 'knight' ? 6 : 4.5, u.dir, 0, 7); ctx.fill();
  if (u.sel) {
    const sc = u.owner === 0 ? '93,255,114' : '255,93,93';
    ctx.strokeStyle = `rgba(${sc},.25)`; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(0, 5, 13, 7, 0, 0, 7); ctx.stroke();
    ctx.strokeStyle = `rgb(${sc})`; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(0, 5, 13, 7, 0, 0, 7); ctx.stroke();
  }
  ctx.translate(0, moving ? Math.sin(u.anim * 14) * 1.1 : 0);
  ctx.rotate(u.dir);
  const sw = u.swing > 0 ? Math.sin((0.25 - u.swing) / .25 * Math.PI) : 0;
  const body = (c, rx, ry) => {
    const g = ctx.createLinearGradient(0, -ry, 0, ry); g.addColorStop(0, flash ? '#fff' : shade(c, .25)); g.addColorStop(1, flash ? '#fff' : shade(c, -.3));
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fill(); ctx.stroke();
  };
  const head = (c, r, ox) => { const g = ctx.createRadialGradient(ox - 1, -1, 0.5, ox, 0, r); g.addColorStop(0, flash ? '#fff' : shade(c, .3)); g.addColorStop(1, flash ? '#fff' : shade(c, -.25)); ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ox, 0, r, 0, 7); ctx.fill(); ctx.stroke(); };
  const line = (x0, y0, x1, y1, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  const stride = moving ? Math.sin(u.anim * 14) * 2 : 0;
  switch (u.type) {
    case 'villager': {
      const o = u.order, work = o && o.type === 'gather' && o.st === 'work', a = work ? Math.sin(u.anim * 10) : sw * 1.3;
      // sombrero y herramienta según recurso
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-4, -8, 3, 4 + stride * .3); // mochila / brazo
      body(col, 4.8, 7); head('#f0c9a0', 3.3, 1);
      ctx.fillStyle = '#c9a050'; ctx.strokeStyle = '#6b5020'; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(0.5, 0, 4.4, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e0bb68'; ctx.beginPath(); ctx.arc(0.5, 0, 2.2, 0, 7); ctx.fill();
      const res = o && o.res;
      ctx.save(); ctx.translate(3, 6); ctx.rotate(-0.6 + a * 0.9);
      line(0, 0, 9, 0, '#7a5230', 1.8);
      if (res === 'wood') { ctx.fillStyle = '#c8ccd2'; ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(12, -4); ctx.lineTo(12, 3); ctx.lineTo(8, 2); ctx.fill(); }
      else if (res === 'gold' || res === 'stone') { line(7, -4, 7, 4, '#c8ccd2', 2); }
      else if (res === 'food') { ctx.fillStyle = '#b08a48'; ctx.fillRect(8, -2.5, 4, 5); }
      ctx.restore();
      if (u.carry > 0.5) { ctx.fillStyle = { food: '#e04060', wood: '#8a5a2a', gold: '#ffd23a', stone: '#a0a6ac' }[u.ctype] || '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.fillRect(-10, -3.5, 5, 7); ctx.strokeRect(-10, -3.5, 5, 7); }
      break;
    }
    case 'swordsman': case 'champion': {
      const big = u.type === 'champion';
      body(big ? '#8a909a' : col, big ? 6 : 5.4, big ? 8.2 : 7.3);
      if (big) { ctx.fillStyle = col; ctx.fillRect(-5, -6, 4, 12); }
      head(big ? '#aeb4bd' : '#9aa0a8', big ? 4.4 : 3.8, 1);
      if (big) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(-1, 0, 5, 1.8, 0, 0, 7); ctx.fill(); }
      // escudo
      ctx.save(); ctx.translate(1, -7.5); blob(ctx, 0, 0, big ? 5 : 4.4, shade(col, .2), dk); ctx.restore();
      ctx.save(); ctx.translate(2, 7); ctx.rotate(-0.9 + sw * 1.9);
      line(0, 0, big ? 17 : 13, 0, '#eef3f8', big ? 3 : 2.4); line(-1, 0, 2, 0, '#7a5230', 3); line(2, -2.5, 2, 2.5, '#d8b040', 1.6);
      ctx.restore();
      break;
    }
    case 'spearman': {
      body(col, 5, 7); head('#9aa0a8', 3.5, 1);
      ctx.fillStyle = '#7a5230'; ctx.beginPath(); ctx.moveTo(-1, -3.5); ctx.lineTo(4, 0); ctx.lineTo(-1, 3.5); ctx.closePath(); ctx.fill();
      const t = sw * 8;
      line(-7 + t, 6, 17 + t, 6, '#8a6a3a', 1.9);
      ctx.fillStyle = '#e8eef3'; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(17 + t, 4); ctx.lineTo(23 + t, 6); ctx.lineTo(17 + t, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      blob(ctx, 0, -7, 3.8, shade(col, .2), dk);
      break;
    }
    case 'archer': {
      line(-5, -2, -9, -4, '#6b4a22', 2.4); line(-5, 1, -9, 0, '#6b4a22', 2.4); // carcaj
      body(shade('#3f7f45', -.1), 4.8, 6.8); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(-.5, 0, 4.2, 5, 0, 0, 7); ctx.fill();
      head('#f0c9a0', 3.3, 1); ctx.fillStyle = shade('#3f7f45', -.1); ctx.beginPath(); ctx.arc(.5, 0, 3.6, Math.PI * .5, Math.PI * 1.5); ctx.fill();
      const draw = sw * 3;
      ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(9, 0, 8.5, -1.15, 1.15); ctx.stroke();
      ctx.strokeStyle = '#eee'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(9 + Math.cos(-1.15) * 8.5, Math.sin(-1.15) * 8.5); ctx.lineTo(9 + 0.5 - draw * 2.5, 0); ctx.lineTo(9 + Math.cos(1.15) * 8.5, Math.sin(1.15) * 8.5); ctx.stroke();
      if (sw < .3) line(4, 0, 15, 0, '#d8c8a0', 1.2);
      break;
    }
    case 'knight': {
      const gal = moving ? Math.sin(u.anim * 16) * 2 : 0;
      for (const [lx, ly, ph] of [[8, -4, 0], [8, 4, 3.1], [-8, -4, 3.1], [-8, 4, 0]]) { ctx.fillStyle = '#3d2610'; ctx.fillRect(lx - 1.5 + Math.sin(u.anim * 16 + ph) * (moving ? 2.5 : 0), ly - 1.2, 4, 2.4); }
      const hg = ctx.createLinearGradient(0, -7, 0, 7); hg.addColorStop(0, flash ? '#fff' : '#a0723e'); hg.addColorStop(1, flash ? '#fff' : '#5a3a1a');
      ctx.fillStyle = hg; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, 13, 6.6, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7a5028'; ctx.beginPath(); ctx.ellipse(13 + gal * .2, 0, 5.2, 3, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a1a0a'; ctx.beginPath(); ctx.arc(14.5, -1.8, 1, 0, 7); ctx.arc(14.5, 1.8, 1, 0, 7); ctx.fill();
      line(-13, 0, -17, gal * .4, '#2a1a0a', 3);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-6, -6.2); ctx.lineTo(6, -6.2); ctx.lineTo(6, 6.2); ctx.lineTo(-6, 6.2); ctx.closePath(); ctx.globalAlpha = .9; ctx.fill(); ctx.globalAlpha = 1;
      body(col, 4.3, 5.6); head('#b9bfc7', 3.7, 1); line(-2, 0, -7, 0, '#fff', 2);
      ctx.save(); ctx.translate(2, -6); ctx.rotate(-1 + sw * 1.6); line(0, 0, 14, 0, '#eef3f8', 2.2); ctx.restore();
      break;
    }
    case 'ram': {
      const roll = u.anim * 6;
      ctx.fillStyle = '#2a1b0c'; for (const wy of [-8, 8]) for (const wx of [-10, 8]) { ctx.beginPath(); ctx.arc(wx, wy, 3.6, 0, 7); ctx.fill(); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(roll) * 3, wy + Math.sin(roll) * 3); ctx.stroke(); }
      const off = sw * 7;
      const lg = ctx.createLinearGradient(0, -3, 0, 3); lg.addColorStop(0, '#9a6e3a'); lg.addColorStop(1, '#4e3216');
      ctx.fillStyle = flash ? '#fff' : lg; ctx.strokeStyle = '#2a1b0c'; ctx.lineWidth = 1.3; ctx.fillRect(-12 + off, -3.3, 28, 6.6); ctx.strokeRect(-12 + off, -3.3, 28, 6.6);
      ctx.fillStyle = '#b8bec6'; ctx.beginPath(); ctx.moveTo(15 + off, -4.6); ctx.lineTo(21 + off, 0); ctx.lineTo(15 + off, 4.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      const rg = ctx.createLinearGradient(0, -9, 0, 9); rg.addColorStop(0, shade(col, .2)); rg.addColorStop(.5, col); rg.addColorStop(1, dk);
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(-14, -9); ctx.lineTo(10, -9); ctx.lineTo(13, 0); ctx.lineTo(10, 9); ctx.lineTo(-14, 9); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke();
      for (let i = -10; i < 10; i += 5) line(i, -8, i, 8, 'rgba(0,0,0,.25)', 1);
      break;
    }
  }
  ctx.restore();
  if (u.sel || u.hp < u.maxhp) hpBar(x - 12, y - (u.type === 'knight' ? 20 : 17), 24, u.hp / u.maxhp);
}

/* ---------- Edificios ---------- */
function flag(x, y, h, col, t) {
  ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - h);
  for (let i = 0; i <= 8; i++) ctx.lineTo(x + i * 1.6, y - h + Math.sin(t * 4 + i * .7) * 1.6 + i * 0.1);
  for (let i = 8; i >= 0; i--) ctx.lineTo(x + i * 1.6, y - h + 7 + Math.sin(t * 4 + i * .7) * 1.6);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
function drawHall(b, px, py, pw, ph, col, dk, flash) {
  const T = b.type, lift = b.w * 5;
  const wallC = { house: '#dccaa2', lumber: '#a98350', mining: '#948b7e', barracks: '#bdb199', archery: '#b8ab8e', stable: '#bc9f76', tc: '#d6c8a6' }[T];
  const wallH = T === 'house' ? ph * .5 : ph * .46, wx = px + 3, ww = pw - 6, wy = py + ph - 3 - wallH;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.moveTo(px + 4, py + ph - 2); ctx.lineTo(px + pw + 6, py + ph - 2); ctx.lineTo(px + pw + 14, py + ph + 7); ctx.lineTo(px + 10, py + ph + 7); ctx.fill();
  if (T === 'tc') { // torres laterales detrás
    for (const cx of [px - 2, px + pw - 14]) {
      const tg = ctx.createLinearGradient(cx, 0, cx + 16, 0); tg.addColorStop(0, '#b8bdc4'); tg.addColorStop(1, '#6e737a');
      ctx.fillStyle = tg; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.3; ctx.fillRect(cx, py + 4 - lift, 16, ph - 8 + lift); ctx.strokeRect(cx, py + 4 - lift, 16, ph - 8 + lift);
      for (let i = 0; i < 3; i++) ctx.fillRect(cx + i * 6, py - lift - 2, 4, 6);
      ctx.fillStyle = '#222'; ctx.fillRect(cx + 6, py + 20 - lift, 3, 8);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx - 2, py - lift - 2); ctx.lineTo(cx + 8, py - lift - 20); ctx.lineTo(cx + 18, py - lift - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  const gw = ctx.createLinearGradient(0, wy, 0, wy + wallH); gw.addColorStop(0, flash ? '#fff' : shade(wallC, .15)); gw.addColorStop(1, flash ? '#fff' : shade(wallC, -.28));
  ctx.fillStyle = gw; ctx.fillRect(wx, wy, ww, wallH);
  ctx.strokeStyle = 'rgba(0,0,0,.13)'; ctx.lineWidth = 1;
  for (let r = 0; r * 7 < wallH; r++) { const yy = wy + r * 7; ctx.beginPath(); ctx.moveTo(wx, yy); ctx.lineTo(wx + ww, yy); ctx.stroke(); for (let x = wx + (r % 2) * 6; x < wx + ww; x += 12) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x, yy + 7); ctx.stroke(); } }
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(wx, wy + wallH - 4, ww, 4);
  ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 1.5; ctx.strokeRect(wx, wy, ww, wallH);
  // puerta
  const dw = Math.min(T === 'tc' ? 26 : 16, ww * .26), dx = wx + ww / 2 - dw / 2, dh = wallH * .64;
  ctx.fillStyle = '#35200e'; ctx.beginPath(); ctx.moveTo(dx, wy + wallH); ctx.lineTo(dx, wy + wallH - dh + dw / 2); ctx.arc(dx + dw / 2, wy + wallH - dh + dw / 2, dw / 2, Math.PI, 0); ctx.lineTo(dx + dw, wy + wallH); ctx.fill();
  ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(dx + dw / 2, wy + wallH - dh); ctx.lineTo(dx + dw / 2, wy + wallH); ctx.stroke();
  if (T === 'house' || T === 'tc' || T === 'barracks') for (const wxx of [wx + ww * .18, wx + ww * .82 - 7]) { ctx.fillStyle = '#2a3a4a'; ctx.fillRect(wxx, wy + wallH * .25, 7, 8); ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 1.2; ctx.strokeRect(wxx, wy + wallH * .25, 7, 8); ctx.fillStyle = 'rgba(255,230,140,.7)'; if (b.done) ctx.fillRect(wxx + 1, wy + wallH * .25 + 1, 5, 6); }
  // emblemas en el muro
  const ex = wx + ww / 2, ey = wy + wallH * .3;
  if (T === 'barracks') { ctx.fillStyle = col; ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex - 7, ey - 6); ctx.lineTo(ex + 7, ey - 6); ctx.lineTo(ex + 7, ey + 2); ctx.lineTo(ex, ey + 9); ctx.lineTo(ex - 7, ey + 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(ex - 4, ey - 3); ctx.lineTo(ex + 4, ey + 4); ctx.moveTo(ex + 4, ey - 3); ctx.lineTo(ex - 4, ey + 4); ctx.stroke(); }
  if (T === 'archery') for (let i = 3; i >= 0; i--) { ctx.fillStyle = i % 2 ? '#f4f4f4' : '#d83a2a'; ctx.beginPath(); ctx.arc(wx + ww * .8, wy + wallH * .45, 3 + i * 2.6, 0, 7); ctx.fill(); }
  if (T === 'stable') { for (let i = 0; i < 3; i++) blob(ctx, wx + 8 + i * 9, py + ph + 1, 5, '#f0d060', '#a07820'); ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + ww - 30, py + ph + 3); ctx.lineTo(wx + ww, py + ph + 3); ctx.stroke(); for (let x = wx + ww - 30; x <= wx + ww; x += 10) { ctx.beginPath(); ctx.moveTo(x, py + ph - 3); ctx.lineTo(x, py + ph + 5); ctx.stroke(); } }
  if (T === 'lumber') { for (const [lx, ly] of [[wx + ww - 7, py + ph - 2], [wx + ww - 17, py + ph - 2], [wx + ww - 12, py + ph - 10]]) { blob(ctx, lx, ly, 5, '#b08050', '#6a4422'); ctx.strokeStyle = '#e0c090'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, 7); ctx.stroke(); } }
  if (T === 'mining') { for (const [rx, ry, r] of [[wx + 8, py + ph - 3, 6], [wx + 18, py + ph - 1, 4.5], [wx + ww - 10, py + ph - 3, 5]]) blob(ctx, rx, ry, r, '#b0b5ba', '#5a5e63'); blob(ctx, wx + 13, py + ph - 8, 3.5, '#fff2a0', '#d89a10'); }
  // tejado
  const top = py - lift + (T === 'tc' ? 8 : 0), rb = wy + 4;
  const rg = ctx.createLinearGradient(0, top, 0, rb); rg.addColorStop(0, flash ? '#fff' : shade(col, .28)); rg.addColorStop(1, flash ? '#fff' : shade(dk, -.05));
  ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(px - 2, rb); ctx.lineTo(px + pw * .2, top); ctx.lineTo(px + pw * .8, top); ctx.lineTo(px + pw + 2, rb); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1;
  for (let yy = top + 5; yy < rb; yy += 5) { const f = (yy - top) / (rb - top), x0 = px + pw * .2 - (pw * .2 + 2) * f, x1 = px + pw * .8 + (pw * .2 + 2) * f; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
  const sh = ctx.createLinearGradient(px, 0, px + pw, 0); sh.addColorStop(0, 'rgba(255,255,255,.12)'); sh.addColorStop(.6, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.28)');
  ctx.fillStyle = sh; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(wx, rb - 1, ww, 5);
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(px + pw * .2, top + 1); ctx.lineTo(px + pw * .8, top + 1); ctx.stroke();
  if (T === 'house') { // chimenea
    const cx = px + pw * .66; ctx.fillStyle = '#8a7e70'; ctx.fillRect(cx, top - 7, 6, 11); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.strokeRect(cx, top - 7, 6, 11);
    if (b.done) for (let i = 0; i < 4; i++) { const k = ((G.t * .6 + i * .25) % 1); ctx.fillStyle = `rgba(220,220,220,${.45 * (1 - k)})`; ctx.beginPath(); ctx.arc(cx + 3 + Math.sin(k * 6 + i) * 3 + k * 4, top - 9 - k * 22, 2.5 + k * 4, 0, 7); ctx.fill(); }
  }
  if (T === 'barracks' || T === 'archery' || T === 'stable') flag(px + pw - 12, top + 4, 22, col, G.t);
  if (T === 'tc') { flag(px + pw / 2, top + 4, 34, col, G.t); }
}
function drawTower(b, px, py, pw, ph, col, flash) {
  const cx = px + pw / 2, tw = pw - 14, th = ph * 1.2, top = py + ph - th;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx + 8, py + ph, tw / 2 + 8, 7, 0, 0, 7); ctx.fill();
  const g = ctx.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0); g.addColorStop(0, flash ? '#fff' : '#c4c8ce'); g.addColorStop(.5, flash ? '#fff' : '#9a9ea6'); g.addColorStop(1, flash ? '#fff' : '#5a5e66');
  ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 1.5; ctx.fillRect(cx - tw / 2, top + 6, tw, th - 6); ctx.strokeRect(cx - tw / 2, top + 6, tw, th - 6);
  ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1; for (let y = top + 12; y < py + ph; y += 7) { ctx.beginPath(); ctx.moveTo(cx - tw / 2, y); ctx.lineTo(cx + tw / 2, y); ctx.stroke(); }
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(cx - 1.5, top + 22, 3, 9); ctx.fillRect(cx - 1.5, top + 40, 3, 9);
  ctx.fillStyle = '#2a1a0a'; ctx.beginPath(); ctx.moveTo(cx - 5, py + ph); ctx.lineTo(cx - 5, py + ph - 10); ctx.arc(cx, py + ph - 10, 5, Math.PI, 0); ctx.lineTo(cx + 5, py + ph); ctx.fill();
  ctx.fillStyle = flash ? '#fff' : '#b0b4ba'; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 1.3; ctx.fillRect(cx - tw / 2 - 3, top, tw + 6, 8); ctx.strokeRect(cx - tw / 2 - 3, top, tw + 6, 8);
  for (let i = 0; i < 4; i++) { const mx = cx - tw / 2 - 3 + i * ((tw + 6) / 4); ctx.fillRect(mx, top - 5, (tw + 6) / 4 - 4, 6); ctx.strokeRect(mx, top - 5, (tw + 6) / 4 - 4, 6); }
  flag(cx, top, 20, col, G.t);
}
function drawMill(b, px, py, pw, ph, col, flash) {
  const cx = px + pw / 2, by = py + ph - 3;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx + 6, by + 2, pw / 2, 6, 0, 0, 7); ctx.fill();
  const g = ctx.createLinearGradient(px, 0, px + pw, 0); g.addColorStop(0, flash ? '#fff' : '#eadfc4'); g.addColorStop(1, flash ? '#fff' : '#9c8e70');
  ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px + 8, by); ctx.lineTo(px + pw - 8, by); ctx.lineTo(px + pw - 16, py + 14); ctx.lineTo(px + 16, py + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(px + 12, py + 16); ctx.lineTo(cx, py - 6); ctx.lineTo(px + pw - 12, py + 16); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#35200e'; ctx.fillRect(cx - 4, by - 12, 8, 12);
  ctx.save(); ctx.translate(cx, py + 16); ctx.rotate(b.done ? G.t * 1.1 : 0);
  for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.strokeStyle = '#5a4026'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -24); ctx.stroke(); ctx.fillStyle = 'rgba(245,238,220,.92)'; ctx.fillRect(1, -24, 7, 14); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.strokeRect(1, -24, 7, 14); }
  ctx.restore(); blob(ctx, cx, py + 16, 3.5, '#a0845a', '#4a3418');
}
function drawFarm(b, px, py, pw, ph, flash) {
  const g = ctx.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, flash ? '#fff' : '#7a5632'); g.addColorStop(1, flash ? '#fff' : '#523a1e');
  ctx.fillStyle = g; ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
  const f = Math.max(0, b.food / BUILDINGS.farm.food), rows = 6, rh = (ph - 8) / rows;
  for (let i = 0; i < rows; i++) {
    const y = py + 4 + i * rh;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(px + 4, y + rh * .55, pw - 8, rh * .35);
    for (let x = px + 6; x < px + pw - 6; x += 5) {
      const h = (2 + 5 * f) * (.8 + hash(x | 0, (y | 0) + 3) * .4), c = f > .5 ? '#d8b840' : f > .2 ? '#a8b040' : '#7a7a30';
      ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y + rh * .6); ctx.lineTo(x + Math.sin(G.t * 2 + x) * .8, y + rh * .6 - h); ctx.stroke();
    }
  }
  ctx.strokeStyle = '#5a3c1c'; ctx.lineWidth = 2; ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
  for (let x = px + 1; x < px + pw; x += 10) { ctx.fillStyle = '#7a5428'; ctx.fillRect(x - 1.5, py - 2, 3, 5); ctx.fillRect(x - 1.5, py + ph - 3, 3, 5); }
}
function drawBuilding(b) {
  const D = BUILDINGS[b.type], px = b.x * TILE, py = b.y * TILE, pw = b.w * TILE, ph = b.h * TILE, col = PCOL[b.owner], dk = PDARK[b.owner], flash = b.flash > 0;
  if (b.sel) {
    const sc = b.owner === 0 ? '93,255,114' : '255,93,93';
    ctx.strokeStyle = `rgba(${sc},.3)`; ctx.lineWidth = 7; ctx.strokeRect(px - 2, py - 2, pw + 4, ph + 4);
    ctx.strokeStyle = `rgb(${sc})`; ctx.lineWidth = 2; ctx.strokeRect(px - 2, py - 2, pw + 4, ph + 4);
  }
  ctx.save();
  if (!b.done) { const full = ph * 1.3 + 10, h = full * (0.12 + 0.88 * b.progress); ctx.beginPath(); ctx.rect(px - 20, py + ph + 10 - h, pw + 40, h); ctx.clip(); }
  if (b.type === 'farm') drawFarm(b, px, py, pw, ph, flash);
  else if (b.type === 'tower') drawTower(b, px, py, pw, ph, col, flash);
  else if (b.type === 'mill') drawMill(b, px, py, pw, ph, col, flash);
  else drawHall(b, px, py, pw, ph, col, dk, flash);
  ctx.restore();
  if (!b.done) {
    ctx.strokeStyle = 'rgba(150,105,50,.95)'; ctx.lineWidth = 2;
    const top = py - 14 + (1 - b.progress) * 10;
    for (const x of [px, px + pw * .5, px + pw]) { ctx.beginPath(); ctx.moveTo(x, py + ph + 2); ctx.lineTo(x, top); ctx.stroke(); }
    for (let y = py + ph - 8; y > top; y -= 14) { ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + pw, y - 8); ctx.moveTo(px + pw, y); ctx.lineTo(px, y - 8); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(px + 3, py + ph + 6, pw - 6, 7);
    const pg = ctx.createLinearGradient(0, py + ph + 7, 0, py + ph + 12); pg.addColorStop(0, '#ffe38a'); pg.addColorStop(1, '#c08a1a');
    ctx.fillStyle = pg; ctx.fillRect(px + 4, py + ph + 7, (pw - 8) * b.progress, 5);
  }
  if (b.hp < b.maxhp * 0.5 && b.done) { // fuego y humo
    const n = b.hp < b.maxhp * .25 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const fx = px + pw * (0.15 + i * 0.7 / (n - 1)), fy = py + ph * 0.45 + Math.sin(i * 3) * 8, s = 1 + .2 * Math.sin(G.t * 13 + i * 2);
      for (let k = 0; k < 3; k++) { const q = ((G.t * .8 + i * .3 + k * .33) % 1); ctx.fillStyle = `rgba(50,45,42,${.5 * (1 - q)})`; ctx.beginPath(); ctx.arc(fx + Math.sin(q * 5 + i) * 4, fy - 10 - q * 38, 4 + q * 8, 0, 7); ctx.fill(); }
      const fg = ctx.createRadialGradient(fx, fy, 1, fx, fy, 11 * s); fg.addColorStop(0, 'rgba(255,240,120,.95)'); fg.addColorStop(.45, 'rgba(255,120,20,.85)'); fg.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(fx, fy - 4, 8 * s, 13 * s, 0, 0, 7); ctx.fill();
    }
  }
  if (b.sel || (b.hp < b.maxhp && b.done)) hpBar(px + pw / 2 - 22, py - b.w * 5 - 14 - (b.type === 'tc' ? 20 : 0), 44, b.hp / b.maxhp);
  if (b.sel && b.done && b.owner === 0 && b.rally) {
    const r = b.rally.node ? center(b.rally.node) : b.rally;
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px + pw / 2, py + ph / 2); ctx.lineTo(r.x * TILE, r.y * TILE); ctx.stroke(); ctx.setLineDash([]);
    flag(r.x * TILE, r.y * TILE, 16, col, G.t);
  }
}

/* ---------- Bucle de dibujo ---------- */
const drawList = [];
let ghost = null, lastFogDraw = -1;
function render() {
  const z = cam.zoom * DPR;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0a0c10'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(z, 0, 0, z, -cam.x * z, -cam.y * z);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(terrainCanvas, 0, 0);
  const vx0 = cam.x - 70, vy0 = cam.y - 90, vx1 = cam.x + VW / cam.zoom + 70, vy1 = cam.y + VH / cam.zoom + 70;
  const inV = (x, y, w, h) => x * TILE + w * TILE >= vx0 && x * TILE <= vx1 && y * TILE + h * TILE >= vy0 && y * TILE <= vy1;
  const explored = (x, y) => G.vis[Math.floor(y) * MAP_W + Math.floor(x)] > 0;
  // agua animada
  ctx.lineWidth = 1.3;
  for (const w of waterTiles) {
    if (!inV(w.x, w.y, 1, 1)) continue;
    const a = .12 + .14 * Math.sin(G.t * 1.6 + w.s), ox = Math.sin(G.t * .7 + w.s) * 4;
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.moveTo(w.x * TILE + 5 + ox, w.y * TILE + 11); ctx.quadraticCurveTo(w.x * TILE + 12 + ox, w.y * TILE + 7, w.x * TILE + 20 + ox, w.y * TILE + 11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w.x * TILE + 10 - ox, w.y * TILE + 23); ctx.quadraticCurveTo(w.x * TILE + 17 - ox, w.y * TILE + 19, w.x * TILE + 26 - ox, w.y * TILE + 23); ctx.stroke();
  }
  for (const f of G.fx) if (f.type === 'blood') { ctx.fillStyle = `rgba(110,18,18,${0.55 * (1 - f.t / f.dur)})`; ctx.beginPath(); ctx.ellipse(f.x * TILE, f.y * TILE + 2, 7, 4, 0, 0, 7); ctx.fill(); }

  drawList.length = 0;
  for (const n of G.nodes) if (!n.dead && inV(n.x, n.y, 1, 1) && explored(n.x, n.y)) { n._sy = (n.y + 1) * TILE; n.sel = selSet.has(n.id); drawList.push(n); }
  for (const b of G.buildings) if (!b.dead && inV(b.x, b.y, b.w, b.h) && (b.owner === 0 || explored(b.x + b.w / 2, b.y + b.h / 2))) { b._sy = (b.y + b.h) * TILE - 2; b.sel = selSet.has(b.id); drawList.push(b); }
  for (const u of G.units) if (!u.dead && inV(u.x, u.y, 0, 0) && (u.owner === 0 || visibleAt(u.x, u.y))) { u._sy = u.y * TILE + 4; u.sel = selSet.has(u.id); drawList.push(u); }
  drawList.sort((a, b) => (a.type === 'farm' ? -1e6 : a._sy) - (b.type === 'farm' ? -1e6 : b._sy));
  for (const e of drawList) {
    if (e.kind === 'node') { drawNode(e); if (e.sel) { ctx.strokeStyle = '#ffe97a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x * TILE + 16, e.y * TILE + 26, 15, 8, 0, 0, 7); ctx.stroke(); } }
    else if (e.kind === 'building') drawBuilding(e); else drawUnit(e);
  }
  // proyectiles
  for (const pr of G.proj) {
    if (pr.att.owner !== 0 && !visibleAt(pr.x, pr.y)) continue;
    const k = Math.min(1, pr.t / pr.dur), arc = Math.sin(k * Math.PI) * 12;
    const x = pr.x * TILE, y = pr.y * TILE - arc, a = Math.atan2((pr.last.y - pr.sy) * TILE, (pr.last.x - pr.sx) * TILE) + Math.cos(k * Math.PI) * 0.35;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + arc, 4, 1.5, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = '#f1e6c8'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.fillStyle = '#d0d4d8'; ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(8, 0); ctx.lineTo(4, 2); ctx.fill(); ctx.fillStyle = '#c04030'; ctx.fillRect(-8, -1.5, 3, 3); ctx.restore();
  }
  for (const f of G.fx) {
    const k = f.t / f.dur;
    if (f.type === 'spark') { const g = ctx.createRadialGradient(f.x * TILE, f.y * TILE, 0, f.x * TILE, f.y * TILE, 6 + 5 * k); g.addColorStop(0, `rgba(255,240,150,${1 - k})`); g.addColorStop(1, 'rgba(255,150,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x * TILE, f.y * TILE, 6 + 5 * k, 0, 7); ctx.fill(); }
    else if (f.type === 'boom') {
      const r = f.r * TILE;
      const g = ctx.createRadialGradient(f.x * TILE, f.y * TILE, 2, f.x * TILE, f.y * TILE, r * (.4 + k * .8)); g.addColorStop(0, `rgba(255,230,120,${.9 * (1 - k)})`); g.addColorStop(.5, `rgba(255,110,20,${.7 * (1 - k)})`); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x * TILE, f.y * TILE, r * (.4 + k * .8), 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(70,60,55,${.55 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x * TILE, f.y * TILE - k * 26, r * .5 * (.5 + k), 0, 7); ctx.fill();
    } else if (f.type === 'ring') { ctx.strokeStyle = (f.col || '#5dff72') + Math.floor((1 - k) * 255).toString(16).padStart(2, '0'); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x * TILE, f.y * TILE, 6 + 14 * k, 3 + 7 * k, 0, 0, 7); ctx.stroke(); }
  }
  // niebla suavizada
  if (lastFogDraw !== G.fogStamp) { updateFogImage(); lastFogDraw = G.fogStamp; }
  ctx.imageSmoothingEnabled = true; ctx.drawImage(fogBig, 0, 0, MAP_W * TILE, MAP_H * TILE);

  if (typeof buildType !== 'undefined' && buildType) {
    const D = BUILDINGS[buildType], w = s2w(mouse.x, mouse.y), tx = Math.floor(w.x / TILE - (D.size - 1) / 2), ty = Math.floor(w.y / TILE - (D.size - 1) / 2);
    const ok = canPlace(buildType, tx, ty, 0, 0);
    ctx.fillStyle = ok ? 'rgba(70,255,100,.38)' : 'rgba(255,60,60,.42)'; ctx.fillRect(tx * TILE, ty * TILE, D.size * TILE, D.size * TILE);
    ctx.strokeStyle = ok ? '#5dff72' : '#ff5d5d'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(tx * TILE, ty * TILE, D.size * TILE, D.size * TILE); ctx.setLineDash([]);
    ctx.font = '26px "Segoe UI Emoji"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(D.icon, (tx + D.size / 2) * TILE, (ty + D.size / 2) * TILE);
    if (D.range) { ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc((tx + D.size / 2) * TILE, (ty + D.size / 2) * TILE, D.range * TILE, 0, 7); ctx.stroke(); }
    ghost = { tx, ty, ok };
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // viñeta
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * .45, VW / 2, VH / 2, Math.max(VW, VH) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (dragBox) {
    const x = Math.min(dragBox.x0, dragBox.x1), y = Math.min(dragBox.y0, dragBox.y1), w = Math.abs(dragBox.x1 - dragBox.x0), h = Math.abs(dragBox.y1 - dragBox.y0);
    ctx.fillStyle = 'rgba(93,255,114,.1)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#5dff72'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w, h);
  }
  renderMinimap();
}

function renderMinimap() {
  const s = mm.width / MAP_W;
  mctx.clearRect(0, 0, mm.width, mm.height);
  mctx.imageSmoothingEnabled = true;
  mctx.drawImage(mmTerrain, 0, 0, mm.width, mm.height);
  for (const n of G.nodes) {
    if (n.dead || G.vis[n.y * MAP_W + n.x] === 0) continue;
    mctx.fillStyle = { tree: '#1c4a20', berry: '#d02a48', gold: '#ffd23a', stone: '#b8bcc4' }[n.type]; mctx.fillRect(n.x * s, n.y * s, Math.max(1.5, s), Math.max(1.5, s));
  }
  for (const b of G.buildings) {
    if (b.dead || (b.owner !== 0 && G.vis[(b.y + 1) * MAP_W + b.x + 1] === 0)) continue;
    mctx.fillStyle = PCOL[b.owner]; mctx.fillRect(b.x * s, b.y * s, b.w * s, b.h * s); mctx.strokeStyle = '#000'; mctx.lineWidth = .6; mctx.strokeRect(b.x * s, b.y * s, b.w * s, b.h * s);
  }
  for (const u of G.units) {
    if (u.dead || (u.owner !== 0 && !visibleAt(u.x, u.y))) continue;
    mctx.fillStyle = PCOL[u.owner]; mctx.fillRect(u.x * s - 1, u.y * s - 1, 2.6, 2.6);
  }
  mctx.globalAlpha = .92; mctx.drawImage(fogCanvas, 0, 0, mm.width, mm.height); mctx.globalAlpha = 1;
  for (const f of G.fx) if (f.type === 'ping') { mctx.strokeStyle = '#ff4444'; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(f.x * s, f.y * s, 4 + (f.t * 8) % 14, 0, 7); mctx.stroke(); }
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 1.5;
  mctx.strokeRect(cam.x / TILE * s, cam.y / TILE * s, VW / cam.zoom / TILE * s, (VH - BOTTOM_H) / cam.zoom / TILE * s);
}
