'use strict';
/* ============ Sprites en alta resolución (se hornean una vez y se cachean) ============ */
const SC = 2;
function bake(w, h, fn) {
  const c = document.createElement('canvas'); c.width = Math.ceil(w * SC); c.height = Math.ceil(h * SC); c.lw = w; c.lh = h;
  const g = c.getContext('2d'), prev = ctx; ctx = g; g.scale(SC, SC);
  try { fn(g); } finally { ctx = prev; }
  return c;
}
const SPR = {}, TEX = {}, BSPR = {}, USPR = new Map();
function mkPattern(w, h, fn) {
  const c = bake(w, h, fn), p = MAINCTX.createPattern(c, 'repeat');
  p.setTransform(new DOMMatrix([1 / SC, 0, 0, 1 / SC, 0, 0])); return p;
}
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;

function buildTextures() {
  const R = mulberry32(31);
  TEX.stone = mkPattern(64, 64, g => {
    g.fillStyle = '#5b5242'; g.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 8; r++) {
      const y = r * 8, off = (r % 2) * 8;
      for (let x = -8 + off; x < 64; x += 16) {
        const l = .82 + R() * .3;
        g.fillStyle = rgb(198 * l, 186 * l, 162 * l); g.fillRect(x + .8, y + .8, 14.4, 6.4);
        g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x + .8, y + .8, 14.4, 1);
        g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x + .8, y + 6.2, 14.4, 1);
        if (R() < .25) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 2 + R() * 8, y + 2 + R() * 3, 3 + R() * 4, 1); }
      }
    }
    for (let i = 0; i < 280; i++) { g.fillStyle = `rgba(${R() < .5 ? 0 : 255},${R() < .5 ? 0 : 255},${R() < .5 ? 0 : 255},.06)`; g.fillRect(R() * 64, R() * 64, 1 + R() * 1.5, 1); }
  });
  TEX.wood = mkPattern(64, 64, g => {
    for (let x = 0; x < 64; x += 8) {
      const l = .8 + R() * .35;
      g.fillStyle = rgb(152 * l, 110 * l, 68 * l); g.fillRect(x, 0, 8, 64);
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x + 7, 0, 1, 64); g.fillStyle = 'rgba(255,230,180,.12)'; g.fillRect(x, 0, 1, 64);
      for (let k = 0; k < 6; k++) { g.strokeStyle = 'rgba(60,35,15,.22)'; g.lineWidth = .8; g.beginPath(); const a = x + 1 + R() * 6; g.moveTo(a, 0); g.bezierCurveTo(a + R() * 2 - 1, 20, a + R() * 2 - 1, 40, a + R() * 2 - 1, 64); g.stroke(); }
      if (R() < .5) { g.fillStyle = 'rgba(40,25,10,.4)'; g.beginPath(); g.ellipse(x + 4, R() * 60 + 2, 1.4, 2.4, 0, 0, 7); g.fill(); }
      g.fillStyle = '#2a1a0c'; g.fillRect(x + 3, 6, 1.6, 1.6); g.fillRect(x + 3, 56, 1.6, 1.6);
    }
  });
  TEX.plaster = mkPattern(32, 32, g => {
    g.fillStyle = '#e8dbb8'; g.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(${R() < .5 ? 90 : 255},${R() < .5 ? 70 : 250},${R() < .5 ? 40 : 220},.09)`; g.fillRect(R() * 32, R() * 32, 1 + R() * 2, 1 + R()); }
  });
  TEX.roof = PCOL.map(c => mkPattern(48, 40, g => {
    g.fillStyle = shade(c, -.55); g.fillRect(0, 0, 48, 40);
    for (let r = 0; r < 5; r++) {
      const y = r * 8, off = (r % 2) * 6;
      for (let x = -6 + off; x < 48; x += 12) {
        const l = R() * .22 - .11, gr = g.createLinearGradient(0, y, 0, y + 9);
        gr.addColorStop(0, shade(c, .3 + l)); gr.addColorStop(.7, shade(c, 0 + l)); gr.addColorStop(1, shade(c, -.28 + l));
        g.fillStyle = gr; g.beginPath(); g.moveTo(x + .5, y); g.lineTo(x + 11.5, y); g.lineTo(x + 11.5, y + 6); g.quadraticCurveTo(x + 6, y + 10.5, x + .5, y + 6); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = .7; g.stroke();
        g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x + 1.5, y + .8, 9, .9);
      }
    }
  }));
  TEX.soil = mkPattern(32, 32, g => {
    g.fillStyle = '#6e4e2c'; g.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 220; i++) { const l = R(); g.fillStyle = l < .5 ? 'rgba(30,18,8,.18)' : 'rgba(180,130,80,.14)'; g.fillRect(R() * 32, R() * 32, 1 + R() * 2, 1 + R()); }
  });
}

/* ---------- Auxiliares de dibujo ---------- */
function texRect(x, y, w, h, pat, tint) {
  ctx.fillStyle = pat; ctx.fillRect(x, y, w, h);
  if (tint) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tint; ctx.fillRect(x, y, w, h); ctx.restore(); }
}
function lightRect(x, y, w, h, a, b) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, `rgba(255,248,220,${a})`); g.addColorStop(.5, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(10,5,0,${b})`);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}
function aoRect(x, y, w, h) {
  let g = ctx.createLinearGradient(0, y, 0, y + 9); g.addColorStop(0, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, 9);
  g = ctx.createLinearGradient(0, y + h - 12, 0, y + h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.38)'); ctx.fillStyle = g; ctx.fillRect(x, y + h - 12, w, 12);
}
function archPath(x, y, w, h) { const r = w / 2; ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); }
function archWin(x, y, w, h) {
  ctx.fillStyle = '#d9d0b8'; archPath(x - 1.4, y - 1.4, w + 2.8, h + 2.8); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#5a7a96'); g.addColorStop(1, '#1c2a3a');
  ctx.fillStyle = g; archPath(x, y, w, h); ctx.fill();
  ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h * .5); ctx.lineTo(x + w, y + h * .5); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = .8; archPath(x - 1.4, y - 1.4, w + 2.8, h + 2.8); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x + 1, y + h * .55, w * .35, 1.2);
}
function archDoor(cx, bottom, w, h, bigX) {
  const x = cx - w / 2, y = bottom - h;
  ctx.fillStyle = '#d6cdb4'; archPath(x - 2.2, y - 2.2, w + 4.4, h + 2.2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.save(); archPath(x, y, w, h); ctx.clip(); texRect(x, y, w, h, TEX.wood, '#b89a78');
  const g = ctx.createLinearGradient(0, y, 0, bottom); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(.35, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = '#25201c'; ctx.lineWidth = 1.5; for (const k of [.35, .7]) { ctx.beginPath(); ctx.moveTo(x, y + h * k); ctx.lineTo(x + w, y + h * k); ctx.stroke(); }
  ctx.fillStyle = '#4a4440'; for (const k of [.35, .7]) for (const sx of [.15, .85]) { ctx.beginPath(); ctx.arc(x + w * sx, y + h * k, .9, 0, 7); ctx.fill(); }
  ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, y + 2); ctx.lineTo(cx, bottom); ctx.stroke();
  if (bigX) { ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 1, y + h * .2); ctx.lineTo(x + w - 1, bottom - 1); ctx.moveTo(x + w - 1, y + h * .2); ctx.lineTo(x + 1, bottom - 1); ctx.stroke(); }
  ctx.fillStyle = '#c9c0a6'; ctx.fillRect(x - 3, bottom, w + 6, 2.2); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 3, bottom + 2.2, w + 6, 1);
}
function groundShadow(pw, ph) {
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.moveTo(4, ph - 2); ctx.lineTo(pw + 6, ph - 2); ctx.lineTo(pw + 16, ph + 8); ctx.lineTo(12, ph + 8); ctx.fill();
}
function shieldShape(x, y, s, c) {
  ctx.fillStyle = c; ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y + s * .3); ctx.lineTo(x, y + s * 1.5); ctx.lineTo(x - s, y + s * .3); ctx.closePath(); ctx.fill(); ctx.stroke();
}
function banner(x, y, w, h, c) {
  ctx.fillStyle = c; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w / 2, y + h - 4); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f2c230'; ctx.fillRect(x, y, w, 2);
}
function roofCone(cx, baseY, hw, hgt, owner) {
  ctx.save(); ctx.beginPath(); ctx.moveTo(cx - hw, baseY); ctx.lineTo(cx, baseY - hgt); ctx.lineTo(cx + hw, baseY); ctx.closePath(); ctx.clip();
  texRect(cx - hw, baseY - hgt, hw * 2, hgt, TEX.roof[owner]); lightRect(cx - hw, baseY - hgt, hw * 2, hgt, .25, .45);
  ctx.restore(); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx - hw, baseY); ctx.lineTo(cx, baseY - hgt); ctx.lineTo(cx + hw, baseY); ctx.closePath(); ctx.stroke();
}

/* ---------- Edificios isométricos (hornados una vez) ---------- */
let BX = 0, BY = 0;
const pj = (X, Y, Z) => [BX + X - Y, BY + (X + Y) / 2 - Z];
function polyPath(pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
function planeFill(pts, pat, o, d1, d2, tint, over) {
  ctx.save(); polyPath(pts); ctx.clip();
  ctx.transform(d1[0], d1[1], d2[0], d2[1], o[0], o[1]);
  ctx.fillStyle = pat; ctx.fillRect(-400, -400, 1000, 1000);
  if (tint) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tint; ctx.fillRect(-400, -400, 1000, 1000); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
  if (over) { polyPath(pts); ctx.fillStyle = over; ctx.fill(); }
}
function outline(pts, a) { polyPath(pts); ctx.strokeStyle = `rgba(0,0,0,${a || .6})`; ctx.lineWidth = 1.3; ctx.lineJoin = 'round'; ctx.stroke(); }
function shadowFoot(P, len) {
  for (const k of [1, .6]) { const dx = len * k, dy = len * k * .5; ctx.fillStyle = 'rgba(0,0,0,.14)'; polyPath([pj(0, 0, 0), pj(P, 0, 0), pj(P, P, 0), pj(0, P, 0)].map(p => [p[0] + dx, p[1] + dy])); ctx.fill(); }
}
function wallRight(B, H, apex, pat, tint) {
  const m = (B.y0 + B.y1) / 2, pts = [pj(B.x1, B.y0, 0), pj(B.x1, B.y1, 0), pj(B.x1, B.y1, H)];
  if (apex) pts.push(pj(B.x1, m, H + apex)); pts.push(pj(B.x1, B.y0, H));
  planeFill(pts, pat, pj(B.x1, B.y0, H), [-1, .5], [0, 1], tint, 'rgba(0,0,35,.36)'); outline(pts);
}
function wallLeft(B, H, pat, tint) {
  const pts = [pj(B.x0, B.y1, 0), pj(B.x1, B.y1, 0), pj(B.x1, B.y1, H), pj(B.x0, B.y1, H)];
  planeFill(pts, pat, pj(B.x0, B.y1, H), [1, .5], [0, 1], tint, 'rgba(0,0,0,.03)'); outline(pts);
}
function onRight(B, H, fn) { const o = pj(B.x1, B.y0, H); ctx.save(); ctx.transform(-1, .5, 0, 1, o[0], o[1]); fn(B.y1 - B.y0); ctx.restore(); }
function onLeft(B, H, fn) { const o = pj(B.x0, B.y1, H); ctx.save(); ctx.transform(1, .5, 0, 1, o[0], o[1]); fn(B.x1 - B.x0); ctx.restore(); }
function timberFrame(w, H) {
  ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 2.6; ctx.beginPath();
  ctx.moveTo(1, 0); ctx.lineTo(1, H); ctx.moveTo(w - 1, 0); ctx.lineTo(w - 1, H); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, H); ctx.moveTo(0, H * .45); ctx.lineTo(w, H * .45); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1, H * .45); ctx.lineTo(w * .28, 1); ctx.moveTo(w - 1, H * .45); ctx.lineTo(w * .72, 1); ctx.moveTo(w / 2, H * .45); ctx.lineTo(w * .3, H - 1); ctx.moveTo(w / 2, H * .45); ctx.lineTo(w * .7, H - 1); ctx.stroke();
}
function roofGable(B, H, RH, owner, ov) {
  ov = ov == null ? 6 : ov; const ym = (B.y0 + B.y1) / 2, hd = (B.y1 - B.y0) / 2, zR = H + RH, sl = RH / hd, zE = zR - sl * (hd + ov);
  const pts = [pj(B.x0 - ov, ym, zR), pj(B.x1 + ov, ym, zR), pj(B.x1 + ov, B.y1 + ov, zE), pj(B.x0 - ov, B.y1 + ov, zE)];
  planeFill(pts, TEX.roof[owner], pj(B.x0 - ov, ym, zR), [1, .5], [-1, .5 + sl], null, null);
  const g = ctx.createLinearGradient(pts[3][0], pts[3][1], pts[1][0], pts[1][1]); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.3)');
  polyPath(pts); ctx.fillStyle = g; ctx.fill(); outline(pts, .75);
  ctx.strokeStyle = shade(PCOL[owner], .55); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pts[3][0], pts[3][1] + 1); ctx.lineTo(pts[2][0], pts[2][1] + 1); ctx.stroke();
}
function roofHip(B, H, RH, owner, ov) {
  ov = ov == null ? 6 : ov; const w = B.x1 - B.x0, a = w * .28, ym = (B.y0 + B.y1) / 2, hd = (B.y1 - B.y0) / 2, zR = H + RH, sF = RH / hd, zE = zR - sF * (hd + ov);
  const f = [pj(B.x0 - ov, B.y1 + ov, zE), pj(B.x1 + ov, B.y1 + ov, zE), pj(B.x1 - a, ym, zR), pj(B.x0 + a, ym, zR)];
  planeFill(f, TEX.roof[owner], pj(B.x0 - ov, B.y1 + ov, zE), [1, .5], [1, -.5 - sF], null, null);
  let g = ctx.createLinearGradient(f[0][0], f[0][1], f[1][0], f[1][1]); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(0,0,0,.18)');
  polyPath(f); ctx.fillStyle = g; ctx.fill(); outline(f, .75);
  const sX = (zR - zE) / (a + ov), r = [pj(B.x1 + ov, B.y0 - ov, zE), pj(B.x1 + ov, B.y1 + ov, zE), pj(B.x1 - a, ym, zR)];
  planeFill(r, TEX.roof[owner], pj(B.x1 + ov, B.y0 - ov, zE), [-1, .5], [-1, -.5 - sX], null, 'rgba(0,0,35,.34)'); outline(r, .75);
  ctx.strokeStyle = shade(PCOL[owner], .55); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(f[3][0], f[3][1]); ctx.lineTo(f[2][0], f[2][1]); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f[0][0], f[0][1] + 1); ctx.lineTo(f[1][0], f[1][1] + 1); ctx.lineTo(r[0][0], r[0][1] + 1); ctx.stroke();
}
function cyl(X, Y, r, h, topR, pat, tint, z0) {
  const c = pj(X, Y, z0 || 0), cx = c[0], yb = c[1], yt = yb - h;
  const path = () => { ctx.beginPath(); ctx.moveTo(cx - topR, yt); ctx.lineTo(cx - r, yb); ctx.ellipse(cx, yb, r, r / 2, 0, Math.PI, 0, true); ctx.lineTo(cx + topR, yt); ctx.ellipse(cx, yt, topR, topR / 2, 0, 0, Math.PI, true); ctx.closePath(); };
  ctx.save(); path(); ctx.clip(); ctx.fillStyle = pat; ctx.fillRect(cx - r - 2, yt - r, r * 2 + 4, h + r * 2);
  if (tint) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tint; ctx.fillRect(cx - r - 2, yt - r, r * 2 + 4, h + r * 2); ctx.globalCompositeOperation = 'source-over'; }
  const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0); g.addColorStop(0, 'rgba(255,248,220,.3)'); g.addColorStop(.35, 'rgba(255,255,255,.08)'); g.addColorStop(.75, 'rgba(0,0,20,.28)'); g.addColorStop(1, 'rgba(0,0,30,.58)');
  ctx.fillStyle = g; ctx.fillRect(cx - r - 2, yt - r, r * 2 + 4, h + r * 2);
  const ao = ctx.createLinearGradient(0, yb - 14, 0, yb + r); ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,.4)'); ctx.fillStyle = ao; ctx.fillRect(cx - r - 2, yb - 14, r * 2 + 4, 14 + r);
  ctx.restore(); path(); ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 1.3; ctx.stroke();
  return { cx, yt, yb };
}
function coneRoof(cx, yBase, r, hgt, owner) {
  const path = () => { ctx.beginPath(); ctx.moveTo(cx - r, yBase); ctx.lineTo(cx, yBase - hgt); ctx.lineTo(cx + r, yBase); ctx.ellipse(cx, yBase, r, r / 2, 0, 0, Math.PI); ctx.closePath(); };
  ctx.save(); path(); ctx.clip(); ctx.fillStyle = TEX.roof[owner]; ctx.fillRect(cx - r, yBase - hgt, r * 2, hgt + r);
  const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0); g.addColorStop(0, 'rgba(255,255,255,.3)'); g.addColorStop(.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,30,.5)'); ctx.fillStyle = g; ctx.fillRect(cx - r, yBase - hgt, r * 2, hgt + r);
  ctx.restore(); path(); ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 1.3; ctx.stroke();
}
function merlons(cx, yt, r, n, pat) {
  for (let i = 0; i < n; i++) { const a = Math.PI * (.1 + .8 * i / (n - 1)), x = cx + Math.cos(a) * r * .92, y = yt + Math.sin(a) * r * .46; ctx.fillStyle = pat; ctx.fillRect(x - 2.4, y - 7, 4.8, 8); ctx.fillStyle = 'rgba(255,248,220,.2)'; ctx.fillRect(x - 2.4, y - 7, 1.8, 8); ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 1; ctx.strokeRect(x - 2.4, y - 7, 4.8, 8); }
}
function prop(X, Y, fn) { const p = pj(X, Y, 0); ctx.save(); ctx.translate(p[0], p[1]); fn(); ctx.restore(); }
function logPile(n) { for (let i = 0; i < n; i++) { const x = (i % 3) * 8 - 8 + (i > 2 ? 4 : 0), y = -3 - Math.floor(i / 3) * 6; blob(ctx, x, y, 4.6, '#b88858', '#6a4422'); ctx.strokeStyle = '#e8cc9c'; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(x, y, 2.3, 0, 7); ctx.stroke(); } }
function hay(x, y) { ctx.fillStyle = '#e8cc58'; ctx.strokeStyle = 'rgba(80,50,0,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y - 4, 7, 5, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(120,80,10,.6)'; ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y - 3); ctx.moveTo(x - 4, y - 2); ctx.lineTo(x + 5, y - 6); ctx.stroke(); }
function targetStand() { ctx.strokeStyle = '#5a3c1c'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(0, -22); ctx.lineTo(8, 0); ctx.stroke(); for (let i = 3; i >= 0; i--) { ctx.fillStyle = i % 2 ? '#f4f0e4' : '#d83a2a'; ctx.beginPath(); ctx.ellipse(0, -24, 3 + i * 2.5, 3.6 + i * 2.7, 0, 0, 7); ctx.fill(); } ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.ellipse(0, -24, 10.5, 11.3, 0, 0, 7); ctx.stroke(); ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(1, -25); ctx.lineTo(9, -30); ctx.stroke(); }
function post(X, Y, h, col) { const a = pj(X, Y, 0), b = pj(X, Y, h); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.strokeStyle = col || '#7a5230'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }

const BH = { house: [24, 22], barracks: [32, 24], archery: [24, 22], stable: [24, 24], lumber: [18, 12], mining: [14, 10], mill: [44, 26], tower: [72, 0], tc: [40, 26], farm: [0, 0] };
function bSimple(T, P, owner) {
  const B = { x0: 4, y0: 4, x1: P - 4, y1: P - 4 }, col = PCOL[owner], [H, RH] = BH[T];
  shadowFoot(P, T === 'house' ? 16 : 22);
  const pat = T === 'house' ? TEX.plaster : (T === 'stable' || T === 'archery') ? TEX.wood : TEX.stone;
  const tint = { barracks: '#e4e0d8', archery: '#f0e0c0', stable: '#f0e0c8', mining: '#a8a29a' }[T];
  if (T === 'lumber') { // cobertizo abierto
    post(B.x0 + 4, B.y0 + 4, H); post(B.x1 - 4, B.y0 + 4, H);
    prop(P * .45, P * .35, () => logPile(6));
    post(B.x0 + 4, B.y1 - 4, H); post(B.x1 - 4, B.y1 - 4, H);
    roofGable(B, H, RH, owner, 7);
    prop(P * .22, P * .8, () => { blob(ctx, 0, -4, 6, '#8a6038', '#4a2e14'); ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(9, -20); ctx.stroke(); ctx.fillStyle = '#c8ccd2'; ctx.strokeStyle = '#222'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(6, -21); ctx.lineTo(14, -18); ctx.lineTo(10, -12); ctx.closePath(); ctx.fill(); ctx.stroke(); });
    prop(P * .82, P * .78, () => logPile(5));
    return;
  }
  wallLeft(B, H, pat, tint); wallRight(B, H, RH, pat, tint);
  onLeft(B, H, w => {
    aoRect(0, 0, w, H);
    if (T === 'house') { timberFrame(w, H); archWin(w * .16, H * .18, 8, 11); archWin(w * .72, H * .18, 8, 11); archDoor(w / 2, H, 12, H * .66); ctx.fillStyle = '#6a4424'; ctx.fillRect(w * .16 - 2, H * .18 + 12, 12, 3); for (let i = 0; i < 4; i++) blob(ctx, w * .16 + i * 3 + .5, H * .18 + 11, 1.7, i % 2 ? '#ff7a9a' : '#ffd84a', '#c04060'); }
    else if (T === 'barracks') { archDoor(w / 2, H, 22, H * .74); archWin(w * .13, H * .2, 8, 11); archWin(w * .79 - 4, H * .2, 8, 11); shieldShape(w * .27, H * .38, 5, col); shieldShape(w * .73, H * .38, 5, col); ctx.fillStyle = col; ctx.fillRect(w / 2 - 5, 2, 10, 5); }
    else if (T === 'archery') { archDoor(w / 2, H, 14, H * .62); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; for (const k of [.18, .8]) { ctx.beginPath(); ctx.rect(w * k - 5, H * .22, 10, 6); ctx.stroke(); } ctx.fillStyle = col; ctx.fillRect(w * .2, H * .1, 8, 3); }
    else if (T === 'stable') { archDoor(w / 2, H, 28, H * .78, true); ctx.fillStyle = '#2a1a0c'; ctx.fillRect(w * .15, H * .15, 9, 7); ctx.fillStyle = '#d8b858'; ctx.fillRect(w * .15 + 1, H * .15 + 4, 7, 3); }
    else if (T === 'mining') { ctx.fillStyle = '#0c0a08'; ctx.fillRect(w / 2 - 11, H - 15, 22, 15); ctx.strokeStyle = '#6a4a26'; ctx.lineWidth = 3; ctx.strokeRect(w / 2 - 11, H - 15, 22, 15); ctx.beginPath(); ctx.moveTo(w / 2 - 15, H - 15); ctx.lineTo(w / 2 + 15, H - 15); ctx.stroke(); }
  });
  onRight(B, H, w => { aoRect(0, 0, w, H); if (T === 'house') timberFrame(w, H); if (T === 'house' || T === 'barracks') { archWin(w * .3, H * .22, 8, 11); archWin(w * .62, H * .22, 8, 11); } });
  // tejado
  if (T === 'barracks') roofHip(B, H, RH, owner, 6); else roofGable(B, H, RH, owner, T === 'stable' ? 8 : 6);
  if (T === 'house') { const c = pj(P * .66, P * .36, H + RH * .78); ctx.fillStyle = '#8a7e70'; ctx.fillRect(c[0] - 4, c[1] - 14, 8, 14); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(c[0] - 4, c[1] - 14, 2.5, 14); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.strokeRect(c[0] - 4, c[1] - 14, 8, 14); ctx.fillStyle = '#2a2420'; ctx.fillRect(c[0] - 3, c[1] - 15, 6, 2.5); }
  if (T === 'barracks') { prop(P * .93, P * .22, () => { ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 2; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-6 + i * 5, 2); ctx.lineTo(-4 + i * 5, -24); ctx.stroke(); ctx.fillStyle = '#dfe6ec'; ctx.beginPath(); ctx.moveTo(-5.5 + i * 5, -24); ctx.lineTo(-4 + i * 5, -30); ctx.lineTo(-2.5 + i * 5, -24); ctx.fill(); } ctx.strokeStyle = '#5a3c1c'; ctx.beginPath(); ctx.moveTo(-9, -8); ctx.lineTo(11, -10); ctx.stroke(); }); prop(P * .1, P * .92, () => { ctx.strokeStyle = '#5a3c1c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -22); ctx.moveTo(-7, -17); ctx.lineTo(7, -17); ctx.stroke(); blob(ctx, 0, -25, 5, '#d8c080', '#8a6a30'); }); }
  if (T === 'archery') { prop(P * .96, P * .3, targetStand); prop(P * .28, P * .98, targetStand); prop(P * .72, P * 1.02, () => { hay(0, 0); hay(10, 2); }); }
  if (T === 'stable') { prop(P * .15, P * 1.04, () => { hay(0, 0); hay(10, 3); hay(5, -6); }); for (let x = P * .45; x <= P; x += 14) post(x, P + 6, 11, '#8a6030'); const a = pj(P * .45, P + 6, 8), b = pj(P, P + 6, 8); ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  if (T === 'mining') { prop(P * .15, P * .95, () => { blob(ctx, 0, -4, 6, '#b6bbc0', '#585c62'); blob(ctx, 9, -2, 4.5, '#b6bbc0', '#585c62'); blob(ctx, 3, -9, 3.6, '#fff2a0', '#d89a10'); }); prop(P * .9, P * .75, () => { ctx.fillStyle = '#5a4026'; ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 1; ctx.fillRect(-9, -9, 18, 8); ctx.strokeRect(-9, -9, 18, 8); blob(ctx, -5, -1, 2.6, '#777', '#222'); blob(ctx, 5, -1, 2.6, '#777', '#222'); blob(ctx, 0, -11, 4, '#fff2a0', '#d89a10'); }); }
}
function bTC(P, owner) {
  const col = PCOL[owner];
  planeFill([pj(0, 0, 0), pj(P, 0, 0), pj(P, P, 0), pj(0, P, 0)], TEX.stone, pj(0, 0, 0), [1, .5], [-1, .5], '#c8c0b0', null); outline([pj(0, 0, 0), pj(P, 0, 0), pj(P, P, 0), pj(0, P, 0)], .5);
  shadowFoot(P, 30);
  const tower = (X, Y) => { const t = cyl(X, Y, 11, 56, 11, TEX.stone, '#dcdce4'); ctx.fillStyle = '#16161a'; ctx.fillRect(t.cx - 1.6, t.yt + 16, 3.2, 9); ctx.fillRect(t.cx - 1.6, t.yt + 34, 3.2, 8); coneRoof(t.cx, t.yt, 14, 28, owner); };
  tower(14, 14);
  const K = { x0: 24, y0: 24, x1: P - 24, y1: P - 24 }, H = 40, RH = 26;
  wallLeft(K, H, TEX.stone, '#fff2dc'); wallRight(K, H, 0, TEX.stone, '#fff2dc');
  onLeft(K, H, w => {
    aoRect(0, 0, w, H); archDoor(w / 2, H, 28, H * .72);
    for (const k of [.14, .84]) archWin(w * k - 4, H * .2, 8, 12);
    for (let y = 0; y < H - 4; y += 8) for (const x of [0, w - 7]) { ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x, y, 7, 7.2); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = .7; ctx.strokeRect(x, y, 7, 7.2); }
    banner(w * .27, 2, 9, 24, col); banner(w * .73 - 9, 2, 9, 24, col);
  });
  onRight(K, H, w => { aoRect(0, 0, w, H); archWin(w * .25, H * .2, 8, 12); archWin(w * .6, H * .2, 8, 12); });
  roofHip(K, H, RH, owner, 7);
  tower(P - 14, 14); tower(14, P - 14); tower(P - 14, P - 14);
  prop(P * .5, P * .96, () => { for (const x of [-18, 18]) { ctx.fillStyle = '#5a4a38'; ctx.fillRect(x - 1.5, -16, 3, 16); blob(ctx, x, -17, 2.8, '#ffd870', '#ff7a10'); } });
}
function bTower(P, owner) {
  const col = PCOL[owner];
  shadowFoot(P, 24);
  const t = cyl(P / 2, P / 2, 20, 60, 19, TEX.stone, '#d0d2d8');
  ctx.fillStyle = '#14141a'; for (const y of [t.yt + 14, t.yt + 30]) ctx.fillRect(t.cx - 1.6, y, 3.2, 10);
  archDoor(t.cx, t.yb + 8, 11, 17);
  const h = cyl(P / 2, P / 2, 25, 11, 25, TEX.wood, '#d8c0a0', 56);
  for (let i = 0; i < 3; i++) { const a = Math.PI * (.2 + .6 * i / 2), x = h.cx + Math.cos(a) * 22, y = h.yb + Math.sin(a) * 11 - 5; ctx.fillStyle = col; ctx.strokeStyle = '#111'; ctx.lineWidth = .8; ctx.beginPath(); ctx.ellipse(x, y, 3.6, 4.4, 0, 0, 7); ctx.fill(); ctx.stroke(); }
  merlons(h.cx, h.yt, 25, 7, TEX.stone);
}
function bMill(P, owner) {
  shadowFoot(P, 20);
  const t = cyl(P / 2, P / 2, 21, 44, 14, TEX.stone, '#f2ead8');
  archDoor(t.cx, t.yb + 9, 9, 14); archWin(t.cx - 3, t.yt + 14, 6, 9);
  coneRoof(t.cx, t.yt, 19, 28, owner);
  prop(P * .2, P * .9, () => { blob(ctx, 0, -4, 5, '#f2ead8', '#a89a78'); blob(ctx, 9, -2, 4.5, '#f2ead8', '#a89a78'); });
  prop(P * .92, P * .8, () => { ctx.fillStyle = '#6a4424'; ctx.fillRect(-4, -11, 8, 11); ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 1; ctx.strokeRect(-4, -11, 8, 11); });
}
function bFarm(P) {
  const pts = [pj(1, 1, 0), pj(P - 1, 1, 0), pj(P - 1, P - 1, 0), pj(1, P - 1, 0)];
  planeFill(pts, TEX.soil, pj(1, 1, 0), [1, .5], [-1, .5], null, null);
  ctx.save(); polyPath(pts); ctx.clip(); const rows = 7;
  for (let i = 0; i < rows; i++) { const Y = 4 + i * (P - 8) / rows, a = pj(2, Y, 0), b = pj(P - 2, Y, 0), c = pj(P - 2, Y + 4, 0), d = pj(2, Y + 4, 0); polyPath([a, b, c, d]); ctx.fillStyle = 'rgba(20,10,0,.38)'; ctx.fill(); ctx.strokeStyle = 'rgba(190,140,90,.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  ctx.restore(); outline(pts, .5);
  for (let t = 0; t <= P; t += 12) { post(t, 0, 8, '#8a6030'); post(0, t, 8, '#8a6030'); }
  for (const [a, b] of [[[0, 0], [P, 0]], [[0, 0], [0, P]]]) { const p = pj(a[0], a[1], 6), q = pj(b[0], b[1], 6); ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
}
function bSprite(type, owner) {
  const key = type + owner; if (BSPR[key]) return BSPR[key];
  const D = BUILDINGS[type], P = D.size * TILE, ox = P + 44, oy = 122;
  const c = bake(2 * P + 88, oy + P + 36, g => {
    BX = ox; BY = oy;
    if (type === 'farm') bFarm(P); else if (type === 'tc') bTC(P, owner); else if (type === 'tower') bTower(P, owner); else if (type === 'mill') bMill(P, owner); else bSimple(type, P, owner);
  });
  c.ox = ox; c.oy = oy; return (BSPR[key] = c);
}

/* ---------- Figuras 3D de unidades (proyección isométrica en vivo) ---------- */
const FG = { C: 1, S: 0, list: [] };
function fp(f, r, z) { const wx = f * FG.C - r * FG.S, wy = f * FG.S + r * FG.C; return [wx - wy, (wx + wy) / 2 - z, wx + wy + z * .05]; }
function fcap(a, b, r, col) { FG.list.push({ t: 0, a, b, r, col, d: (a[2] + b[2]) / 2 }); }
function fsph(c, r, col) { FG.list.push({ t: 1, c, r, col, d: c[2] }); }
function fpoly(pts, col, d, edge) { FG.list.push({ t: 2, pts, col, d, edge }); }
function fdisc(c, A, B, rad, col, n) { // disco en el plano generado por A y B (vectores locales f,r,z)
  const pts = []; n = n || 14;
  for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2, ca = Math.cos(t) * rad, sa = Math.sin(t) * rad; pts.push(fp(c[0] + A[0] * ca + B[0] * sa, c[1] + A[1] * ca + B[1] * sa, c[2] + A[2] * ca + B[2] * sa)); }
  fpoly(pts, col, fp(c[0], c[1], c[2])[2] + .3, true);
}
function fbox(f0, f1, r0, r1, z0, z1, col) { // caras visibles de una caja
  const faces = [[[0, 0, 1], [[f0, r0, z1], [f1, r0, z1], [f1, r1, z1], [f0, r1, z1]]], [[1, 0, 0], [[f1, r0, z0], [f1, r1, z0], [f1, r1, z1], [f1, r0, z1]]], [[-1, 0, 0], [[f0, r1, z0], [f0, r0, z0], [f0, r0, z1], [f0, r1, z1]]],
    [[0, 1, 0], [[f1, r1, z0], [f0, r1, z0], [f0, r1, z1], [f1, r1, z1]]], [[0, -1, 0], [[f0, r0, z0], [f1, r0, z0], [f1, r0, z1], [f0, r0, z1]]]];
  for (const [n, vs] of faces) {
    const wnx = n[0] * FG.C - n[1] * FG.S, wny = n[0] * FG.S + n[1] * FG.C;
    if (n[2] <= 0 && wnx + wny <= 0.01) continue;
    const k = n[2] > 0 ? .2 : (wny - wnx) * .16 - .12, pts = vs.map(v => fp(v[0], v[1], v[2])), d = pts.reduce((a, p) => a + p[2], 0) / pts.length;
    fpoly(pts, shade(col, k), d, true);
  }
}
function figFlush() {
  FG.list.sort((a, b) => a.d - b.d);
  for (const p of FG.list) {
    if (p.t === 0) {
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.72)'; ctx.lineWidth = p.r * 2 + 1.4; ctx.beginPath(); ctx.moveTo(p.a[0], p.a[1]); ctx.lineTo(p.b[0], p.b[1]); ctx.stroke();
      ctx.strokeStyle = p.col; ctx.lineWidth = p.r * 2; ctx.beginPath(); ctx.moveTo(p.a[0], p.a[1]); ctx.lineTo(p.b[0], p.b[1]); ctx.stroke();
      if (p.r > 2) { ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = p.r * .7; ctx.beginPath(); ctx.moveTo(p.a[0] - p.r * .35, p.a[1] - p.r * .4); ctx.lineTo(p.b[0] - p.r * .35, p.b[1] - p.r * .4); ctx.stroke(); }
    } else if (p.t === 1) {
      const g = ctx.createRadialGradient(p.c[0] - p.r * .35, p.c[1] - p.r * .4, p.r * .15, p.c[0], p.c[1], p.r); g.addColorStop(0, shade(p.col, .38)); g.addColorStop(1, shade(p.col, -.3));
      ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,.72)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.c[0], p.c[1], p.r, 0, 7); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); p.pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.fillStyle = p.col; ctx.fill();
      if (p.edge) { ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 1; ctx.lineJoin = 'round'; ctx.stroke(); }
    }
  }
  FG.list.length = 0;
}
const SKIN = '#f0c9a0', EYE_Z = 0;
function legs(st, hipZ, spread, col, boot, mount) {
  for (const side of [-1, 1]) {
    const sw = st.moving ? Math.sin(st.ph + (side > 0 ? 0 : Math.PI)) : 0, f = sw * 6, lift = st.moving ? Math.max(0, Math.cos(st.ph + (side > 0 ? 0 : Math.PI))) * 3 : 0;
    fcap(fp(0, side * spread, hipZ), fp(f, side * spread, lift + 1.5), 2.5, col); fsph(fp(f + 1.4, side * spread, lift + 1.5), 3, boot);
  }
}
// herramienta con mango que oscila en el plano (f,z) alrededor de un pivote
function swing(p, kind) {
  // devuelve ángulo (rad) según el progreso p (0..1): preparación, golpe, recuperación
  if (kind === 'chop') { if (p < .55) return .2 + 2.1 * (p / .55); if (p < .72) return 2.3 - 3.0 * ((p - .55) / .17); return -.7 + .9 * ((p - .72) / .28); }
  return Math.sin(p * Math.PI) * 2;
}
function tool(st, type, pivot, ang) {
  const dx = Math.cos(ang), dz = Math.sin(ang), P0 = pivot;
  const at = k => fp(P0[0] + dx * k, P0[1], P0[2] + dz * k);
  fcap(at(-4), at(type === 'hammer' ? 13 : 20), 1.1, '#7a5230');
  const tip = type === 'hammer' ? 13 : 20;
  if (type === 'axe') { fpoly([fp(P0[0] + dx * (tip - 6), P0[1] - 1, P0[2] + dz * (tip - 6)), fp(P0[0] + dx * (tip + 1) - dz * 5, P0[1] - 1, P0[2] + dz * (tip + 1) + dx * 5), fp(P0[0] + dx * (tip + 1) + dz * 5, P0[1] - 1, P0[2] + dz * (tip + 1) - dx * 5)], '#c8ccd2', at(tip)[2] + .5, true); }
  else if (type === 'pick') { fcap(fp(P0[0] + dx * tip - dz * 7, P0[1], P0[2] + dz * tip + dx * 7), fp(P0[0] + dx * tip + dz * 7, P0[1], P0[2] + dz * tip - dx * 7), 1.3, '#b0b6bc'); }
  else if (type === 'hammer') { fcap(fp(P0[0] + dx * 13 - dz * 3.5, P0[1], P0[2] + dz * 13 + dx * 3.5), fp(P0[0] + dx * 13 + dz * 3.5, P0[1], P0[2] + dz * 13 - dx * 3.5), 2.6, '#8a8e94'); }
  else if (type === 'spear') { fcap(at(-8), at(30), 1, '#8a6a3a'); fpoly([at(30), fp(P0[0] + dx * 36, P0[1], P0[2] + dz * 36), fp(P0[0] + dx * 30 - dz * 2, P0[1] + 1.4, P0[2] + dz * 30 + dx * 2)], '#e8eef3', at(30)[2] + .4, true); }
  return at;
}
const FIGS = {};
FIGS.villager = (u, c, dk, st) => {
  const bend = st.bend || 0, bf = bend * 8, bz = bend * 5, br = st.moving || st.act ? 0 : Math.sin(G.t * 2 + u.id) * .35;
  legs(st, 13, 3, '#6b4c2c', '#3a2818');
  if (st.carry) { const cc = { food: '#d04058', wood: '#8a5a2a', gold: '#f5c92a', stone: '#9aa0a6' }[st.carry]; if (st.carry === 'wood') for (let i = -1; i <= 1; i++) fcap(fp(-5.5 - bf * .3, i * 2.4, 17), fp(-8 - bf * .3, i * 2.4, 33), 1.5, '#8a5a2a'); else fsph(fp(-6.5 - bf * .3, 0, 21), 4.8, cc); }
  fcap(fp(bf * .3, 0, 13), fp(bf, 0, 25 - bz), 5.4, c); fcap(fp(bf * .3, 0, 14.6), fp(bf * .4, 0, 15.6), 5.8, '#5a3a1c'); fcap(fp(bf * .8, 0, 22), fp(bf * .9, 0, 23.5), 6, shade(c, .15));
  const hz = 30 - bz * 1.2 + br; fsph(fp(bf + 1.5, 0, hz), 3.9, SKIN); fsph(fp(bf - .8, 0, hz + .6), 3.6, '#6a4a2a');
  fdisc(fp(bf + .6, 0, hz + 3.6), [1, 0, 0], [0, 1, 0], 7.4, '#cfa850'); fsph(fp(bf + .6, 0, hz + 5.2), 3.4, '#e6c670');
  const sh = z => [fp(bf, -5.8, 23.5 - bz), fp(bf, 5.8, 23.5 - bz)];
  const res = st.res;
  if (st.act && (st.build || res === 'wood' || res === 'gold' || res === 'stone')) {
    const ang = swing(st.p, 'chop'), type = st.build ? 'hammer' : res === 'wood' ? 'axe' : 'pick', piv = [5 + bf * .4, 0, 24 - bz], at = tool(st, type, piv, ang);
    for (const k of [2, 9]) { const h = at(k); fcap(fp(bf, -5.8, 23.5 - bz), [h[0] - 1.2, h[1], h[2]], 1.8, c); fcap(fp(bf, 5.8, 23.5 - bz), [h[0] + 1.2, h[1], h[2]], 1.8, c); }
    fsph(at(2), 1.8, SKIN); fsph(at(9), 1.8, SKIN);
  } else if (st.act && res === 'food' && st.farm) { // hoz horizontal
    const a = -.9 + 1.8 * Math.sin(st.p * Math.PI * 2) * .5 + .0, piv = fp(12, 0, 12 - bz * .4), hand = fp(11, 4, 15 - bz), tip = fp(11 + Math.cos(a) * 12, Math.sin(a) * 12, 10);
    fcap(fp(bf, 5.8, 23.5 - bz), hand, 1.8, c); fcap(fp(bf, -5.8, 23.5 - bz), fp(9 + Math.cos(a) * 3, Math.sin(a) * 4 - 2, 14), 1.8, c); fcap(hand, tip, 1, '#7a5230'); fsph(hand, 1.8, SKIN);
    fpoly([tip, fp(11 + Math.cos(a + .6) * 15, Math.sin(a + .6) * 15, 9), fp(11 + Math.cos(a + .3) * 9, Math.sin(a + .3) * 9, 9)], '#c8ccd2', tip[2], true);
  } else if (st.act && res === 'food') { // recoger bayas con ambas manos
    const k = Math.sin(st.p * Math.PI * 2), h1 = fp(13 + bf, 3, 16 + k * 4), h2 = fp(13 + bf, -3, 14 - k * 3);
    fcap(fp(bf, 5.8, 23.5 - bz), h1, 1.8, c); fcap(fp(bf, -5.8, 23.5 - bz), h2, 1.8, c); fsph(h1, 1.8, SKIN); fsph(h2, 1.8, SKIN); fsph(fp(13 + bf, 3, 17 + k * 4), 1.1, '#e8284a');
  } else if (st.act && st.hunt) { // lanza arrojadiza / estocada
    const t = Math.sin(st.p * Math.PI), at = tool(st, 'spear', [4 - t * 4, 4, 25], .15 - t * .1), h = at(2);
    fcap(fp(bf, 5.8, 23.5), [h[0], h[1], h[2]], 1.8, c); fcap(fp(bf, -5.8, 23.5), fp(8 - t * 3, -2, 24), 1.8, c); fsph(h, 1.8, SKIN);
  } else {
    const s = st.moving ? Math.sin(st.ph) * 5 : 0;
    fcap(fp(bf, 5.8, 23.5 - bz), fp(bf + s * .9, 7, 15), 1.8, c); fcap(fp(bf, -5.8, 23.5 - bz), fp(bf - s * .9, -7, 15), 1.8, c); fsph(fp(bf + s * .9, 7, 14.4), 1.8, SKIN); fsph(fp(bf - s * .9, -7, 14.4), 1.8, SKIN);
    if (st.hasSpear) tool(st, 'spear', [4, 7, 17], .25);
  }
};
function soldier(u, c, dk, st, big) {
  const steel = big ? '#8e949e' : '#a8aeb6', s = st.moving ? Math.sin(st.ph) * 5 : 0, k = big ? 1.12 : 1;
  legs(st, 13 * k, 3.2 * k, big ? '#4a4e56' : '#5a4a3a', '#2a2018');
  fpoly([fp(-3, -5, 28 * k), fp(-10 - Math.abs(s) * .5, 0, 14), fp(-3, 5, 28 * k)], dk, fp(-8, 0, 20)[2], true); // capa
  fcap(fp(0, 0, 13 * k), fp(0, 0, 26 * k), (big ? 6.4 : 5.6), big ? steel : c); if (big) fcap(fp(.8, 0, 16), fp(.8, 0, 25), 4.8, c);
  fcap(fp(0, 0, 14.8 * k), fp(0, 0, 15.8 * k), (big ? 6.8 : 6), '#3a2a1a');
  fsph(fp(0, -7, 25 * k), big ? 3.6 : 3, steel); fsph(fp(0, 7, 25 * k), big ? 3.6 : 3, steel);
  const hz = 31 * k; fsph(fp(1, 0, hz), big ? 4.8 : 4.2, big ? '#b0b6be' : '#9ca2aa'); fcap(fp(4, 0, hz + 1), fp(5.5, 0, hz - 2), .8, '#2a2a2a');
  if (big) { fcap(fp(-1, 0, hz + 4), fp(-6, 0, hz + 7 + (st.moving ? Math.sin(st.ph) : 0)), 2, c); } else fcap(fp(-1, 0, hz + 3), fp(-5, 0, hz + 3), 1.2, '#8a2a2a');
  // escudo
  fdisc(fp(2, -8.8, 21 * k), [1, 0, 0], [0, 0, 1], big ? 6.4 : 5.6, shade(c, .12), 16); fdisc(fp(2.4, -9.2, 21 * k), [1, 0, 0], [0, 0, 1], 2, '#c8ccd2', 10); fcap(fp(-2, -9.2, 21 * k), fp(6, -9.2, 21 * k), .7, '#fff');
  // brazo y espada
  const L = big ? 19 : 14, a = st.act ? -1.9 + 3.3 * Math.sin(st.p * Math.PI * .95) : -.55 + (st.moving ? Math.sin(st.ph) * .12 : 0), piv = [3, 7.6, 22 * k];
  const dx = Math.cos(a), dz = Math.sin(a), tip = [piv[0] + dx * L, piv[1], piv[2] + dz * L], hand = fp(piv[0] + dx * 2, piv[1], piv[2] + dz * 2);
  fcap(fp(0, 7.6, 24 * k), hand, 1.9, c); fcap(fp(piv[0] - dx * 2, piv[1], piv[2] - dz * 2), fp(tip[0], tip[1], tip[2]), big ? 1.5 : 1.2, '#eef3f8');
  fcap(fp(piv[0] + dx * 2.4 - dz * 3, piv[1], piv[2] + dz * 2.4 + dx * 3), fp(piv[0] + dx * 2.4 + dz * 3, piv[1], piv[2] + dz * 2.4 - dx * 3), .9, '#d8b040'); fsph(hand, 1.9, SKIN);
}
FIGS.swordsman = (u, c, dk, st) => soldier(u, c, dk, st, false);
FIGS.champion = (u, c, dk, st) => soldier(u, c, dk, st, true);
FIGS.spearman = (u, c, dk, st) => {
  const s = st.moving ? Math.sin(st.ph) * 5 : 0, t = st.act ? Math.sin(st.p * Math.PI) * 9 : 0;
  legs(st, 13, 3, '#5a4a3a', '#2a2018'); fcap(fp(0, 0, 13), fp(0, 0, 26), 5.4, c); fcap(fp(0, 0, 14.8), fp(0, 0, 15.8), 5.8, '#3a2a1a');
  fsph(fp(0, -7, 25), 3, '#c8a878'); fsph(fp(0, 7, 25), 3, '#c8a878');
  const hz = 31; fsph(fp(1, 0, hz), 4.1, SKIN); fsph(fp(1, 0, hz + 1.8), 3.8, '#8a8e96'); fpoly([fp(-2, -3.6, hz + 2), fp(5.6, 0, hz + 1), fp(-2, 3.6, hz + 2), fp(.4, 0, hz + 9)], '#a0a4ac', fp(1, 0, hz + 5)[2], true);
  fdisc(fp(2, -8.4, 21), [1, 0, 0], [0, 0, 1], 5, shade(c, .1), 14);
  const at = tool(st, 'spear', [3 + t, 7, 20], .35 - (st.act ? .15 : 0)); const h = at(1);
  fcap(fp(0, 7, 24), [h[0], h[1], h[2]], 1.9, c); fsph(h, 1.9, SKIN);
};
FIGS.archer = (u, c, dk, st) => {
  const draw = st.act ? Math.sin(st.p * Math.PI * .9) : 0, green = '#46784a';
  legs(st, 13, 3, '#5a4a30', '#2a2018');
  fcap(fp(-5, 1.5, 17), fp(-8, 3.5, 31), 2.4, '#6b4a22'); for (let i = 0; i < 4; i++) fcap(fp(-8.2, 3.5, 31), fp(-9.6 - i * .3, 3.8 + (i - 1.5) * 1.2, 35), .5, i % 2 ? c : '#f0e8d0');
  fcap(fp(0, 0, 13), fp(0, 0, 26), 5.3, green); fcap(fp(.4, 0, 16), fp(.4, 0, 25), 4.2, c); fcap(fp(0, 0, 14.8), fp(0, 0, 15.8), 5.6, '#3a2a1a');
  const hz = 31; fsph(fp(1, 0, hz), 4, SKIN); fsph(fp(-.4, 0, hz + 1), 4.2, green); fcap(fp(-1, 0, hz + 3), fp(-5, 0, hz - 2), 2, green);
  // arco en la mano izquierda, cuerda tirada con la derecha
  const bowF = 9, bz0 = 25, pts = []; for (let i = 0; i <= 8; i++) { const t = -1.15 + 2.3 * i / 8; pts.push(fp(bowF + Math.cos(t) * 9 - 7, -7, bz0 + Math.sin(t) * 11)); }
  for (let i = 0; i < pts.length - 1; i++) fcap(pts[i], pts[i + 1], 1.1, '#7a4a1a');
  const pull = fp(bowF - 7 - draw * 7, -7, bz0); fcap(pts[0], pull, .35, '#eee'); fcap(pull, pts[8], .35, '#eee');
  if (!st.act || st.p < .8) { fcap(pull, fp(bowF + 12, -7, bz0), .6, '#d8c8a0'); fsph(fp(bowF + 12.5, -7, bz0), 1.2, '#c8ccd2'); }
  fcap(fp(0, -5.6, 23.5), fp(bowF - 7, -7, bz0), 1.8, c); fcap(fp(0, 5.6, 23.5), [pull[0] + 1.6, pull[1], pull[2]], 1.8, c); fsph(pull, 1.8, SKIN);
};
FIGS.knight = (u, c, dk, st) => {
  const gal = st.moving ? Math.sin(st.ph) : 0, th = st.act ? Math.sin(st.p * Math.PI) * 7 : 0, hc = '#9a6a38', hd = '#5c3a1a';
  for (const [lf, lr, o] of [[9, -4.5, 0], [9, 4.5, Math.PI], [-9, -4.5, Math.PI], [-9, 4.5, 0]]) { const sw = st.moving ? Math.sin(st.ph + o) : 0, lift = st.moving ? Math.max(0, Math.cos(st.ph + o)) * 3.5 : 0; fcap(fp(lf, lr, 17), fp(lf + sw * 6, lr, lift + 1.5), 2.1, '#7a5028'); fsph(fp(lf + sw * 6, lr, lift + 1.2), 2.4, '#2a1a0c'); }
  fcap(fp(-14, 0, 21), fp(-20, 0, 12 + gal * 2), 2.2, '#1a1008'); fcap(fp(-9, 0, 20), fp(9, 0, 20), 7.6, hc);
  fcap(fp(-8, -6, 19), fp(7, -6, 19), 3.4, c); fcap(fp(-8, 6, 19), fp(7, 6, 19), 3.4, c); fcap(fp(-8, 7.2, 22), fp(7, 7.2, 22), .9, '#f2c230'); fcap(fp(-8, -7.2, 22), fp(7, -7.2, 22), .9, '#f2c230');
  fcap(fp(9, 0, 23), fp(16, 0, 34), 4.2, hc); fcap(fp(8, 0, 27), fp(15, 0, 38), 1.4, '#1a1008'); fcap(fp(16, 0, 34), fp(22, 0, 29.5), 3.3, hd); fsph(fp(22.5, 0, 29), 2.3, '#6a4824');
  fcap(fp(15.4, -1.8, 36.5), fp(15.8, -1.8, 39), .9, '#3a2a18'); fcap(fp(15.4, 1.8, 36.5), fp(15.8, 1.8, 39), .9, '#3a2a18');
  fcap(fp(-5, 0, 28.5), fp(-5, 0, 29.5), 5.5, '#4a2e14');
  fcap(fp(-1, -4, 30), fp(2, -8.5, 22), 1.9, '#9aa0a8'); fcap(fp(-1, 4, 30), fp(2, 8.5, 22), 1.9, '#9aa0a8');
  fcap(fp(-1.5, 0, 30), fp(-1.5, 0, 42), 5, c); fcap(fp(-1.5, 0, 31), fp(-1.5, 0, 32), 5.4, '#f2c230'); fsph(fp(-1.5, -6, 41), 2.4, '#aab0b8'); fsph(fp(-1.5, 6, 41), 2.4, '#aab0b8');
  fsph(fp(-1, 0, 47), 4.4, '#b8bec8'); fcap(fp(3, 0, 47.5), fp(4.5, 0, 45), .8, '#222'); fcap(fp(-3, 0, 51), fp(-9, 0, 53 + gal), 2, c);
  fdisc(fp(0, -9.5, 36), [1, 0, 0], [0, 0, 1], 6.2, shade(c, .15), 6); fcap(fp(0, -9.8, 31), fp(0, -9.8, 41), .8, '#f2c230');
  const lt = th, hand = fp(3 + lt, 8, 36);
  fcap(fp(-1.5, 5.6, 40), hand, 1.8, c); fcap(fp(-8 + lt, 8, 34), fp(34 + lt, 8, 39), 1.1, '#8a6a3a'); fpoly([fp(34 + lt, 8, 39), fp(40 + lt, 8, 40), fp(34 + lt, 8.6, 37.6)], '#e8eef3', fp(36, 8, 39)[2], true);
  fpoly([fp(26 + lt, 8, 38.5), fp(31 + lt, 8 + gal * .8, 37), fp(31 + lt, 8 + gal * .8, 41), fp(26 + lt, 8, 40)], c, fp(28, 8, 39)[2] + .4, true); fsph(hand, 1.9, SKIN);
};
FIGS.ram = (u, c, dk, st) => {
  const off = st.act ? Math.sin(st.p * Math.PI) * 10 : 0, wood = '#7a5230';
  for (const [wf, wr] of [[-9, -11], [-9, 11], [9, -11], [9, 11]]) { fdisc(fp(wf, wr * 1.0, 5), [1, 0, 0], [0, 0, 1], 5, '#3a2a18', 12); fcap(fp(wf - Math.cos(st.roll) * 3.6, wr, 5 - Math.sin(st.roll) * 3.6), fp(wf + Math.cos(st.roll) * 3.6, wr, 5 + Math.sin(st.roll) * 3.6), .6, '#8a6a3a'); }
  fbox(-16, 14, -9, 9, 6, 9, '#6a4a28');
  for (const [pf, pr] of [[-14, -8], [-14, 8], [12, -8], [12, 8], [-1, -8], [-1, 8]]) fcap(fp(pf, pr, 9), fp(pf, pr, 24), 1.3, wood);
  fcap(fp(-14 + off, 0, 16), fp(18 + off, 0, 16), 3.4, '#8a6038'); for (const x of [-8, 0, 8]) fcap(fp(x + off, 0, 19.2), fp(x, 0, 24), .5, '#bbb');
  fcap(fp(17 + off, 0, 16), fp(23 + off, 0, 16), 3.8, '#b8bec6'); fsph(fp(23.5 + off, 0, 16), 2.2, '#cfd4da');
  fbox(-17, 15, -10, 10, 24, 26, shade(c, -.05)); fbox(-17, 15, -10, 10, 26, 28, c);
  fpoly([fp(-17, 10, 28), fp(15, 10, 28), fp(15, 0, 34), fp(-17, 0, 34)], c, fp(0, 5, 31)[2], true); fpoly([fp(-17, -10, 28), fp(15, -10, 28), fp(15, 0, 34), fp(-17, 0, 34)], shade(c, -.2), fp(0, -5, 31)[2] - 2, true);
  for (const x of [-12, -4, 4, 12]) fcap(fp(x, 10, 28), fp(x, 0.4, 34), .5, 'rgba(0,0,0,.4)');
};

function unitFig(u) {
  const D = UNITS[u.type], o = u.order, st = { moving: !!u.path, ph: u.anim * D.speed * 10, roll: u.anim * D.speed * 4, act: false, p: 0, res: '', carry: u.type === 'villager' && u.carry > .5 ? (u.ctype || '') : '', bend: 0 };
  if (u.swing > 0) { st.act = true; st.p = (.25 - u.swing) / .25; }
  if (u.type === 'villager' && o) {
    if (o.type === 'gather' && o.st === 'work' && o.node) {
      st.act = true; st.res = o.res;
      const T = o.res === 'wood' ? .95 : o.res === 'food' ? (o.node.kind === 'building' ? 2.2 : 1.8) : 1.1;
      st.p = (u.anim / T) % 1; if (o.res === 'food') { st.bend = o.node.kind === 'building' ? .85 : .6; st.farm = o.node.kind === 'building'; }
    } else if (o.type === 'build' && o.b && !o.b.done && distEnt(u, o.b) <= 1.0) { st.act = true; st.build = true; st.p = (u.anim / 1.0) % 1; st.res = ''; }
    else if (o.type === 'attack' && o.target && o.target.kind === 'animal') { st.hunt = true; if (u.swing > 0) { st.act = true; st.p = (.25 - u.swing) / .25; } }
    if (o.type === 'attack' && o.target && o.target.kind === 'animal') st.hasSpear = !st.act;
  }
  if (st.moving) st.act = false;
  return st;
}

/* ---------- Árboles, rocas, arbustos ---------- */
function buildSprites() {
  buildTextures();
  const R = mulberry32(777);
  SPR.tree = [0, 1, 2, 3].map(v => bake(56, 72, g => {
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(33, 64, 21, 6, 0, 0, 7); g.fill();
    const tg = g.createLinearGradient(22, 0, 34, 0); tg.addColorStop(0, '#7a5230'); tg.addColorStop(.5, '#5a3a1e'); tg.addColorStop(1, '#2e1c0c');
    g.fillStyle = tg; g.beginPath(); g.moveTo(23, 64); g.quadraticCurveTo(25, 50, 24.5, 40); g.lineTo(31.5, 40); g.quadraticCurveTo(31, 50, 33, 64); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = .7; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(25 + i * 2, 62); g.lineTo(26 + i * 1.6, 42); g.stroke(); }
    if (v < 2) {
      const dark = v ? '#0f3a16' : '#124018', mid = v ? '#2a7a30' : '#318a36';
      for (const [x, y, r] of [[28, 38, 15], [17, 31, 12], [39, 31, 12], [28, 22, 15], [20, 18, 9], [37, 19, 9]]) blob(g, x, y, r, mid, dark);
      for (let i = 0; i < 150; i++) {
        const a = R() * 6.28, d = Math.sqrt(R()) * 22, x = 28 + Math.cos(a) * d * .95, y = 27 + Math.sin(a) * d * .8 - 3;
        if (x < 4 || x > 52 || y < 4 || y > 50) continue;
        const h = 1 - (y - 4) / 46, lit = h * .75 + (x < 28 ? .15 : -.1) + R() * .2;
        g.fillStyle = `hsl(${88 + lit * 40},${46 + lit * 14}%,${14 + lit * 38}%)`; g.save(); g.translate(x, y); g.rotate(R() * 3); g.beginPath(); g.ellipse(0, 0, 2.6, 1.5, 0, 0, 7); g.fill(); g.restore();
      }
      for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(190,240,120,.5)'; g.beginPath(); g.arc(14 + R() * 20, 10 + R() * 20, 1.2, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(28, 46, 16, 4, 0, 0, 7); g.fill();
    } else {
      const bough = (cx, yb, hw, hgt, c0, c1) => {
        const gr = g.createLinearGradient(cx - hw, 0, cx + hw, 0); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
        g.fillStyle = gr; g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = .8; g.beginPath(); g.moveTo(cx, yb - hgt);
        const n = 6; for (let i = 1; i <= n; i++) { const f = i / n, x = cx + hw * f, y = yb - hgt + hgt * f; g.lineTo(x - 1.6, y - 1); g.lineTo(x + (i === n ? 0 : 2.2), y + 1.5); }
        for (let i = n; i >= 1; i--) { const f = i / n, x = cx - hw * f, y = yb - hgt + hgt * f; g.lineTo(x - (i === n ? 0 : 2.2), y + 1.5); g.lineTo(x + 1.6, y - 1); }
        g.closePath(); g.fill(); g.stroke();
        for (let i = 0; i < 26; i++) { const f = R(), x = cx + (R() - .5) * 2 * hw * f, y = yb - hgt + hgt * f; g.strokeStyle = `rgba(${x < cx ? 120 : 20},${x < cx ? 190 : 70},${x < cx ? 110 : 40},.4)`; g.lineWidth = .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 3, y + 3); g.stroke(); }
      };
      bough(28, 56, 20, 22, '#3a8c48', '#0f3a1c'); bough(28, 42, 17, 22, '#46a055', '#134a26'); bough(28, 28, 13, 22, '#56b266', '#1a5a2c'); bough(28, 15, 9, 15, '#68c478', '#1f6a34');
    }
  }));
  SPR.berry = bake(36, 36, g => {
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(20, 30, 14, 5, 0, 0, 7); g.fill();
    for (const [x, y, r] of [[18, 21, 12], [11, 18, 8.5], [25, 19, 8.5], [18, 13, 7.5]]) blob(g, x, y, r, '#58b258', '#1a4a20');
    for (let i = 0; i < 40; i++) { const a = R() * 6.28, d = Math.sqrt(R()) * 12; g.fillStyle = `hsl(${100 + R() * 25},${45 + R() * 15}%,${22 + R() * 25}%)`; g.save(); g.translate(18 + Math.cos(a) * d, 19 + Math.sin(a) * d * .8); g.rotate(R() * 3); g.beginPath(); g.ellipse(0, 0, 2.4, 1.3, 0, 0, 7); g.fill(); g.restore(); }
    [[10, 15], [18, 11], [24, 18], [14, 23], [19, 18], [8, 21], [27, 24], [21, 26], [14, 16], [24, 12]].forEach(p => { blob(g, p[0], p[1], 2.7, '#ff7088', '#9a0e26'); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(p[0] - 1.2, p[1] - 1.4, 1, 1); });
  });
  const rock = gold => bake(36, 36, g => {
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(20, 31, 15, 5, 0, 0, 7); g.fill();
    const boulder = (pts, base) => {
      const cols = [shade(base, .22), shade(base, -.02), shade(base, -.34)];
      const cxx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cyy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; g.fillStyle = cols[Math.min(2, Math.floor((i / pts.length) * 3))]; g.beginPath(); g.moveTo(cxx - 2, cyy - 3); g.lineTo(...p); g.lineTo(...q); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = .8; g.stroke(); });
      g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(pts[0][0] + 1, pts[0][1] + 2); g.lineTo(pts[1][0] + 1, pts[1][1] + 1); g.lineTo(cxx - 3, cyy - 2); g.closePath(); g.fill();
    };
    boulder([[3, 28], [5, 15], [14, 7], [24, 9], [30, 20], [31, 28]], gold ? '#6e6860' : '#7c8188');
    if (!gold) boulder([[20, 29], [22, 21], [29, 18], [34, 25], [33, 29]], '#868b92');
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = .8; g.beginPath(); g.moveTo(12, 12); g.lineTo(15, 19); g.lineTo(13, 26); g.stroke();
    if (!gold) { g.fillStyle = 'rgba(80,130,50,.55)'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(6 + R() * 12, 16 + R() * 12, 1.4 + R(), 0, 7); g.fill(); } }
    if (gold) { [[13, 21], [22, 15], [26, 24], [17, 12], [9, 26], [20, 26]].forEach(p => { blob(g, p[0], p[1], 3.7, '#fff3a8', '#cf8e0c'); g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(p[0] - 1.8, p[1] - 2.2, 1.6, 1.6); g.fillRect(p[0] + .6, p[1] - .6, .9, .9); }); g.strokeStyle = 'rgba(255,214,60,.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(6, 22); g.lineTo(13, 21); g.lineTo(22, 15); g.stroke(); }
  });
  SPR.gold = rock(true); SPR.stone = rock(false);
}

/* ---------- Barras y banderas ---------- */
function hpBar(x, y, w, frac) {
  ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(x - 1.5, y - 1.5, w + 3, 7);
  const c = frac > .5 ? ['#8dff8d', '#2fae3a'] : frac > .25 ? ['#ffe55a', '#c9a010'] : ['#ff7a6a', '#b52a1c'];
  const g = ctx.createLinearGradient(0, y, 0, y + 4); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
  ctx.fillStyle = g; ctx.fillRect(x, y, w * Math.max(0, frac), 4); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, w * Math.max(0, frac), 1.2);
}
function flag(x, y, h, col, t) {
  ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(x, y - h, 2, 0, 7); ctx.fill();
  ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - h + 1);
  for (let i = 0; i <= 10; i++) ctx.lineTo(x + i * 1.7, y - h + 1 + Math.sin(t * 4 + i * .7) * 1.7);
  for (let i = 10; i >= 0; i--) ctx.lineTo(x + i * 1.7 - (i === 10 ? 4 : 0), y - h + 9 + Math.sin(t * 4 + i * .7) * 1.7);
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x + 1, y - h + 2, 15, 1.5);
}
/* ---------- Dibujo isométrico de entidades ---------- */
const UNIT_H = { villager: 42, swordsman: 44, spearman: 46, archer: 44, knight: 58, ram: 44, champion: 48 };
function drawNode(n) {
  if (n.type === 'carcass') { drawCarcass(n); if (n.sel) { const cx = isoX(n.fx, n.fy), cy = isoY(n.fx, n.fy); ctx.strokeStyle = '#ffe97a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, 20, 10, 0, 0, 7); ctx.stroke(); } return; }
  const sx = isoX(n.x + .5, n.y + .5), sy = isoY(n.x + .5, n.y + .5), sh = n.shake > 0 ? n.shake : 0;
  if (n.type === 'tree') { const s = SPR.tree[n.v]; ctx.save(); ctx.translate(sx, sy + 3); ctx.rotate(Math.sin(G.t * 46) * sh * .16); ctx.drawImage(s, -28, -64, s.lw, s.lh); ctx.restore(); }
  else {
    const k = (n.type === 'berry' ? .95 : .7 + .3 * (n.amount / n.max)) * (n.type === 'berry' ? (.7 + .3 * (n.amount / n.max)) : 1), s = SPR[n.type];
    ctx.save(); ctx.translate(sx + Math.sin(G.t * 50) * sh * 2.5, sy + 2); ctx.scale(k * 1.15, k * 1.15); ctx.drawImage(s, -20, -32, s.lw, s.lh); ctx.restore();
    if (sh > 0 && n.type !== 'berry') for (let i = 0; i < 1; i++) { /* chispas se generan en la lógica */ }
  }
  if (n.sel) { ctx.strokeStyle = '#ffe97a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, 20, 10, 0, 0, 7); ctx.stroke(); }
}
function drawUnit(u) {
  const sx = isoX(u.x, u.y), sy = isoY(u.x, u.y), big = u.type === 'knight' ? 1.55 : u.type === 'ram' ? 1.7 : 1;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(sx + 3 * big, sy + 1, 11 * big, 5 * big, 0, 0, 7); ctx.fill();
  if (u.sel) {
    const sc = u.owner === 0 ? '93,255,114' : '255,93,93';
    ctx.strokeStyle = `rgba(${sc},.28)`; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(sx, sy, 17 * big, 8.5 * big, 0, 0, 7); ctx.stroke();
    ctx.strokeStyle = `rgb(${sc})`; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(sx, sy, 17 * big, 8.5 * big, 0, 0, 7); ctx.stroke();
  }
  FG.C = Math.cos(u.dir); FG.S = Math.sin(u.dir);
  const st = unitFig(u), bob = st.moving && u.type !== 'ram' ? -Math.abs(Math.sin(st.ph)) * 1.6 : 0;
  ctx.save(); ctx.translate(sx, sy + bob); FIGS[u.type](u, PCOL[u.owner], PDARK[u.owner], st); figFlush();
  if (u.flash > 0) { ctx.globalAlpha = Math.min(.5, u.flash * 4); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -UNIT_H[u.type] * .5, 8 * big, UNIT_H[u.type] * .45, 0, 0, 7); ctx.fill(); }
  ctx.restore();
  if (u.sel || u.hp < u.maxhp) hpBar(sx - 12, sy - UNIT_H[u.type] - 6, 24, u.hp / u.maxhp);
}
function drawBuilding(b) {
  const D = BUILDINGS[b.type], P = b.w * TILE, sp = bSprite(b.type, b.owner), col = PCOL[b.owner];
  const bx = isoX(b.x, b.y), by = isoY(b.x, b.y), cx = isoX(b.x + b.w / 2, b.y + b.h / 2), cy = isoY(b.x + b.w / 2, b.y + b.h / 2), [H, RH] = BH[b.type], topZ = H + RH;
  const ix = (X, Y) => [(b.x * TILE + X) - (b.y * TILE + Y) + OX, ((b.x * TILE + X) + (b.y * TILE + Y)) / 2];
  if (b.sel) {
    const sc = b.owner === 0 ? '93,255,114' : '255,93,93';
    diamondPath(ctx, b.x, b.y, b.w, b.h, 0); ctx.strokeStyle = `rgba(${sc},.3)`; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.stroke(); ctx.strokeStyle = `rgb(${sc})`; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.save();
  if (!b.done) { const full = topZ + P * .5 + 40, h = full * (0.12 + 0.88 * b.progress); ctx.beginPath(); ctx.rect(bx - P - 70, by + P + 10 - h, 2 * P + 140, h); ctx.clip(); }
  ctx.drawImage(sp, bx - sp.ox, by - sp.oy, sp.lw, sp.lh);
  if (b.type === 'farm') {
    const f = Math.max(0, b.food / D.food), rows = 7;
    for (let i = 0; i < rows; i++) {
      const Y = 4 + (i + .5) * (P - 8) / rows;
      for (let X = 6; X < P - 4; X += 5.5) {
        const p = ix(X, Y), hgt = (2 + 8 * f) * (.75 + hash(X | 0, (Y | 0) + 3) * .5), sw = Math.sin(G.t * 2 + X * .3 + Y) * 1;
        ctx.strokeStyle = f > .55 ? '#e0c048' : f > .25 ? '#b0b844' : '#7e7e34'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + sw, p[1] - hgt); ctx.stroke();
        if (f > .4) { ctx.fillStyle = '#f0d860'; ctx.beginPath(); ctx.ellipse(p[0] + sw, p[1] - hgt - 1.2, 1.1, 2.4, 0, 0, 7); ctx.fill(); }
      }
    }
  }
  if (b.type === 'mill') {
    const hp = ix(P / 2, P / 2 + 12), hx = hp[0], hy = hp[1] - 42; ctx.save(); ctx.translate(hx, hy); ctx.transform(1, .5, 0, 1, 0, 0); ctx.rotate(b.done ? G.t * 1.1 : 0);
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -29); ctx.stroke(); ctx.fillStyle = 'rgba(246,240,224,.95)'; ctx.fillRect(1.5, -29, 8.5, 18); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = .9; ctx.strokeRect(1.5, -29, 8.5, 18); ctx.beginPath(); ctx.moveTo(1.5, -20); ctx.lineTo(10, -20); ctx.stroke(); }
    ctx.restore(); blob(ctx, hx, hy, 3.8, '#b0946a', '#4a3418');
  }
  ctx.restore();
  if (b.done) {
    if (b.type === 'barracks' || b.type === 'archery' || b.type === 'stable') flag(cx + (b.type === 'barracks' ? 0 : 10), cy - topZ + (b.type === 'barracks' ? 4 : 2), 24, col, G.t);
    else if (b.type === 'tc') flag(cx, cy - topZ + 6, 38, col, G.t);
    else if (b.type === 'tower') flag(cx, cy - 66, 24, col, G.t);
    else if (b.type === 'house') { const c = ix(P * .66, P * .36); for (let i = 0; i < 4; i++) { const k = ((G.t * .6 + i * .25) % 1); ctx.fillStyle = `rgba(225,225,225,${.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(c[0] + Math.sin(k * 6 + i) * 3 + k * 6, c[1] - H - RH * .78 - 16 - k * 26, 2.5 + k * 4.5, 0, 7); ctx.fill(); } }
    if (b.type === 'tc') for (const dx of [-18, 18]) { const c = ix(P * .5, P * .96), fl = 1 + .25 * Math.sin(G.t * 14 + dx), g = ctx.createRadialGradient(c[0] + dx, c[1] - 19, 1, c[0] + dx, c[1] - 19, 10 * fl); g.addColorStop(0, 'rgba(255,230,120,.9)'); g.addColorStop(1, 'rgba(255,100,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0] + dx, c[1] - 19, 10 * fl, 0, 7); ctx.fill(); }
  } else {
    const hs = Math.min(topZ + 14, 56), cs = [ix(0, 0), ix(P, 0), ix(P, P), ix(0, P)];
    ctx.strokeStyle = 'rgba(150,105,50,.95)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (const c of cs) { ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0], c[1] - hs * (.35 + .65 * b.progress)); ctx.stroke(); }
    ctx.lineWidth = 1.6; for (let z = 14; z < hs * (.35 + .65 * b.progress); z += 16) for (const [a, c] of [[cs[3], cs[2]], [cs[2], cs[1]]]) { ctx.beginPath(); ctx.moveTo(a[0], a[1] - z); ctx.lineTo(c[0], c[1] - z); ctx.moveTo(a[0], a[1] - z); ctx.lineTo(c[0], c[1] - z + 14); ctx.stroke(); }
    const y0 = by + P + 14; ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(cx - 28, y0, 56, 7);
    const pg = ctx.createLinearGradient(0, y0 + 1, 0, y0 + 6); pg.addColorStop(0, '#ffe38a'); pg.addColorStop(1, '#c08a1a'); ctx.fillStyle = pg; ctx.fillRect(cx - 27, y0 + 1, 54 * b.progress, 5);
  }
  if (b.hp < b.maxhp * 0.5 && b.done) {
    const n = b.hp < b.maxhp * .25 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const p = ix(P * (.15 + i * .7 / (n - 1)), P * (.3 + .4 * ((i * 7) % 5) / 5)), fx = p[0], fy = p[1] - topZ * .6, s = 1 + .2 * Math.sin(G.t * 13 + i * 2);
      for (let k = 0; k < 3; k++) { const q = ((G.t * .8 + i * .3 + k * .33) % 1); ctx.fillStyle = `rgba(50,45,42,${.5 * (1 - q)})`; ctx.beginPath(); ctx.arc(fx + Math.sin(q * 5 + i) * 4, fy - 10 - q * 40, 4 + q * 8, 0, 7); ctx.fill(); }
      const fg = ctx.createRadialGradient(fx, fy, 1, fx, fy, 12 * s); fg.addColorStop(0, 'rgba(255,240,120,.95)'); fg.addColorStop(.45, 'rgba(255,120,20,.85)'); fg.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(fx, fy - 4, 9 * s, 14 * s, 0, 0, 7); ctx.fill();
    }
  }
  if (b.sel || (b.hp < b.maxhp && b.done)) hpBar(cx - 22, cy - topZ - 26 - (b.type === 'tc' ? 14 : 0), 44, b.hp / b.maxhp);
  if (b.sel && b.done && b.owner === 0 && b.rally) {
    const r = b.rally.node ? center(b.rally.node) : b.rally, rx = isoX(r.x, r.y), ry = isoY(r.x, r.y);
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(rx, ry); ctx.stroke(); ctx.setLineDash([]);
    flag(rx, ry, 18, col, G.t);
  }
}

/* ---------- Fauna: ciervos, jabalíes, cerdos y ovejas (figuras 3D animadas) ---------- */
function qlegs(st, fo, ro, hipZ, amp, col, hoof, rad) {
  for (const [f, r, o] of [[fo, -ro, 0], [fo, ro, Math.PI], [-fo, -ro, Math.PI], [-fo, ro, 0]]) {
    const sw = st.moving ? Math.sin(st.ph + o) * amp : 0, lift = st.moving ? Math.max(0, Math.cos(st.ph + o)) * amp * .5 : 0;
    fcap(fp(f, r, hipZ), fp(f + sw, r, lift + 1.2), rad, col); fsph(fp(f + sw, r, lift + 1), rad * 1.15, hoof);
  }
}
const FIGA = {};
FIGA.deer = (a, st) => {
  const col = '#b4804a', hz = 16, gz = st.graze ? .5 + .5 * Math.sin(a.anim * 1.7 + a.id) : 0, run = st.run ? 1 : 0, lean = run * 1.5;
  qlegs(st, 8, 3, hz, st.run ? 7 : 4, '#9a6a3a', '#241810', 1.35);
  fcap(fp(-8, 0, hz + 3 + lean), fp(7, 0, hz + 3), 4.9, col); fcap(fp(-6, 0, hz), fp(5, 0, hz + .5), 3.2, '#d8c09a');
  fsph(fp(-10, 0, hz + 3.6), 3.4, '#f0e8d8'); fcap(fp(-10.5, 0, hz + 5.5), fp(-12.5, 0, hz + 7), 1.1, '#f6f2ea');
  for (let i = 0; i < 6; i++) fsph(fp(-6 + i * 2.4, (i % 2 ? 1 : -1) * 2, hz + 7.4), .9, '#ecd6ae');
  const nTop = st.graze ? fp(11.5, 0, hz + 3 - gz * 9) : fp(11 + lean, 0, hz + 14 - run * 2), head = st.graze ? fp(16, 0, 2.4 + gz * 3.5) : fp(16.5 + lean, 0, hz + 16 - run * 3);
  fcap(fp(6, 0, hz + 5), nTop, 2.9, col); fcap(nTop, head, 2.3, '#a87040'); fsph(head, 1.7, '#2a1a10'); fsph([(nTop[0] + head[0]) / 2, (nTop[1] + head[1]) / 2 - 1.6, nTop[2] + .5], .6, '#111');
  for (const s of [-1, 1]) {
    fcap([nTop[0], nTop[1] - 2, nTop[2] + .1], fp(11 + lean, s * 3.2, hz + 17 - (st.graze ? 14 - gz * 9 : 0)), 1.1, '#9a6a3a');
    if (a.male) { const b = [nTop[0], nTop[1] - 3.4, nTop[2] + .2]; const top = (dx, dy, dz) => [b[0] + dx, b[1] + dy, b[2] + .1]; fcap(b, top(s * 3, -9, 0), .7, '#d8c8a0'); fcap(top(s * 1.4, -4, 0), top(s * 6, -8, 0), .55, '#d8c8a0'); fcap(top(s * 2.2, -7, 0), top(s * 5, -13, 0), .55, '#d8c8a0'); fcap(top(s * 3, -9, 0), top(s * 3.4, -14, 0), .55, '#d8c8a0'); }
  }
};
FIGA.boar = (a, st) => {
  const hz = 10, run = st.run ? 1 : 0, dip = st.swing > 0 ? Math.sin((.35 - st.swing) / .35 * Math.PI) * 4 : 0;
  qlegs(st, 7, 4, hz, st.run ? 5 : 3, '#3a2a20', '#161008', 1.7);
  fcap(fp(-8, 0, hz + 1.5), fp(6, 0, hz + 2.5 - run), 6.6, '#4a3a30'); fsph(fp(3, 0, hz + 5.6), 6, '#3e3028');
  for (let i = 0; i < 6; i++) fcap(fp(-8 + i * 3, 0, hz + 7), fp(-9 + i * 3, 0, hz + 10.5), .9, '#161008');
  const gz = st.graze ? .5 + .5 * Math.sin(a.anim * 2.2 + a.id) : 0, hdz = st.graze ? 3.5 + gz * 2 : 7.5 - dip - run;
  fcap(fp(9, 0, hz + 1.5), fp(15.5, 0, hdz + 1), 4.7, '#4a3a30'); fcap(fp(15, 0, hdz + 1), fp(19.4, 0, hdz - .5), 2.6, '#6a5448'); fsph(fp(19.8, 0, hdz - .5), 1.4, '#1a1008');
  for (const s of [-1, 1]) { fcap(fp(15.5, s * 2.4, hdz), fp(18.6 + dip * .3, s * 3.2, hdz + 4.8), .8, '#f4f0e0'); fcap(fp(10.5, s * 3, hdz + 5), fp(9.4, s * 4, hdz + 8.2), 1.3, '#3a2a20'); fsph(fp(14, s * 2.6, hdz + 3.2), .8, '#f0c040'); }
  fcap(fp(-9.5, 0, hz + 3), fp(-12, 0, hz + 5), .8, '#2a1a10');
};
FIGA.pig = (a, st) => {
  const hz = 10, pink = '#eab0a8', dk = '#d88a8a', gz = st.graze ? .5 + .5 * Math.sin(a.anim * 2.6 + a.id) : 0;
  qlegs(st, 6.5, 3.6, hz, st.run ? 4.5 : 2.6, '#e09a94', '#6a3a34', 1.7);
  fcap(fp(-7, 0, hz + 1.8), fp(6, 0, hz + 1.8), 6.9, pink); fcap(fp(-5, 0, hz - 1), fp(4, 0, hz - .6), 4.6, '#f4c8c0');
  for (const [dx, dz] of [[-9, 3], [-10.5, 4.5], [-11, 6.5], [-10.2, 8]]) fsph(fp(dx, 0, hz + dz), .85, dk);
  const hz2 = st.graze ? 4 + gz * 2.5 : 9.5;
  fsph(fp(9.5, 0, hz2 + 1.5), 4.7, pink); fcap(fp(12.4, 0, hz2 + .5), fp(14.8, 0, hz2 + .3), 2.5, dk); fsph(fp(15.2, 0, hz2 + .3), 1.2, '#b86a6a');
  for (const s of [-1, 1]) { fcap(fp(8.2, s * 3.4, hz2 + 5), fp(10.4, s * 5.4, hz2 + 3), 1.6, dk); fsph(fp(12, s * 2.2, hz2 + 3), .75, '#1a1008'); }
};
FIGA.sheep = (a, st) => {
  const hz = 11, gz = st.graze ? .5 + .5 * Math.sin(a.anim * 2 + a.id) : 0;
  qlegs(st, 5, 2.8, hz - 2, st.run ? 4.2 : 2.4, '#3a3028', '#161008', 1.1);
  for (const [f, r, z, rd] of [[-5, 0, hz + 2.6, 6.2], [1, 0, hz + 3, 6.6], [5.2, 0, hz + 2, 5.4], [-1, -3, hz + 1.2, 5], [-1, 3, hz + 1.2, 5], [3, 3.2, hz + 4.4, 4], [-3, -3.2, hz + 4.6, 4]]) fsph(fp(f, r, z), rd, '#f4f2ea');
  fsph(fp(-9.5, 0, hz + 3), 2.5, '#f4f2ea');
  const hd = st.graze ? fp(10.5, 0, 4 + gz * 2) : fp(10, 0, hz + 6);
  fcap(fp(6, 0, hz + 4), hd, 2.2, '#2a2420'); fsph(hd, 2.8, '#2a2420'); for (const s of [-1, 1]) fcap([hd[0], hd[1] - 1, hd[2] + .2], fp(10, s * 3.8, st.graze ? 6 + gz * 2 : hz + 6.5), 1, '#2a2420');
};
function animalFig(a) {
  const D = ANIMALS[a.type];
  return { ph: a.anim * (a.run ? 9.5 : (a.type === 'deer' ? 4.4 : 3.6)), moving: a.st === 'walk' || a.st === 'flee' || (a.st === 'fight' && !(a.swing > 0)), run: !!a.run, graze: a.st === 'graze', swing: a.swing };
}
function drawAnimal(a) {
  const sx = isoX(a.x, a.y), sy = isoY(a.x, a.y), big = a.type === 'deer' ? 1.3 : a.type === 'sheep' ? 1 : 1.15;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(sx + 3, sy + 1, 14 * big, 5.5 * big, 0, 0, 7); ctx.fill();
  if (a.sel) { ctx.strokeStyle = 'rgba(255,233,122,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, 20 * big, 10 * big, 0, 0, 7); ctx.stroke(); }
  FG.C = Math.cos(a.dir); FG.S = Math.sin(a.dir);
  const st = animalFig(a), bob = st.moving ? -Math.abs(Math.sin(st.ph)) * (st.run ? 2.4 : 1) : 0;
  ctx.save(); ctx.translate(sx, sy + bob); FIGA[a.type](a, st); figFlush();
  if (a.flash > 0) { ctx.globalAlpha = Math.min(.5, a.flash * 4); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -14, 14, 12, 0, 0, 7); ctx.fill(); }
  ctx.restore();
  if (a.sel || a.hp < a.maxhp) hpBar(sx - 12, sy - (a.type === 'deer' ? 42 : 30), 24, a.hp / a.maxhp);
}
function drawCarcass(n) {
  const sx = isoX(n.fx, n.fy), sy = isoY(n.fx, n.fy), frac = Math.max(0, n.amount / n.max), k = .55 + .45 * frac, T = n.animal;
  const col = { deer: '#b4804a', boar: '#4a3a30', pig: '#eab0a8', sheep: '#f0eee6' }[T], belly = { deer: '#d8c09a', boar: '#3a2c24', pig: '#f4c8c0', sheep: '#e8e4d8' }[T];
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(sx + 2, sy + 1, 15 * k, 7 * k, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(120,20,20,.55)'; ctx.beginPath(); ctx.ellipse(sx + 3, sy + 2, 12 * k, 5 * k, 0, 0, 7); ctx.fill();
  FG.C = Math.cos(n.dir); FG.S = Math.sin(n.dir);
  ctx.save(); ctx.translate(sx, sy);
  const bz = T === 'sheep' ? 7 : 6.2, r = (T === 'deer' ? 4.6 : T === 'sheep' ? 6.4 : 6.4) * k;
  for (const [f, side] of [[6.5, 1], [-6.5, 1], [6.5, -1], [-6.5, -1]]) { fcap(fp(f * k, side * 3, bz), fp((f + (side > 0 ? 1 : -1) * 1.5) * k, side * 11 * (T === 'sheep' ? .7 : 1), bz + 3.5), 1.3, T === 'sheep' ? '#2a2420' : '#8a5a30'); }
  fcap(fp(-8 * k, 0, bz), fp(7 * k, 0, bz), r, col); fcap(fp(-6 * k, 4, bz - 2), fp(5 * k, 4, bz - 2), r * .5, belly);
  if (T === 'sheep') for (const [f, z] of [[-4, 4], [1, 4.5], [4, 3.5]]) fsph(fp(f * k, 0, bz + z * k), 5 * k, '#f4f2ea');
  if (frac < .4) for (let i = 0; i < 4; i++) fcap(fp((-4 + i * 3) * k, -1, bz + r * .8), fp((-4 + i * 3) * k, -5 * k - 1, bz + r * .1), .6, '#f0ead8');
  const head = fp(11 * k + 3, -2, 3.5), nk = fp(7.5 * k, 0, bz + 1);
  fcap(nk, head, T === 'deer' ? 2.3 : 3.4, T === 'deer' ? '#a87040' : col); fsph(head, T === 'deer' ? 1.8 : 2.8, T === 'sheep' ? '#2a2420' : T === 'boar' ? '#6a5448' : T === 'pig' ? '#d88a8a' : '#2a1a10');
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(head[0] - 1, head[1] - 3); ctx.lineTo(head[0] + 1, head[1] - 1); ctx.moveTo(head[0] + 1, head[1] - 3); ctx.lineTo(head[0] - 1, head[1] - 1); ctx.stroke();
  if (T === 'deer' && n.male) for (const s of [-1, 1]) { const b = fp(11 * k + 2, s * 1.5, 5); fcap(b, fp(11 * k + 1, s * 5, 7), .6, '#d8c8a0'); fcap(b, fp(11 * k - 2, s * 4, 9), .6, '#d8c8a0'); }
  if (T === 'boar') for (const s of [-1, 1]) fcap(fp(13 * k + 3, s * 2.4, 4), fp(15 * k + 3, s * 3, 6.4), .7, '#f4f0e0');
  figFlush(); ctx.restore();
}
