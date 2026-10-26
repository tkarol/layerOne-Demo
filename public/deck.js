// "Overview" tab: a short pitch deck to open a customer demo. Arrow keys move
// between slides, F presents full screen, N shows speaker notes. The last slide
// jumps straight into the demos.
//
// Claims stay within what Layer One's docs and this demo show.

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Simple line icons (24×24, drawn in the current color).
const ICONS = {
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
};
const icon = (name) => `<svg class="d-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// Each slide: what's on screen, plus talking points (a key message, what to say, and the lead-in to the next slide).
const SLIDES = [
  {
    id: 'title',
    html: (ctx) => `
      <div class="d-title">
        <div class="d-kicker"><span class="d-dot"></span>Booz Allen · Vellox</div>
        <h1>Layer One</h1>
        <p class="d-lead">Govern every AI request your organization makes, <span>in one place.</span></p>
        ${ctx.customer ? `<div class="d-for">Prepared for <b>${esc(ctx.customer)}</b></div>` : ''}
      </div>
      <div class="d-orbit" aria-hidden="true"><div></div><div></div><div></div></div>`,
    talk: {
      key: 'This is about using AI safely, not stopping it.',
      points: [
        'Open with their world, not the product: “Your teams are already using AI, officially or not. The real question is whether you can see it and steer it.”',
        'Layer One in one sentence: a checkpoint every AI request passes through, so the rules live in one place instead of being rebuilt in every app.',
        'Set expectations: a couple of minutes of context, then real requests, live, with Layer One switched on and off.',
      ],
      ask: 'Where is AI showing up in your work today: chat tools, copilots built into software, or agents that take actions?',
      next: 'Let’s start with why this matters.',
    },
  },
  {
    id: 'problem',
    title: 'AI is already in the workflow.<br /><span class="d-dim">Governance is not.</span>',
    html: () => `
      <div class="d-grid d-4">
        ${card('unlock', 'Data leaves', 'SSNs, health details or CUI pasted into a prompt go to an outside model.')}
        ${card('eyeOff', 'Unapproved models', 'Anyone can point a tool at a public model. Nobody sees it.')}
        ${card('alert', 'Manipulated AI', 'Hidden instructions in an email can make an agent leak data.')}
        ${card('help', 'Wrong answers', 'A made-up rule reads like fact and ends up in a decision.')}
      </div>
      <div class="d-callout"><span>And afterwards, there is usually <b>no record</b> of what was sent, or where.</span></div>`,
    talk: {
      key: 'Nobody here is a bad actor. Helpful people and helpful tools are moving faster than the controls.',
      points: [
        '<b>Tell it as a story.</b> Picture a caseworker at 4:45 on a Friday with a backlog. They paste a claimant’s email into a chat tool to draft a reply: name, SSN, date of birth. Nothing malicious; they’re trying to help. That data now sits with a provider the agency has no agreement with, and there’s no way to pull it back.',
        '<b>Why blocking doesn’t work.</b> Ban AI outright and people move it to personal phones and laptops, where you see even less. The goal is a safe default path, not a wall.',
        '<b>Agents raise the stakes.</b> With a chat tool, a bad answer is a bad paragraph. With an agent that can send email, update records or query a database, a hidden instruction becomes an action. The more useful the agent, the bigger the blast radius.',
        '<b>The problem with wrong answers</b> isn’t that AI is sometimes wrong; people are too. It’s that it’s wrong confidently, perfectly formatted, citing a rule that looks real. Busy people trust confident text.',
        '<b>The accountability test:</b> if your IG asked tomorrow which AI models touched personal data last quarter, and what was sent, could you answer? For most organizations the honest answer today is no.',
      ],
      ask: 'Which of these four worries you most? Let their answer decide which demo you open first.',
      objection: '“We already have an AI policy” or “we have DLP.” A policy tells people what to do, and network tools see encrypted traffic, not the prompt. Neither one stops a request. That’s the gap on the next slide.',
      next: 'So how do you govern this without slowing people down?',
    },
  },
  {
    id: 'how',
    title: 'One gateway for every AI request',
    html: () => `
      <div class="d-arch2">
        <div class="d-end">${icon('monitor')}<b>Your apps<br />&amp; agents</b></div>
        <div class="d-wire"><span>request →</span><i></i><i class="back"></i><span>← answer</span></div>
        <div class="d-core">
          <div class="d-core-h">${icon('shield')}<b>Layer One</b></div>
          <ol>
            <li><span>1</span>Check the request</li>
            <li><span>2</span>Route to an approved model</li>
            <li><span>3</span>Check the answer</li>
            <li><span>4</span>Record the decision</li>
          </ol>
        </div>
        <div class="d-wire"><span>approved →</span><i></i><i class="back"></i><span>← answer</span></div>
        <div class="d-end">${icon('sparkle')}<b>AI<br />models</b></div>
      </div>
      <div class="d-outcomes">
        ${outcome('ok', 'Pass', 'Normal work flows')}
        ${outcome('warn', 'Redact', 'Sensitive data removed')}
        ${outcome('bad', 'Block', 'Never reaches a model')}
        ${outcome('warn', 'Hold', 'Answer held for review')}
      </div>
      <p class="d-note">Drop-in: an OpenAI-compatible base URL and a few headers · hosted or self-hosted</p>`,
    talk: {
      key: 'Invisible when everything is fine, decisive when it isn’t.',
      points: [
        '<b>Use an analogy:</b> one security checkpoint at the front door instead of a different lock on every office. Set the rules once, and every app and agent inherits them.',
        '<b>Two moments matter:</b> before a model sees the request, and before a person sees the answer. That’s where Layer One acts.',
        '<b>Most traffic just passes,</b> and that’s the point. If governance slows people down, they route around it.',
        '<b>The record is the quiet win:</b> every decision is tied to an agent, project and run, so an audit question takes minutes, not weeks of digging.',
        '<b>Adoption is a configuration change:</b> teams keep their tools and point them at a new URL with a few headers. Hosted or in their own environment.',
      ],
      ask: 'How many different AI tools or vendors are your teams using? Each one is somewhere you’d otherwise have to build these controls yourself.',
      objection: '“Won’t this slow things down?” Don’t promise a number. Show it: the demo displays the real time of every request.',
      next: 'Rather than tell you, let me show you.',
    },
  },
  {
    id: 'demo',
    title: 'Let’s see it',
    html: () => `
      <p class="d-sub">Real requests through Layer One. Switch it off to see the difference.</p>
      <div class="d-grid d-2 d-demo">
        ${go('apps:chat', 'chat', 'Ask AI', 'A company AI chat · 5 minutes')}
        ${go('apps:benefits', 'landmark', 'A day in the life', 'Benefits, acquisition, FOIA, DoD')}
        ${go('apps:data', 'db', 'AI agents and your data', 'An agent that queries a database')}
        ${go('console', 'search', 'Behind the scenes', 'The request, the checks, the audit record')}
      </div>`,
    talk: {
      key: 'Let them see it catch real problems, then flip it off and see what gets through.',
      points: [
        '<b>Set it up:</b> “Everything you’re about to see is a real request going through Layer One. I’ll also switch it off, so you can see exactly what it’s catching.”',
        '<b>Let them choose</b> the scenario closest to their mission; people lean in when it looks like their own job.',
        '<b>Rule of thumb:</b> short slot or a mixed audience, Ask AI. Program staff, A day in the life. Data or agent teams, AI agents and your data. Security or engineering, Behind the scenes, then Connect.',
      ],
      ask: 'Which of these looks most like your day-to-day?',
      next: 'Click a card to start.',
    },
  },
];

const card = (ic, t, d) => `<div class="d-card"><span class="d-ic">${icon(ic)}</span><b>${t}</b><p>${d}</p></div>`;
const outcome = (tone, t, d) => `<div class="d-out ${tone}"><span class="d-led"></span><b>${t}</b><small>${d}</small></div>`;
const go = (to, ic, t, d) => `<button type="button" class="d-go" data-goto="${to}"><span class="d-ic">${icon(ic)}</span><span class="d-go-t"><b>${t}</b><small>${d}</small></span><span class="d-go-arrow">${icon('arrow')}</span></button>`;

const st = { i: 0, notes: true, customer: null };
try {
  st.i = Math.min(Number(sessionStorage.getItem('l1-slide')) || 0, SLIDES.length - 1);
  st.notes = sessionStorage.getItem('l1-notes') !== '0';
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
        <p class="muted small deck-help">← → to move · F to present full screen · N to show or hide talking points</p>
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
      <button type="button" class="secondary" id="deckNotes" aria-pressed="${st.notes}">${st.notes ? 'Hide talking points' : 'Talking points'}</button>
      <button type="button" class="con-go" id="deckFull">⛶ Present</button>
    </span>`;
  const notes = $('.deck-notes', root);
  notes.hidden = !st.notes;
  const t = s.talk;
  notes.innerHTML = `
    <div class="tp-head"><span class="tp-label">Talking points</span><span class="muted small">Slide ${st.i + 1} of ${SLIDES.length} · not shown when presenting</span></div>
    <p class="tp-key">${t.key}</p>
    <ul class="tp-list">${t.points.map((p) => `<li>${p}</li>`).join('')}</ul>
    ${t.ask ? `<p class="tp-ask"><span>Ask the room</span>${t.ask}</p>` : ''}
    ${t.objection ? `<p class="tp-obj"><span>If they say…</span>${t.objection}</p>` : ''}
    <p class="tp-next"><span>Lead-in to the next slide</span>${t.next}</p>`;
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
