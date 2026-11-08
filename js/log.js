'use strict';
/* ============ Registro persistente (localStorage) ============
   Cada carga de página es una "sesión". Se guarda en localStorage con volcado
   inmediato para errores y periódico (latido) para el resto. Si el navegador se
   cierra/crashea sin pasar por `pagehide`, la sesión queda marcada como NO limpia
   y en la siguiente apertura se ofrece el log de esa partida.
   Consola: LOG.dump() / LOG.previous() / LOG.download() */
const LOG = (function () {
  const KEY_CUR = 'aoe-log-current', KEY_PREV = 'aoe-log-prev';
  const MAX_LINES = 800, MAX_PREV = 5;
  const t0 = Date.now();
  let cur = { id: new Date(t0).toISOString(), ua: navigator.userAgent, screen: innerWidth + 'x' + innerHeight, clean: false, last: t0, lines: [] };
  let prev = [], dirty = false, flushT = 0, lastFrame = 0, longFrames = 0, errCount = 0;

  const rd = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

  // Archivar la sesión anterior (si la hay)
  const old = rd(KEY_CUR);
  prev = rd(KEY_PREV) || [];
  if (old && old.lines) { prev.unshift(old); prev = prev.slice(0, MAX_PREV); wr(KEY_PREV, prev); }

  function flush() {
    clearTimeout(flushT); flushT = 0; dirty = false; cur.last = Date.now();
    if (!wr(KEY_CUR, cur)) { cur.lines.splice(0, Math.floor(cur.lines.length / 2)); wr(KEY_CUR, cur); } // cuota llena: recortar
  }
  function add(level, msg, data) {
    const ts = ((Date.now() - t0) / 1000).toFixed(1);
    let s = '[' + ts + 's]' + (typeof G !== 'undefined' && G.players ? '[' + fmtT(G.t) + ']' : '') + ' ' + level + ' ' + msg;
    if (data !== undefined) { try { s += ' ' + (typeof data === 'string' ? data : JSON.stringify(data)); } catch (e) { } }
    cur.lines.push(s.slice(0, 1500));
    if (cur.lines.length > MAX_LINES) cur.lines.splice(1, cur.lines.length - MAX_LINES); // conserva la 1ª línea (inicio)
    dirty = true;
    if (level === 'ERROR' || level === 'FATAL') flush();
    else if (!flushT) flushT = setTimeout(flush, 1000);
  }
  const fmtT = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

  function snapshot() {
    if (typeof G === 'undefined' || !G.players) return null;
    const alive = a => a.filter(e => !e.dead).length;
    const s = {
      units: [alive(G.units.filter(u => u.owner === 0)), alive(G.units.filter(u => u.owner === 1))],
      bld: [alive(G.buildings.filter(b => b.owner === 0)), alive(G.buildings.filter(b => b.owner === 1))],
      animals: alive(G.animals), fx: G.fx.length, speed: G.speed, paused: !!G.paused,
      res: G.players[0].res, pop: G.players[0].pop + '/' + G.players[0].popCap, age: G.players[0].age,
    };
    if (performance.memory) s.heapMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
    return s;
  }

  const api = {
    info: (m, d) => add('INFO', m, d),
    warn: (m, d) => add('WARN', m, d),
    event: (m, d) => add('EVT', m, d),
    error(m, d) { errCount++; if (errCount <= 60) add('ERROR', m, d); else if (errCount === 61) add('ERROR', 'demasiados errores, se silencian los siguientes'); },
    snap(why) { add('SNAP', why || '', snapshot() || undefined); },
    // Llamar una vez por frame: detecta tirones largos
    frame(now) {
      if (lastFrame && now - lastFrame > 250 && !document.hidden) { longFrames++; if (longFrames <= 30) add('WARN', 'frame lento ' + Math.round(now - lastFrame) + 'ms'); }
      lastFrame = now;
    },
    previous: () => prev,
    // Última sesión que NO terminó limpiamente (posible crash), o null
    crashed() { return prev.find(s => !s.clean) || null; },
    format(s) {
      const head = 'Sesión ' + s.id + (s.clean ? ' (cerrada normalmente)' : ' (NO SE CERRÓ NORMALMENTE — posible crash)') +
        '\nÚltima actividad: ' + new Date(s.last).toISOString() + '\n' + s.ua + ' · ' + s.screen + '\n' + '-'.repeat(50) + '\n';
      return head + s.lines.join('\n');
    },
    text(s) { return s ? api.format(s) : [cur].concat(prev).map(api.format).join('\n\n========\n\n'); },
    dump() { console.log(api.text()); },
    download(s) {
      const blob = new Blob([api.text(s)], { type: 'text/plain' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'aoe-log-' + (s || cur).id.replace(/[:.]/g, '-') + '.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    clear() { prev = []; wr(KEY_PREV, prev); },
    flush,
  };

  /* ---- Captura global de errores ---- */
  addEventListener('error', e => api.error('Excepción: ' + e.message, (e.filename || '').split('/').pop() + ':' + e.lineno + ':' + e.colno + (e.error && e.error.stack ? '\n' + e.error.stack : '')));
  addEventListener('unhandledrejection', e => api.error('Promesa rechazada', e.reason && e.reason.stack ? e.reason.stack : String(e.reason)));
  for (const lvl of ['error', 'warn']) {
    const orig = console[lvl].bind(console);
    console[lvl] = (...a) => { orig(...a); (lvl === 'error' ? api.error : api.warn)('console.' + lvl, a.map(x => x instanceof Error ? x.stack : typeof x === 'object' ? (() => { try { return JSON.stringify(x); } catch (e) { return String(x); } })() : String(x)).join(' ')); };
  }
  addEventListener('webglcontextlost', () => api.error('Contexto gráfico perdido'), true);
  document.addEventListener('visibilitychange', () => api.info(document.hidden ? 'pestaña oculta' : 'pestaña visible'));
  // Cierre normal (no se dispara en un crash de pestaña / proceso)
  addEventListener('pagehide', () => { add('INFO', 'pagehide (cierre normal)'); cur.clean = true; flush(); });

  /* ---- Latido: estado periódico ---- */
  setInterval(() => { if (typeof gameRunning !== 'undefined' && gameRunning) api.snap('latido'); else flush(); }, 5000);

  add('INFO', 'sesión iniciada', { prevSessions: prev.length, prevCrashed: prev.filter(s => !s.clean).length });
  flush();
  return api;
})();
