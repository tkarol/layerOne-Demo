// The slide engine shared by product decks (Layer One, Vellox Reverser): 16:9
// slides, arrow keys, full-screen Present, and talking points under each slide.
//
//   createDeck({ slides, label, storageKey, context, onGoto }) → { mount(el) }
//   slides: [{ id, title?, html(ctx), talk: { key, points[], ask?, objection?, next } }]

export const $ = (sel, root = document) => root.querySelector(sel);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Simple line icons (24×24, drawn in the current color).
export const ICONS = {
  bug: '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M12 20V10M8 13H4M20 13h-4M8 17l-3 2M16 17l3 2M8 9L5 7M16 9l3-2M9.5 6.5L8 4M14.5 6.5L16 4"/>',
  hourglass: '<path d="M6 2h12M6 22h12M7 2v4a5 5 0 0 0 10 0V2M7 22v-4a5 5 0 0 1 10 0v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 5"/>',
  nodes: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><circle cx="12" cy="13" r="2"/><path d="M12 7.5V11M10.5 14.3L7 16.6M13.5 14.3L17 16.6M7.3 17.3h9.4"/>',
  shieldPlus: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M12 8v7M8.5 11.5h7"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  fingerprint: '<path d="M12 11v3a8 8 0 0 1-2 5.3M8.5 7.5A5 5 0 0 1 17 11v1M7 11a5 5 0 0 1 .4-2M16.9 15a12 12 0 0 1-1.4 5M12 7a4 4 0 0 0-4 4v1a10 10 0 0 1-1.5 5"/>',
  code: '<path d="M8 6l-6 6 6 6M16 6l6 6-6 6M14 4l-4 16"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a12 12 0 0 1-2.4 3.5M6.2 6.2C3.9 7.6 2.5 9.8 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 4.4-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5"/><path d="M12 18h.01"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  landmark: '<path d="M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M2 10l10-6 10 6z"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  x: '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>',
};
export const icon = (name) => `<svg class="d-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

export const outcome = (tone, t, d) => `<div class="d-out ${tone}"><span class="d-led"></span><b>${t}</b><small>${d}</small></div>`;
export const goCard = (to, ic, t, d) => `<button type="button" class="d-go" data-goto="${to}"><span class="d-ic">${icon(ic)}</span><span class="d-go-t"><b>${t}</b><small>${d}</small></span><span class="d-go-arrow">${icon('arrow')}</span></button>`;

export function createDeck({ slides, label, storageKey = 'deck', context = async () => ({}), onGoto = () => {} }) {
  const st = { i: 0, notes: true, ctx: {} };
  try {
    st.i = Math.min(Number(sessionStorage.getItem(`${storageKey}-slide`)) || 0, slides.length - 1);
    st.notes = sessionStorage.getItem(`${storageKey}-notes`) !== '0';
  } catch {}
  let root;

  // The stage is built once, so presenting full screen survives slide changes;
  // only the slide, the controls and the talking points are redrawn.
  function draw() {
    if (!root.querySelector('.deck')) {
      root.innerHTML = `
        <div class="deck">
          <div class="deck-stage" tabindex="-1">
            <div class="slide"></div>
            <button type="button" class="deck-hit prev" data-move="-1" aria-label="Previous slide"></button>
            <button type="button" class="deck-hit next" data-move="1" aria-label="Next slide"></button>
          </div>
          <div class="deck-bar"></div>
          <div class="deck-notes" hidden></div>
          <p class="muted small deck-help">← → to move · F to present full screen · N to show or hide talking points</p>
        </div>`;
      root.querySelectorAll('.deck-hit').forEach((b) => (b.onclick = () => move(Number(b.dataset.move))));
    }
    const s = slides[st.i];
    const slide = $('.slide', root);
    slide.dataset.slide = s.id;
    slide.innerHTML = `${s.title ? `<h2 class="d-h">${s.title}</h2>` : ''}${s.html(st.ctx)}<div class="d-foot"><span>${esc(label)}</span><span>${st.i + 1} / ${slides.length}</span></div>`;
    slide.classList.remove('in');
    void slide.offsetWidth; // restart the entrance animation
    slide.classList.add('in');
    $('.deck-hit.prev', root).hidden = st.i === 0;
    $('.deck-hit.next', root).hidden = st.i === slides.length - 1;
    $('.deck-bar', root).innerHTML = `
      <button type="button" class="secondary" data-move="-1" ${st.i === 0 ? 'disabled' : ''}>← Back</button>
      <div class="deck-dots">${slides.map((x, n) => `<button type="button" class="${n === st.i ? 'on' : ''}" data-to="${n}" aria-label="Slide ${n + 1}" title="${esc(String(x.title || 'Title').replace(/<[^>]+>/g, ' '))}"></button>`).join('')}</div>
      <button type="button" class="secondary" data-move="1" ${st.i === slides.length - 1 ? 'disabled' : ''}>Next →</button>
      <span class="deck-tools">
        <button type="button" class="secondary" data-notes aria-pressed="${st.notes}">${st.notes ? 'Hide talking points' : 'Talking points'}</button>
        <button type="button" class="con-go" data-full>⛶ Present</button>
      </span>`;
    const notes = $('.deck-notes', root);
    notes.hidden = !st.notes;
    const t = s.talk;
    notes.innerHTML = `
      <div class="tp-head"><span class="tp-label">Talking points</span><span class="muted small">Slide ${st.i + 1} of ${slides.length} · not shown when presenting</span></div>
      <p class="tp-key">${t.key}</p>
      <ul class="tp-list">${t.points.map((p) => `<li>${p}</li>`).join('')}</ul>
      ${t.ask ? `<p class="tp-ask"><span>Ask the room</span>${t.ask}</p>` : ''}
      ${t.objection ? `<p class="tp-obj"><span>If they say…</span>${t.objection}</p>` : ''}
      <p class="tp-next"><span>Lead-in to the next slide</span>${t.next}</p>`;
    root.querySelectorAll('.deck-bar [data-move]').forEach((b) => (b.onclick = () => move(Number(b.dataset.move))));
    root.querySelectorAll('[data-to]').forEach((b) => (b.onclick = () => go(Number(b.dataset.to))));
    root.querySelectorAll('[data-goto]').forEach((b) => (b.onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      onGoto(b.dataset.goto);
    }));
    $('[data-notes]', root).onclick = toggleNotes;
    $('[data-full]', root).onclick = toggleFull;
  }

  function go(n) {
    st.i = Math.max(0, Math.min(slides.length - 1, n));
    try {
      sessionStorage.setItem(`${storageKey}-slide`, String(st.i));
    } catch {}
    draw();
  }
  const move = (d) => go(st.i + d);

  function toggleNotes() {
    st.notes = !st.notes;
    try {
      sessionStorage.setItem(`${storageKey}-notes`, st.notes ? '1' : '0');
    } catch {}
    draw();
  }

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else $('.deck-stage', root)?.requestFullscreen?.().catch(() => {});
  }

  function onKey(e) {
    if (!root?.isConnected || root.closest('[hidden]')) return; // only while this deck is on screen
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (['ArrowRight', 'PageDown', ' '].includes(k)) move(1);
    else if (['ArrowLeft', 'PageUp'].includes(k)) move(-1);
    else if (k === 'Home') go(0);
    else if (k === 'End') go(slides.length - 1);
    else if (k === 'f' || k === 'F') toggleFull();
    else if (k === 'n' || k === 'N') toggleNotes();
    else return;
    e.preventDefault();
  }

  return {
    async mount(el) {
      root = el;
      try {
        st.ctx = (await context()) || {};
      } catch {}
      draw();
      document.addEventListener('keydown', onKey);
    },
  };
}
