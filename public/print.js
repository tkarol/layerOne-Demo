// The leave-behind PDF: a deck's slides for the products you pick, in their finished
// state, with a cover page for the customer, laid out one slide per landscape page.
// The browser's "Save as PDF" does the rest. Each product page is loaded (hidden, in
// print mode) and hands back its slides (deck-core.js), so slides look exactly as
// presented: the deck's own slide changes, the customer's name, logo and color.
//   /print.html?deck=<id>&acct=<customer>&color=<hex>&products=vellox,ranger
const qs = new URLSearchParams(location.search);
const PRODUCTS = [
  ['vellox', 'Vellox suite', '/vellox.html'],
  ['layerone', 'LayerOne', '/'],
  ['reverser', 'Reverser', '/reverser.html'],
  ['ranger', 'Ranger', '/ranger.html'],
  ['navigator', 'Navigator', '/navigator.html'],
];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const bar = document.getElementById('prBar');
const doc = document.getElementById('prDoc');
const frames = document.getElementById('prFrames');
const want = new Set((qs.get('products') || PRODUCTS.map((p) => p[0]).join(',')).split(',').filter((p) => PRODUCTS.some(([id]) => id === p)));
const st = { cover: qs.get('cover') !== '0', loaded: {}, busy: false, deck: qs.get('name') || '' };

// Load one product's slides in print mode.
function loadProduct([id, , page]) {
  if (st.loaded[id]) return Promise.resolve(st.loaded[id]);
  return new Promise((resolve) => {
    const p = new URLSearchParams({ print: '1', deck: qs.get('deck') || 'official' });
    if (qs.get('acct')) p.set('acct', qs.get('acct'));
    if (qs.get('color')) p.set('color', qs.get('color'));
    const f = document.createElement('iframe');
    f.src = `${page}?${p}#overview`;
    const done = (m) => {
      window.removeEventListener('message', on);
      clearTimeout(t);
      f.remove();
      st.loaded[id] = m;
      resolve(m);
    };
    const on = (e) => e.origin === location.origin && e.source === f.contentWindow && e.data?.type === 'deck-print' && done(e.data);
    const t = setTimeout(() => done(null), 20000);
    window.addEventListener('message', on);
    frames.append(f);
  });
}

function cover(first) {
  const c = first?.ctx || {};
  const today = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const names = PRODUCTS.filter(([id]) => want.has(id)).map(([, n]) => n);
  return `<section class="print-sheet pr-cover"><div class="deck-stage"><div class="slide in">
    <div class="pr-cover-in">
      <div class="d-kicker"><span class="d-dot"></span>Booz Allen · Vellox</div>
      ${c.logo ? `<img class="pr-cover-logo" src="${esc(c.logo)}" alt="" />` : ''}
      <h1>${c.customer ? `Vellox for ${esc(c.customer)}` : 'Vellox'}</h1>
      <p class="d-lead">AI-native cyber defense, <span>built on adversary tradecraft.</span></p>
      <p class="pr-cover-meta">${esc(names.join(' · '))}<br />${esc(today)}</p>
    </div>
  </div></div></section>`;
}

async function build() {
  st.busy = true;
  drawBar('Getting the slides ready…');
  const list = PRODUCTS.filter(([id]) => want.has(id));
  const got = [];
  for (const p of list) got.push([p, await loadProduct(p)]);
  const parts = got.filter(([, m]) => m && m.sheets?.length);
  if (!st.deck) st.deck = parts.find(([, m]) => m.deck)?.[1].deck || '';
  const brand = parts[0]?.[1].brand;
  if (brand) document.documentElement.style.setProperty('--brand-rgb', brand);
  doc.innerHTML = `${st.cover ? cover(parts[0]?.[1]) : ''}${parts.map(([, m]) => `<div class="${esc(m.main)} pr-scope">${m.sheets.join('')}</div>`).join('')}`;
  await settle();
  const missing = got.filter(([, m]) => !m).map(([p]) => p[1]);
  st.busy = false;
  drawBar(missing.length ? `Couldn’t load: ${missing.join(', ')}.` : '');
  document.title = `${st.deck || 'Vellox'}${parts[0]?.[1].ctx?.customer ? ` · ${parts[0][1].ctx.customer}` : ''}`;
}

// Every slide in its finished state: entrance animations played to the end; loops
// (live feeds, pulses) stopped three quarters of the way through, where everything shows.
async function settle() {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (const a of document.getAnimations()) {
    const t = a.effect?.getComputedTiming?.();
    if (!t) continue;
    try {
      if (t.iterations === Infinity) {
        a.pause();
        a.currentTime = (t.delay || 0) + t.duration * 0.75;
      } else a.finish();
    } catch {}
  }
}

function drawBar(note = '') {
  const pages = doc.querySelectorAll('.print-sheet').length;
  bar.innerHTML = `
    <div class="pr-bar-in">
      <div><b>Leave-behind PDF</b><span>${esc(st.deck || 'Official deck')} · one slide per page, no talking points</span></div>
      <div class="pr-picks">${PRODUCTS.map(([id, n]) => `<label class="check"><input type="checkbox" data-p="${id}" ${want.has(id) ? 'checked' : ''} ${st.busy ? 'disabled' : ''} /> ${esc(n)}</label>`).join('')}
        <label class="check"><input type="checkbox" id="prCover" ${st.cover ? 'checked' : ''} ${st.busy ? 'disabled' : ''} /> Cover page</label></div>
      <div class="pr-go">${note ? `<span class="muted">${esc(note)}</span>` : `<span class="muted">${pages} page${pages === 1 ? '' : 's'}</span>`}
        <button type="button" class="save" id="prPrint" ${st.busy || !pages ? 'disabled' : ''}>Save as PDF…</button></div>
    </div>
    <p class="pr-tip">In the print window, choose <b>Save as PDF</b> as the destination. Turn on <b>Background graphics</b> if your browser asks.</p>`;
  bar.querySelectorAll('[data-p]').forEach(
    (b) =>
      (b.onchange = () => {
        b.checked ? want.add(b.dataset.p) : want.delete(b.dataset.p);
        build();
      }),
  );
  bar.querySelector('#prCover').onchange = (e) => {
    st.cover = e.target.checked;
    build();
  };
  bar.querySelector('#prPrint').onclick = () => window.print();
}

build();
