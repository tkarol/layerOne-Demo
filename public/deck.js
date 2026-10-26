// "Overview" tab: a short pitch deck to open a customer demo. Arrow keys move
// between slides, F presents full screen, N shows speaker notes. The last slide
// jumps straight into the demos.
//
// Claims stay within what Layer One's docs and this demo show.

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const SLIDES = [
  {
    id: 'title',
    html: (ctx) => `
      <div class="d-title">
        <div class="d-kicker">Booz Allen · Vellox</div>
        <h1>Layer One</h1>
        <p class="d-lead">Govern every AI request your organization makes, in one place.</p>
        ${ctx.customer ? `<div class="d-for">Prepared for <b>${esc(ctx.customer)}</b></div>` : ''}
      </div>`,
    notes: 'AI is already in daily work. Today: how to keep it safe and accountable without slowing anyone down. Two minutes of slides, then a live demo.',
  },
  {
    id: 'problem',
    title: 'AI is already in the workflow. Governance is not.',
    html: () => `
      <div class="d-grid d-4">
        ${card('🔓', 'Data leaves', 'SSNs, health details or CUI pasted into a prompt go to an outside model.', 'bad')}
        ${card('🧭', 'Unapproved models', 'Anyone can point a tool at a public model. Nobody sees it.', 'bad')}
        ${card('🎭', 'Manipulated AI', 'Hidden instructions in an email can make an agent leak data.', 'bad')}
        ${card('❓', 'Wrong answers', 'A made-up rule reads like fact and ends up in a decision.', 'bad')}
      </div>
      <div class="d-callout">And afterwards, there is usually <b>no record</b> of what was sent, or where.</div>`,
    notes: 'Make it concrete for this audience: caseworkers, contracting officers, FOIA staff, analysts. Every one of these is shown live in the demo.',
  },
  {
    id: 'how',
    title: 'One gateway in the path of every AI request',
    html: () => `
      <div class="d-flow">
        <div class="d-node">${ico('🖥️')}<b>Your apps &amp; agents</b></div>
        <div class="d-arrow">⇄</div>
        <div class="d-node d-l1">${ico('🛡️')}<b>Layer One</b><small>Checks the request · routes to approved models · checks the answer · records everything</small></div>
        <div class="d-arrow">⇄</div>
        <div class="d-node">${ico('✦')}<b>AI models</b></div>
      </div>
      <div class="d-decisions">
        <span class="d-pill ok">Pass</span><span class="d-pill warn">Redact</span><span class="d-pill bad">Block</span><span class="d-pill warn">Hold for review</span>
      </div>
      <p class="d-sub d-center">Drop-in: point any OpenAI-compatible client at Layer One. Every decision is recorded with evidence.</p>`,
    notes: 'Requests are checked before any model sees them, answers before any person does. Normal work passes untouched. Setup is a base URL and a few headers, hosted or self-hosted.',
  },
  {
    id: 'demo',
    title: 'Let’s see it',
    html: () => `
      <div class="d-grid d-2 d-demo">
        ${go('apps:chat', '💬', 'Ask AI', 'A company AI chat. 5 minutes.')}
        ${go('apps:benefits', '🏛️', 'A day in the life', 'Federal workflows: benefits, acquisition, FOIA, DoD.')}
        ${go('apps:data', '🗄️', 'AI agents and your data', 'An agent that queries a database.')}
        ${go('console', '🔍', 'Behind the scenes', 'The request, the checks, the audit record.')}
      </div>`,
    notes: 'Short slot: Ask AI. Federal program staff: a day in the life. Technical teams: Behind the scenes, then Connect.',
  },
];

const ico = (e) => `<span class="d-ico">${e}</span>`;
const card = (e, t, d, tone = '') => `<div class="d-card ${tone}">${ico(e)}<b>${t}</b><p>${d}</p></div>`;
const go = (to, e, t, d) => `<button type="button" class="d-go" data-goto="${to}">${ico(e)}<span><b>${t} →</b><small>${d}</small></span></button>`;

const st = { i: 0, notes: false, customer: null };
try {
  st.i = Math.min(Number(sessionStorage.getItem('l1-slide')) || 0, SLIDES.length - 1);
  st.notes = sessionStorage.getItem('l1-notes') === '1';
} catch {}

let root;
export async function mountDeck(el) {
  root = el;
  try {
    st.customer = (await fetch('/api/apps').then((r) => r.json())).customer?.name || null;
  } catch {}
  draw();
  document.addEventListener('keydown', onKey);
  document.addEventListener('fullscreenchange', () => root.querySelector('.deck')?.classList.toggle('full', Boolean(document.fullscreenElement)));
}

// The stage is built once, so presenting full screen survives slide changes;
// only the slide, the controls and the notes are redrawn.
function draw() {
  if (!root.querySelector('.deck')) {
    root.innerHTML = `
      <div class="deck">
        <div class="deck-stage" id="deckStage" tabindex="-1">
          <div class="slide"></div>
          <button type="button" class="deck-hit prev" data-move="-1" aria-label="Previous slide"></button>
          <button type="button" class="deck-hit next" data-move="1" aria-label="Next slide"></button>
        </div>
        <div class="deck-bar"></div>
        <div class="deck-notes" hidden></div>
        <p class="muted small deck-help">← → to move · F to present full screen · N for notes</p>
      </div>`;
    root.querySelectorAll('.deck-hit').forEach((b) => (b.onclick = () => move(Number(b.dataset.move))));
  }
  const s = SLIDES[st.i];
  const slide = $('.slide', root);
  slide.dataset.slide = s.id;
  slide.innerHTML = `${s.title ? `<h2 class="d-h">${s.title}</h2>` : ''}${s.html({ customer: st.customer })}<div class="d-foot"><span>Layer One</span><span>${st.i + 1} / ${SLIDES.length}</span></div>`;
  slide.classList.remove('in');
  void slide.offsetWidth; // restart the entrance animation
  slide.classList.add('in');
  $('.deck-hit.prev', root).hidden = st.i === 0;
  $('.deck-hit.next', root).hidden = st.i === SLIDES.length - 1;
  $('.deck-bar', root).innerHTML = `
    <button type="button" class="secondary" data-move="-1" ${st.i === 0 ? 'disabled' : ''}>← Back</button>
    <div class="deck-dots">${SLIDES.map((x, n) => `<button type="button" class="${n === st.i ? 'on' : ''}" data-to="${n}" aria-label="Slide ${n + 1}" title="${esc(x.title || 'Title')}"></button>`).join('')}</div>
    <button type="button" class="secondary" data-move="1" ${st.i === SLIDES.length - 1 ? 'disabled' : ''}>Next →</button>
    <span class="deck-tools">
      <button type="button" class="secondary" id="deckNotes" aria-pressed="${st.notes}">${st.notes ? 'Hide notes' : 'Speaker notes'}</button>
      <button type="button" class="con-go" id="deckFull">⛶ Present</button>
    </span>`;
  const notes = $('.deck-notes', root);
  notes.hidden = !st.notes;
  notes.innerHTML = `<b>Notes</b><p>${esc(s.notes || '')}</p>`;
  wire();
}

function wire() {
  root.querySelectorAll('.deck-bar [data-move]').forEach((b) => (b.onclick = () => move(Number(b.dataset.move))));
  root.querySelectorAll('[data-to]').forEach((b) => (b.onclick = () => go_(Number(b.dataset.to))));
  root.querySelectorAll('[data-goto]').forEach((b) => (b.onclick = () => gotoDemo(b.dataset.goto)));
  $('#deckNotes', root).onclick = toggleNotes;
  $('#deckFull', root).onclick = toggleFull;
}

function go_(n) {
  st.i = Math.max(0, Math.min(SLIDES.length - 1, n));
  try {
    sessionStorage.setItem('l1-slide', String(st.i));
  } catch {}
  draw();
}
const move = (d) => go_(st.i + d);

function toggleNotes() {
  st.notes = !st.notes;
  try {
    sessionStorage.setItem('l1-notes', st.notes ? '1' : '0');
  } catch {}
  draw();
}

function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen();
  else $('#deckStage', root)?.requestFullscreen?.().catch(() => {});
}

function gotoDemo(to) {
  if (document.fullscreenElement) document.exitFullscreen();
  const [view, app] = to.split(':');
  window.dispatchEvent(new CustomEvent('l1:view', { detail: view }));
  if (app) window.dispatchEvent(new CustomEvent('l1:select-app', { detail: app }));
  window.scrollTo({ top: 0 });
}

function onKey(e) {
  if (!root?.isConnected || root.closest('[hidden]')) return; // only on the Overview tab
  if (e.target.closest?.('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (['ArrowRight', 'PageDown', ' '].includes(k)) move(1);
  else if (['ArrowLeft', 'PageUp'].includes(k)) move(-1);
  else if (k === 'Home') go_(0);
  else if (k === 'End') go_(SLIDES.length - 1);
  else if (k === 'f' || k === 'F') toggleFull();
  else if (k === 'n' || k === 'N') toggleNotes();
  else return;
  e.preventDefault();
}
