'use strict';
/* ============ Renderizado isométrico (proyección 2:1 como Age of Empires II) ============ */
const cv = document.getElementById('game'), MAINCTX = cv.getContext('2d');
let ctx = MAINCTX;
const mm = document.getElementById('minimap'), mctx = mm.getContext('2d');
const cam = { x: 0, y: 0, zoom: 1 };
let VW = innerWidth, VH = innerHeight, DPR = 1;
const BOTTOM_H = 180;
// Proyección: un píxel de mundo plano (X,Y; 1 casilla = TILE px) -> pantalla isométrica
const OX = MAP_H * TILE, ISO_W = (MAP_W + MAP_H) * TILE, ISO_H = (MAP_W + MAP_H) * TILE / 2;
const isoX = (tx, ty) => (tx - ty) * TILE + OX;
const isoY = (tx, ty) => (tx + ty) * TILE / 2;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  VW = innerWidth; VH = innerHeight;
  cv.width = VW * DPR; cv.height = VH * DPR; cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  clampCam();
}
function clampCam() {
  cam.zoom = Math.max(0.55, Math.min(1.7, cam.zoom));
  const vw = VW / cam.zoom, vh = (VH - BOTTOM_H) / cam.zoom;
  cam.x = Math.max(-60, Math.min(ISO_W - vw + 60, cam.x));
  cam.y = Math.max(-60, Math.min(ISO_H - vh + 90, cam.y));
}
// pantalla -> coordenadas de casilla (flotantes)
function s2t(sx, sy) {
  const wx = sx / cam.zoom + cam.x - OX, wy = sy / cam.zoom + cam.y, a = wx / TILE, b = wy * 2 / TILE;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
// pantalla -> mundo isométrico (px)
const s2w = (sx, sy) => ({ x: sx / cam.zoom + cam.x, y: sy / cam.zoom + cam.y });
// casilla -> pantalla
const t2s = (tx, ty) => ({ x: (isoX(tx, ty) - cam.x) * cam.zoom, y: (isoY(tx, ty) - cam.y) * cam.zoom });
function centerCam(tx, ty) {
  cam.x = isoX(tx, ty) - VW / cam.zoom / 2; cam.y = isoY(tx, ty) - (VH - BOTTOM_H) / cam.zoom / 2; clampCam();
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

/* ---------- Bucle de dibujo ---------- */
const drawList = [];
let ghost = null, lastFogDraw = -1;
function diamondPath(c, x, y, w, h, lift) {
  c.beginPath(); c.moveTo(isoX(x, y), isoY(x, y) - lift); c.lineTo(isoX(x + w, y), isoY(x + w, y) - lift);
  c.lineTo(isoX(x + w, y + h), isoY(x + w, y + h) - lift); c.lineTo(isoX(x, y + h), isoY(x, y + h) - lift); c.closePath();
}
function render() {
  const z = cam.zoom * DPR;
  const upright = () => ctx.setTransform(z, 0, 0, z, -cam.x * z, -cam.y * z);
  const ground = () => ctx.setTransform(z, z * .5, -z, z * .5, (OX - cam.x) * z, -cam.y * z);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, cv.height); bg.addColorStop(0, '#0b0e14'); bg.addColorStop(1, '#06080c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ground();
  ctx.drawImage(terrainCanvas, 0, 0);
  const vx0 = cam.x - 160, vx1 = cam.x + VW / cam.zoom + 160, vy0 = cam.y - 200, vy1 = cam.y + VH / cam.zoom + 120;
  const inView = (tx, ty) => { const sx = isoX(tx, ty), sy = isoY(tx, ty); return sx >= vx0 && sx <= vx1 && sy >= vy0 && sy <= vy1; };
  const explored = (x, y) => G.vis[Math.floor(y) * MAP_W + Math.floor(x)] > 0;
  // agua animada y suelo bajo edificios (en el plano del suelo)
  ctx.lineWidth = 1.3;
  for (const w of waterTiles) {
    if (!inView(w.x, w.y)) continue;
    const a = .12 + .14 * Math.sin(G.t * 1.6 + w.s), ox = Math.sin(G.t * .7 + w.s) * 4, X = w.x * TILE, Y = w.y * TILE;
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.moveTo(X + 5 + ox, Y + 11); ctx.quadraticCurveTo(X + 12 + ox, Y + 7, X + 20 + ox, Y + 11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X + 10 - ox, Y + 23); ctx.quadraticCurveTo(X + 17 - ox, Y + 19, X + 26 - ox, Y + 23); ctx.stroke();
  }
  for (const b of G.buildings) {
    if (b.dead || !inView(b.x + b.w / 2, b.y + b.h / 2) || (b.owner !== 0 && !explored(b.x + b.w / 2, b.y + b.h / 2))) continue;
    const cx = (b.x + b.w / 2) * TILE, cy = (b.y + b.h / 2) * TILE, r = b.w * TILE * (b.type === 'farm' ? .66 : .78);
    const g = ctx.createRadialGradient(cx, cy, r * .3, cx, cy, r); g.addColorStop(0, 'rgba(96,72,44,.75)'); g.addColorStop(1, 'rgba(96,72,44,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  }
  for (const f of G.fx) {
    if (f.type === 'blood') { ctx.fillStyle = `rgba(110,18,18,${0.55 * (1 - f.t / f.dur)})`; ctx.beginPath(); ctx.arc(f.x * TILE, f.y * TILE, 6, 0, 7); ctx.fill(); }
    else if (f.type === 'ring') { const k = f.t / f.dur; ctx.strokeStyle = (f.col || '#5dff72') + Math.floor((1 - k) * 255).toString(16).padStart(2, '0'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x * TILE, f.y * TILE, 8 + 14 * k, 0, 7); ctx.stroke(); }
  }
  // rastro de unidades seleccionadas / formación de edificios
  upright();
  drawList.length = 0;
  for (const n of G.nodes) if (!n.dead && inView(n.x + .5, n.y + .5) && explored(n.x, n.y)) { n._d = n.x + n.y + 1; n.sel = selSet.has(n.id); drawList.push(n); }
  for (const b of G.buildings) if (!b.dead && inView(b.x + b.w / 2, b.y + b.h / 2) && (b.owner === 0 || explored(b.x + b.w / 2, b.y + b.h / 2))) { b._d = b.x + b.y + b.w + (b.type === 'farm' ? -50 : 0.6); b.sel = selSet.has(b.id); drawList.push(b); }
  for (const u of G.units) if (!u.dead && inView(u.x, u.y) && (u.owner === 0 || visibleAt(u.x, u.y))) { u._d = u.x + u.y; u.sel = selSet.has(u.id); drawList.push(u); }
  for (const a of G.animals) if (!a.dead && inView(a.x, a.y) && visibleAt(a.x, a.y)) { a._d = a.x + a.y; a.sel = selSet.has(a.id); drawList.push(a); }
  drawList.sort((a, b) => a._d - b._d);
  for (const e of drawList) {
    if (e.kind === 'node') drawNode(e); else if (e.kind === 'building') drawBuilding(e); else if (e.kind === 'animal') drawAnimal(e); else drawUnit(e);
  }
  // proyectiles y efectos aéreos
  for (const pr of G.proj) {
    if (pr.att.owner !== 0 && !visibleAt(pr.x, pr.y)) continue;
    const k = Math.min(1, pr.t / pr.dur), arc = Math.sin(k * Math.PI) * 26, h0 = pr.att.kind === 'unit' ? 22 : 40;
    const sx = isoX(pr.x, pr.y), sy = isoY(pr.x, pr.y) - h0 * (1 - k) - arc, ex = isoX(pr.last.x, pr.last.y) - isoX(pr.sx, pr.sy), ey = isoY(pr.last.x, pr.last.y) - isoY(pr.sx, pr.sy);
    const a = Math.atan2(ey - Math.cos(k * Math.PI) * 26 * .6 + h0 * .3, ex);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(sx, isoY(pr.x, pr.y), 4, 1.6, 0, 0, 7); ctx.fill();
    const L = pr.spear ? 19 : 9; ctx.save(); ctx.translate(sx, sy); ctx.rotate(a); ctx.strokeStyle = pr.spear ? '#8a6a3a' : '#f1e6c8'; ctx.lineWidth = pr.spear ? 2.2 : 1.6; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.fillStyle = '#d0d4d8'; ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(8, 0); ctx.lineTo(4, 2); ctx.fill(); ctx.fillStyle = '#c04030'; ctx.fillRect(-9, -1.6, 3, 3.2); ctx.restore();
  }
  for (const f of G.fx) {
    const k = f.t / f.dur, sx = isoX(f.x, f.y), sy = isoY(f.x, f.y) - (f.h || 0);
    if (f.type === 'spark') { const g = ctx.createRadialGradient(sx, sy - 14, 0, sx, sy - 14, 7 + 5 * k); g.addColorStop(0, `rgba(255,240,150,${1 - k})`); g.addColorStop(1, 'rgba(255,150,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy - 14, 7 + 5 * k, 0, 7); ctx.fill(); }
    else if (f.type === 'boom') {
      const r = f.r * TILE * .7, g = ctx.createRadialGradient(sx, sy - 10, 2, sx, sy - 10, r * (.4 + k * .8)); g.addColorStop(0, `rgba(255,230,120,${.9 * (1 - k)})`); g.addColorStop(.5, `rgba(255,110,20,${.7 * (1 - k)})`); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy - 10, r * (.4 + k * .8), 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(70,60,55,${.55 * (1 - k)})`; ctx.beginPath(); ctx.arc(sx, sy - 14 - k * 40, r * .45 * (.5 + k), 0, 7); ctx.fill();
    } else if (f.type === 'chip') { // astillas / chispas / hojas / polvo con física simple
      const t = f.t, x = sx + f.vx * t, y = sy - f.h0 - f.vz * t + 90 * t * t;
      ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot * t * 6); ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.fillStyle = f.col;
      if (f.shape === 'spark') { ctx.fillStyle = '#ffe48a'; ctx.fillRect(-1, -1, 2.4, 2.4); } else ctx.fillRect(-f.s, -f.s * .5, f.s * 2, f.s);
      ctx.restore();
    } else if (f.type === 'fell') {
      const s = SPR.tree[f.v], kk = Math.min(1, f.t / f.dur); ctx.save(); ctx.translate(sx, sy + 3); ctx.rotate(f.dir * Math.pow(kk, 2.2) * 1.45); ctx.globalAlpha = kk > .8 ? (1 - kk) / .2 : 1; ctx.drawImage(s, -28, -64, s.lw, s.lh); ctx.restore();
    } else if (f.type === 'dust') { ctx.fillStyle = `rgba(190,170,130,${.35 * (1 - k)})`; ctx.beginPath(); ctx.arc(sx, sy - k * 8, 3 + k * 7, 0, 7); ctx.fill(); }
  }
  // niebla suavizada (en el plano del suelo)
  if (lastFogDraw !== G.fogStamp) { updateFogImage(); lastFogDraw = G.fogStamp; }
  ground(); ctx.imageSmoothingEnabled = true; ctx.drawImage(fogBig, 0, 0, MAP_W * TILE, MAP_H * TILE);
  upright();

  if (typeof buildType !== 'undefined' && buildType) {
    const D = BUILDINGS[buildType], t = s2t(mouse.x, mouse.y), tx = Math.floor(t.x - (D.size - 1) / 2 - .0), ty = Math.floor(t.y - (D.size - 1) / 2);
    const ok = canPlace(buildType, tx, ty, 0, 0);
    diamondPath(ctx, tx, ty, D.size, D.size, 0); ctx.fillStyle = ok ? 'rgba(70,255,100,.38)' : 'rgba(255,60,60,.42)'; ctx.fill();
    ctx.strokeStyle = ok ? '#5dff72' : '#ff5d5d'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    const cx = isoX(tx + D.size / 2, ty + D.size / 2), cy = isoY(tx + D.size / 2, ty + D.size / 2);
    ctx.globalAlpha = .6; const sp = bSprite(buildType, 0); ctx.drawImage(sp, isoX(tx, ty) - sp.ox, isoY(tx, ty) - sp.oy, sp.lw, sp.lh); ctx.globalAlpha = 1;
    if (D.range) { ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy, D.range * TILE, D.range * TILE / 2, 0, 0, 7); ctx.stroke(); }
    ghost = { tx, ty, ok };
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * .45, VW / 2, VH / 2, Math.max(VW, VH) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (dragBox) {
    const x = Math.min(dragBox.x0, dragBox.x1), y = Math.min(dragBox.y0, dragBox.y1), w = Math.abs(dragBox.x1 - dragBox.x0), h = Math.abs(dragBox.y1 - dragBox.y0);
    ctx.fillStyle = 'rgba(93,255,114,.1)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#5dff72'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w, h);
  }
  renderMinimap();
}

/* ---------- Minimapa en rombo ---------- */
const MMK = () => mm.width / (MAP_W + MAP_H);
const mmX = (tx, ty) => MMK() * (tx - ty + MAP_H), mmY = (tx, ty) => MMK() * (tx + ty) / 2;
function renderMinimap() {
  const k = MMK();
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, mm.width, mm.height);
  mctx.setTransform(k, k / 2, -k, k / 2, k * MAP_H, 0);
  mctx.imageSmoothingEnabled = true; mctx.drawImage(mmTerrain, 0, 0, MAP_W, MAP_H);
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const n of G.nodes) {
    if (n.dead || G.vis[n.y * MAP_W + n.x] === 0) continue;
    mctx.fillStyle = { tree: '#1c4a20', berry: '#d02a48', gold: '#ffd23a', stone: '#b8bcc4' }[n.type]; mctx.fillRect(mmX(n.x + .5, n.y + .5) - 1, mmY(n.x + .5, n.y + .5) - 1, 2.4, 2);
  }
  for (const a of G.animals) { if (a.dead || !visibleAt(a.x, a.y)) continue; mctx.fillStyle = '#e8c88a'; mctx.fillRect(mmX(a.x, a.y) - 1, mmY(a.x, a.y) - 1, 2, 2); }
  for (const b of G.buildings) {
    if (b.dead || (b.owner !== 0 && G.vis[(b.y + 1) * MAP_W + b.x + 1] === 0)) continue;
    mctx.fillStyle = PCOL[b.owner]; mctx.strokeStyle = '#000'; mctx.lineWidth = .7;
    mctx.beginPath(); mctx.moveTo(mmX(b.x, b.y), mmY(b.x, b.y)); mctx.lineTo(mmX(b.x + b.w, b.y), mmY(b.x + b.w, b.y)); mctx.lineTo(mmX(b.x + b.w, b.y + b.h), mmY(b.x + b.w, b.y + b.h)); mctx.lineTo(mmX(b.x, b.y + b.h), mmY(b.x, b.y + b.h)); mctx.closePath(); mctx.fill(); mctx.stroke();
  }
  for (const u of G.units) {
    if (u.dead || (u.owner !== 0 && !visibleAt(u.x, u.y))) continue;
    mctx.fillStyle = PCOL[u.owner]; mctx.fillRect(mmX(u.x, u.y) - 1.3, mmY(u.x, u.y) - 1.3, 2.8, 2.8);
  }
  mctx.setTransform(k, k / 2, -k, k / 2, k * MAP_H, 0); mctx.globalAlpha = .92; mctx.drawImage(fogCanvas, 0, 0, MAP_W, MAP_H); mctx.globalAlpha = 1;
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const f of G.fx) if (f.type === 'ping') { mctx.strokeStyle = '#ff4444'; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(mmX(f.x, f.y), mmY(f.x, f.y), 4 + (f.t * 8) % 14, 0, 7); mctx.stroke(); }
  // marco de la cámara
  const c = [[0, 0], [VW, 0], [VW, VH - BOTTOM_H], [0, VH - BOTTOM_H]].map(p => { const t = s2t(p[0], p[1]); return [mmX(t.x, t.y), mmY(t.x, t.y)]; });
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 1.5; mctx.beginPath(); c.forEach((p, i) => i ? mctx.lineTo(p[0], p[1]) : mctx.moveTo(p[0], p[1])); mctx.closePath(); mctx.stroke();
}
