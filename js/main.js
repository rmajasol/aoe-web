'use strict';
/* ============ Arranque y bucle principal ============ */
let gameRunning = false, selectedDiff = 'normal', lastT = 0, uiT = 0;

document.querySelectorAll('.diff button').forEach(b => {
  b.onclick = () => { document.querySelectorAll('.diff button').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); selectedDiff = b.dataset.d; };
});
/* ---- Visor del log ---- */
(function logUI() {
  const btn = $('btn-log'), sel = $('log-sel'), txt = $('log-text');
  const crashed = LOG.crashed(), n = LOG.previous().length;
  btn.textContent = crashed ? '⚠️ Ver log de la partida que crasheó' : '📜 Registro (' + n + ' anterior' + (n === 1 ? '' : 'es') + ')';
  btn.classList.toggle('crash', !!crashed);
  if (crashed) LOG.warn('La sesión anterior no se cerró normalmente', crashed.id);
  const items = () => LOG.previous();
  function fill() {
    sel.innerHTML = '';
    items().forEach((s, i) => { const o = document.createElement('option'); o.value = i; o.textContent = (s.clean ? '✔ ' : '⚠ CRASH? ') + s.id.replace('T', ' ').slice(0, 19) + ' · ' + s.lines.length + ' líneas'; sel.appendChild(o); });
    const o = document.createElement('option'); o.value = 'cur'; o.textContent = '▶ Sesión actual'; sel.appendChild(o);
    const first = items().findIndex(s => !s.clean);
    sel.value = first >= 0 ? first : items().length ? 0 : 'cur';
    show();
  }
  const pick = () => sel.value === 'cur' ? (LOG.flush(), JSON.parse(localStorage.getItem('aoe-log-current'))) : items()[+sel.value];
  function show() { const s = pick(); txt.value = s ? LOG.format(s) : '(vacío)'; txt.scrollTop = txt.scrollHeight; }
  sel.onchange = show;
  const open = () => { fill(); $('logview').classList.remove('hidden'); };
  btn.onclick = open;
  $('log-close').onclick = () => $('logview').classList.add('hidden');
  $('log-dl').onclick = () => LOG.download(pick());
  $('log-copy').onclick = () => { txt.select(); (navigator.clipboard ? navigator.clipboard.writeText(txt.value) : Promise.reject()).catch(() => document.execCommand('copy')); };
  $('log-clear').onclick = () => { LOG.clear(); btn.classList.remove('crash'); btn.textContent = '📜 Registro (0 anteriores)'; fill(); };
  addEventListener('keydown', e => { if (e.key === 'F9') { e.preventDefault(); $('logview').classList.contains('hidden') ? open() : $('logview').classList.add('hidden'); } });
})();

$('start').onclick = () => {
  $('menu').classList.add('hidden');
  startGame(selectedDiff);
  LOG.event('partida iniciada', { dificultad: selectedDiff, seed: G.seed });
  buildSprites(); buildTerrain(); resize();
  const tc = G.buildings.find(b => b.owner === 0 && b.type === 'tc');
  cam.zoom = 1; centerCam(tc.x + 2, tc.y + 2);
  setSel([tc]);
  gameRunning = true; lastT = performance.now();
  notify('Recolecta recursos, construye casas y crea más aldeanos.', 'ok');
};
initInput(); resize();
// brasas flotando en el menú
(function embers() {
  const host = ['menu', 'end'].map($).find(m => !m.classList.contains('hidden'));
  if (host) {
    const e = document.createElement('div'); e.className = 'ember';
    e.style.left = Math.random() * 100 + '%'; e.style.setProperty('--dx', (Math.random() - .5) * 200 + 'px');
    e.style.animationDuration = 5 + Math.random() * 6 + 's'; const s = 2 + Math.random() * 4; e.style.width = e.style.height = s + 'px';
    host.appendChild(e); setTimeout(() => e.remove(), 11000);
  }
  setTimeout(embers, 220);
})();

function frame(now) {
  requestAnimationFrame(frame); // primero: si algo falla, el bucle sigue vivo
  LOG.frame(now);
  try { frameBody(now); } catch (e) {
    LOG.error('Fallo en el bucle del juego', (e && e.stack) || String(e)); LOG.snap('tras fallo');
    if (!frame.warned) { frame.warned = true; notify('Error interno registrado. Pulsa F9 para ver el log.', 'danger'); }
  }
}
function frameBody(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (gameRunning) {
    updateCamera(dt);
    if (!G.paused && !G.over) {
      let rem = dt * G.speed;
      while (rem > 0) { const s = Math.min(0.05, rem); update(s); rem -= s; }
    }
    render();
    uiT -= dt;
    updateTop();
    if (uiT <= 0) { uiT = 0.15; sel = sel.filter(alive); refreshCmds(); }
    refreshInfo();
  }
}
requestAnimationFrame(frame);
