// Presenter view: a second window for the presenter's laptop while the slides are on
// the shared screen. Follows the deck it was opened from (deck-core.js, over a
// BroadcastChannel): the current slide, the next one, the talking points, a timer,
// and next / back. Arrow keys work here too.
const k = new URLSearchParams(location.search).get('k') || '';
const root = document.getElementById('pv');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

if (!('BroadcastChannel' in window) || !k) {
  root.innerHTML = '<p class="pv-wait">Open the presenter view from a deck (🗔 Presenter view under the slide).</p>';
} else {
  const ch = new BroadcastChannel(`deck-${k}`);
  const send = (m) => ch.postMessage(m);
  const timer = { start: Date.now(), paused: 0, pausedAt: 0 };
  let last = null;

  const clock = () => {
    const ms = (timer.pausedAt || Date.now()) - timer.start - timer.paused;
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const stage = (html, m, cls = '') =>
    html
      ? `<div class="${esc(m.main)} pv-scope"><div class="deck-stage ${cls}"><div class="slide in">${html}</div></div></div>`
      : '<div class="pv-end">End of the deck</div>';

  function draw(m) {
    last = m;
    if (m.brand) document.documentElement.style.setProperty('--brand-rgb', m.brand);
    document.title = `Presenter · ${m.label} · ${m.i + 1}/${m.n}`;
    root.innerHTML = `
      <header class="pv-head">
        <div><b>${esc(m.label)}</b><span>${esc(m.deck)}${m.customer ? ` · for ${esc(m.customer)}` : ''}</span></div>
        <div class="pv-timer"><span id="pvClock">${clock()}</span>
          <button type="button" id="pvPause">${timer.pausedAt ? '▶ Resume' : '❚❚ Pause'}</button>
          <button type="button" id="pvReset">↺ Reset</button></div>
        <div class="pv-nav">
          <button type="button" id="pvBack" ${m.i === 0 ? 'disabled' : ''}>← Back</button>
          <span>Slide ${m.i + 1} of ${m.n}</span>
          <button type="button" id="pvNext" class="pv-primary" ${m.i === m.n - 1 ? 'disabled' : ''}>Next →</button>
        </div>
      </header>
      <main class="pv-main">
        <section class="pv-now"><div class="pv-lbl">Now</div>${stage(m.current, m)}</section>
        <section class="pv-side">
          <div class="pv-lbl">Next${m.i < m.n - 1 ? ` · ${esc(m.titles[m.i + 1])}` : ''}</div>${stage(m.next, m, 'pv-small')}
          <div class="pv-lbl">Talking points</div>
          <div class="pv-notes deck-notes">${m.notes}</div>
        </section>
      </main>
      <nav class="pv-dots">${m.titles.map((t, n) => `<button type="button" data-go="${n}" class="${n === m.i ? 'on' : ''}" title="${esc(t)}">${n + 1}</button>`).join('')}</nav>`;
    root.querySelector('#pvBack').onclick = () => send({ type: 'move', d: -1 });
    root.querySelector('#pvNext').onclick = () => send({ type: 'move', d: 1 });
    root.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => send({ type: 'go', n: Number(b.dataset.go) })));
    root.querySelector('#pvPause').onclick = () => {
      if (timer.pausedAt) {
        timer.paused += Date.now() - timer.pausedAt;
        timer.pausedAt = 0;
      } else timer.pausedAt = Date.now();
      draw(last);
    };
    root.querySelector('#pvReset').onclick = () => {
      Object.assign(timer, { start: Date.now(), paused: 0, pausedAt: timer.pausedAt ? Date.now() : 0 });
      draw(last);
    };
  }

  ch.onmessage = (e) => e.data?.type === 'state' && draw(e.data);
  send({ type: 'hello' });
  setInterval(() => {
    const c = document.getElementById('pvClock');
    if (c) c.textContent = clock();
  }, 1000);
  document.addEventListener('keydown', (e) => {
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) send({ type: 'move', d: 1 });
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) send({ type: 'move', d: -1 });
    else return;
    e.preventDefault();
  });
  // If the deck's tab was reloaded, ask again.
  setTimeout(() => !last && send({ type: 'hello' }), 1500);
}
