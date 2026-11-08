'use strict';
/* ============ Arranque y bucle principal ============ */
let gameRunning = false, selectedDiff = 'normal', lastT = 0, uiT = 0;

document.querySelectorAll('.diff button').forEach(b => {
  b.onclick = () => { document.querySelectorAll('.diff button').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); selectedDiff = b.dataset.d; };
});
$('start').onclick = () => {
  $('menu').classList.add('hidden');
  startGame(selectedDiff);
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
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
