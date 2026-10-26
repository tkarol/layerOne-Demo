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
        <div class="d-chips"><span>AI governance gateway</span><span>For apps and agents</span><span>Any OpenAI-compatible client</span></div>
        ${ctx.customer ? `<div class="d-for">Prepared for <b>${esc(ctx.customer)}</b></div>` : ''}
      </div>`,
    notes: 'Set the frame: AI is already in daily work. Today is about how to keep it safe, compliant and accountable without slowing anyone down. About 5 minutes of slides, then a live demo.',
  },
  {
    id: 'problem',
    title: 'AI is already in the workflow. Governance is not.',
    html: () => `
      <p class="d-sub">Employees, apps and agents send agency data to AI models every day. Each request can go wrong in a few predictable ways.</p>
      <div class="d-grid d-4">
        ${card('🔓', 'Data leaves the boundary', 'SSNs, health details or CUI pasted into a prompt go straight to an outside model.', 'bad')}
        ${card('🧭', 'Unapproved models', 'Anyone can point a tool at a public or foreign-developed model. Nobody sees it happen.', 'bad')}
        ${card('🎭', 'Manipulated AI', 'Hidden instructions in an email or record can make an agent leak data or take actions.', 'bad')}
        ${card('❓', 'Confident wrong answers', 'A made-up rule or citation reads like fact and ends up in a decision or a letter.', 'bad')}
      </div>
      <div class="d-callout">And afterwards, there is usually <b>no record</b> of what was sent, to which model, or why.</div>`,
    notes: 'Make it concrete for this customer: caseworkers, contracting officers, FOIA staff, analysts. Every example here is something the demo shows live.',
  },
  {
    id: 'gap',
    title: 'Why today’s controls fall short',
    html: () => `
      <div class="d-grid d-3">
        ${card('🧩', 'Guardrails per app', 'Each team builds its own, or doesn’t. Rules differ from app to app and drift over time.')}
        ${card('🌐', 'Network tools can’t read prompts', 'Firewalls and DLP see encrypted traffic to an AI provider, not what is in the request.')}
        ${card('📄', 'Policy on paper', 'An acceptable-use policy tells people what to do. It doesn’t stop a request.')}
      </div>
      <div class="d-callout ok">Governance has to sit <b>in the path of every AI request</b>: the same rules for every app, agent and model.</div>`,
    notes: 'The point: enforcement belongs at one choke point, not in every application. That is the gap Layer One fills.',
  },
  {
    id: 'what',
    title: 'Layer One: one gateway between your AI and the models',
    html: () => `
      <div class="d-flow">
        <div class="d-node">${ico('🖥️')}<b>Your apps &amp; agents</b><small>Web apps, chat tools, LangChain / LangGraph agents, scripts</small></div>
        <div class="d-arrow">⇄</div>
        <div class="d-node d-l1">${ico('🛡️')}<b>Layer One</b><small>Checks every request and every answer, routes to approved models, records it all</small></div>
        <div class="d-arrow">⇄</div>
        <div class="d-node">${ico('✦')}<b>AI models</b><small>Commercial APIs, government cloud, self-hosted</small></div>
      </div>
      <div class="d-grid d-3 d-tight">
        ${point('Drop-in', 'Point any OpenAI-compatible client at Layer One. No code changes beyond a few attribution headers.')}
        ${point('Consistent', 'One set of policies for every app, agent and model.')}
        ${point('Accountable', 'Every call attributed to an agent, project and run, with an audit trail.')}
      </div>`,
    notes: 'Layer One sits in the path, like a gateway. Apps keep using the same OpenAI-style API they already use; only the base URL and a few headers change.',
  },
  {
    id: 'architecture',
    title: 'How it works',
    html: () => `
      <div class="d-arch">
        <div class="d-col">
          <div class="d-col-h">Apps &amp; agents</div>
          <div class="d-box">Web apps</div><div class="d-box">AI agents</div><div class="d-box">Chat tools</div>
          <div class="d-hdr"><code>x-layerone-agent-id</code><code>x-layerone-project-id</code><code>x-layerone-run-id</code></div>
        </div>
        <div class="d-arch-arrow"><span>request</span>→<br />←<span>answer</span></div>
        <div class="d-col d-gw">
          <div class="d-col-h">Layer One gateway</div>
          <ol class="d-steps">
            <li><b>Identify</b> the caller from its key, and attribute the call to an agent, project and run</li>
            <li><b>Check the request</b>: personal data, CUI markings, prompt injection, size limits, approved models</li>
            <li><b>Route</b> to an approved model</li>
            <li><b>Check the answer</b>: personal data, and an LLM judge for accuracy and policy</li>
            <li><b>Record</b> the decision, evidence and traces; stamp the response with governance headers</li>
          </ol>
        </div>
        <div class="d-arch-arrow"><span>approved</span>→<br />←<span>answer</span></div>
        <div class="d-col">
          <div class="d-col-h">AI models</div>
          <div class="d-box">Commercial APIs</div><div class="d-box">Government cloud</div><div class="d-box">Self-hosted</div>
        </div>
      </div>
      <div class="d-band"><span>📜 Audit record per request</span><span>🔎 Traces (MLflow)</span><span>💲 Cost by agent &amp; project</span><span>🏷️ Governance headers on every response</span></div>`,
    notes: 'Walk left to right. The request is checked before any model sees it; the answer is checked before any person sees it. Everything in between is recorded, which is what auditors ask for.',
  },
  {
    id: 'decisions',
    title: 'Every request gets a decision',
    html: () => `
      <div class="d-grid d-4">
        ${decision('Pass', 'ok', 'Nothing risky. It goes through untouched, so normal work is not slowed down.', 'Draft an out-of-office message')}
        ${decision('Redact', 'warn', 'Sensitive data is removed before the model sees it, or from the answer before a person does.', 'SSN, date of birth, phone number')}
        ${decision('Block', 'bad', 'The request never reaches a model.', 'CUI markings, prompt injection, an unapproved model, oversized requests')}
        ${decision('Hold', 'warn', 'The answer is held for review when the judge finds it wrong or out of policy.', 'An invented regulation or exemption')}
      </div>
      <p class="d-sub">The decision travels with the response as headers, with an evidence ID that links to the audit record.</p>`,
    notes: 'These four outcomes are exactly what the demo shows. Point out that Pass matters: governance should be invisible for normal work.',
  },
  {
    id: 'deploy',
    title: 'Getting started is a configuration change',
    html: () => `
      <div class="d-grid d-2">
        <div class="d-panel">
          <div class="d-tag">Mode B · recommended first step</div>
          <h3>Proxy gateway</h3>
          <p>Point your agent’s OpenAI-compatible client at Layer One and add the attribution headers. Works with any language or framework.</p>
          <pre>client = OpenAI(
    base_url="https://&lt;your-layer-one-endpoint&gt;",
    api_key=…,
)
client.chat.completions.create(…,
    extra_headers={"x-layerone-agent-id": "…"})</pre>
        </div>
        <div class="d-panel">
          <div class="d-tag">Mode A · deeper instrumentation</div>
          <h3>Python SDK</h3>
          <p>Instrument a Python (LangChain / LangGraph) agent in-process for fine-grained spans and sessions. Many teams run both.</p>
          <div class="d-tag">Where it runs</div>
          <p><b>Hosted</b> (preview: endpoint and key provisioned for you) or <b>self-hosted</b> in your own environment.</p>
        </div>
      </div>`,
    notes: 'Low lift: most teams start with the proxy, because it needs no code changes beyond headers. The SDK adds detail for Python agents.',
  },
  {
    id: 'outcomes',
    title: 'What you get',
    html: () => `
      <div class="d-grid d-3">
        ${card('🛡️', 'Policy enforced at the edge', 'The same guardrails for every app and agent, independent of language or framework.', 'ok')}
        ${card('🔐', 'Data stays protected', 'Personal data and controlled information are removed or blocked before they leave.', 'ok')}
        ${card('✅', 'Answers you can trust', 'An LLM judge holds answers that are wrong or out of policy.', 'ok')}
        ${card('📜', 'Evidence for audits', 'Every request has a decision, an evidence ID and a trace.', 'ok')}
        ${card('💲', 'Cost attribution', 'See AI usage and cost by agent and project; cap oversized requests.', 'ok')}
        ${card('⚡', 'Fast adoption', 'Teams keep their tools. Governance is a base URL and a few headers.', 'ok')}
      </div>`,
    notes: 'Tie each outcome back to a pain from slide 2. Then: let’s see it.',
  },
  {
    id: 'demo',
    title: 'Let’s see it',
    html: () => `
      <p class="d-sub">Real requests through Layer One. Switch it off to see what happens without it.</p>
      <div class="d-grid d-2 d-demo">
        ${go('apps:chat', '💬', 'Ask AI', 'A company AI chat: personal data, a jailbreak attempt and a risky answer. 5 minutes.')}
        ${go('apps:benefits', '🏛️', 'A day in the life', 'Federal workflows: benefits, acquisition, FOIA and DoD sustainment.')}
        ${go('apps:data', '🗄️', 'AI agents and your data', 'An AI agent that queries a database, with Layer One in the path.')}
        ${go('console', '🔍', 'Behind the scenes', 'The actual request, Layer One’s checks, and the audit record.')}
      </div>`,
    notes: 'Pick the path for this audience. For a short slot: Ask AI. For federal program staff: a day in the life. For technical teams: Behind the scenes, then Connect.',
  },
];

const ico = (e) => `<span class="d-ico">${e}</span>`;
const card = (e, t, d, tone = '') => `<div class="d-card ${tone}">${ico(e)}<b>${t}</b><p>${d}</p></div>`;
const point = (t, d) => `<div class="d-point"><b>${t}</b><p>${d}</p></div>`;
const decision = (t, tone, d, ex) => `<div class="d-card d-dec ${tone}"><span class="d-pill ${tone}">${t}</span><p>${d}</p><small>e.g. ${ex}</small></div>`;
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
