// Sample applications: everyday work tools whose AI features run through
// LayerOne, with a switch to turn LayerOne off and a side-by-side comparison.
import { readTraceStream, LEAK_RE, REDACTED_RE } from './stream.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtSec = (ms) => `${(ms / 1000).toFixed(1)} s`;
const fmtInt = (n) => Number(n || 0).toLocaleString('en-US');
const COST_PER_M_TOKENS = 2.5; // illustrative input price, USD per million tokens

const state = {
  apps: [],
  config: null,
  appId: 'benefits',
  workflowId: null,
  protected: true,
  compare: false,
  showHidden: false,
  models: {}, // workflow key -> chosen model id
  results: {}, // workflow key -> { on, off } each { trace, running, startedAt, error }
};

const key = () => `${state.appId}:${state.workflowId}`;
const currentApp = () => state.apps.find((a) => a.id === state.appId);
const currentWorkflow = () => currentApp()?.workflows.find((w) => w.id === state.workflowId);

function remember() {
  try {
    localStorage.setItem('l1-sample', JSON.stringify({ appId: state.appId, workflowId: state.workflowId, protected: state.protected, compare: state.compare }));
  } catch {}
}
function restore() {
  try {
    Object.assign(state, JSON.parse(localStorage.getItem('l1-sample') || '{}'));
  } catch {}
}

// Highlight personal data the AI saw (red) and what LayerOne removed (amber).
function markup(text) {
  return esc(text)
    .replace(new RegExp(LEAK_RE.source, 'gi'), (m) => `<mark class="leak" title="Personal data">${m}</mark>`)
    .replace(REDACTED_RE, (m) => `<mark title="Removed by LayerOne">${m}</mark>`)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

// ---------- rendering ----------
function render() {
  const root = $('#sampleRoot');
  const app = currentApp();
  if (!app) {
    root.innerHTML = '<p class="empty">Loading…</p>';
    return;
  }
  const wf = currentWorkflow();
  root.innerHTML = `
    <div class="app-switch" role="tablist" aria-label="Sample application">
      ${state.apps
        .map(
          (a) => `<button role="tab" class="app-card ${a.id === app.id ? 'active' : ''}" data-app="${esc(a.id)}" aria-selected="${a.id === app.id}">
            <span class="app-icon">${a.icon}</span>
            <span><b>${esc(a.org)}</b><small>${esc(a.sector)} · ${esc(a.person.role)}</small></span>
          </button>`,
        )
        .join('')}
    </div>

    <div class="appwin ${state.protected || state.compare ? '' : 'unprotected'}" data-app="${esc(app.id)}">
      <header class="appwin-bar">
        <div class="appwin-brand"><span class="app-icon">${app.icon}</span><b>${esc(app.org)}</b><span class="product">${esc(app.product)}</span><span class="fictional">fictional</span></div>
        <div class="appwin-tools">
          <label class="l1-switch ${state.compare ? 'disabled' : ''}" title="Turn LayerOne on or off for this app">
            <input type="checkbox" id="l1Toggle" ${state.protected ? 'checked' : ''} ${state.compare ? 'disabled' : ''} />
            <span class="track"><span class="knob"></span></span>
            <span class="l1-label">🛡️ LayerOne <b>${state.compare ? 'ON & OFF' : state.protected ? 'ON' : 'OFF'}</b></span>
          </label>
          <button class="compare-btn ${state.compare ? 'active' : ''}" id="compareBtn" aria-pressed="${state.compare}">⇆ Compare</button>
          <div class="who"><span class="avatar">${esc(app.person.initials)}</span><span><b>${esc(app.person.name)}</b><small>${esc(app.person.role)}</small></span></div>
        </div>
      </header>
      ${!state.protected && !state.compare ? '<div class="ribbon">⚠️ LayerOne is OFF. AI requests go straight to the model: nothing is checked, removed, or recorded.</div>' : ''}
      ${state.compare ? '<div class="ribbon compare">⇆ Compare mode: each AI action runs twice, with LayerOne and without it, side by side.</div>' : ''}

      <div class="appwin-body">
        <aside class="day">
          <div class="day-title">${esc(app.person.name.split(' ')[0])}'s day</div>
          <ol class="day-list">
            ${app.workflows
              .map(
                (w) => `<li><button class="day-item ${w.id === wf.id ? 'active' : ''}" data-wf="${esc(w.id)}">
                  <span class="time">${esc(w.time)}</span>
                  <span class="what"><b>${esc(w.title)}</b><span class="policy">${esc(w.policy)}</span></span>
                </button></li>`,
              )
              .join('')}
          </ol>
          <p class="day-note">${esc(app.tagline)}</p>
        </aside>

        <section class="work">
          <div class="crumb">${esc(wf.section)} · ${esc(wf.time)}</div>
          <h2 class="work-title">${esc(wf.title)}</h2>
          <p class="story">${esc(wf.story)}</p>
          ${renderScreen(wf)}
          <div class="action-row">
            ${renderModelPicker(wf)}
            <button class="ai-btn" id="aiBtn">✨ ${esc(wf.action)}</button>
          </div>
          <div class="results ${state.compare ? 'two' : ''}">${renderResults()}</div>
          <details class="talk">
            <summary>Presenter notes: what to say</summary>
            <p><b>With LayerOne:</b> ${esc(wf.talk.on)}</p>
            <p><b>Without LayerOne:</b> ${esc(wf.talk.off)}</p>
            <p class="muted">Policy shown: <b>${esc(wf.policy)}</b>. Open <a href="#" data-goto-console>Behind the scenes</a> to show the request, LayerOne's checks and the audit record.</p>
          </details>
        </section>
      </div>
    </div>`;
  wire();
}

function renderScreen(wf) {
  const s = wf.screen;
  if (s.type === 'email') {
    return `<article class="screen email">
      <div class="email-head"><b>${esc(s.subject)}</b><span>${esc(s.received)}</span></div>
      <div class="email-from">From: ${esc(s.from)}</div>
      <div class="email-body">${esc(s.body).replace(/\n/g, '<br>')}${
        s.hidden ? `<span class="hidden-text ${state.showHidden ? 'shown' : ''}">${esc(s.hidden)}</span>` : ''
      }</div>
      ${s.hidden ? `<button class="reveal" id="revealBtn">${state.showHidden ? '🙈 Hide' : '👁 Reveal'} hidden text</button>` : ''}
    </article>`;
  }
  if (s.type === 'document') {
    return `<article class="screen doc">
      <div class="doc-head"><span class="doc-icon">📄</span><span><b>${esc(s.title)}</b><small>${esc(s.meta)} · ${fmtInt(Math.round(s.size / 4))} tokens</small></span></div>
      <pre class="doc-excerpt">${esc(s.excerpt)}…</pre>
    </article>`;
  }
  return `<article class="screen chat">
    <div class="bubble me"><span class="avatar small">${esc(currentApp().person.initials)}</span><p>${esc(s.message)}</p></div>
  </article>`;
}

function modelOptions(wf) {
  return (wf.screen.models || []).map((m) => ({ ...m, id: m.id === '$approved' ? state.config?.model || 'demo-model' : m.id }));
}

function renderModelPicker(wf) {
  const opts = modelOptions(wf);
  if (!opts.length) return '';
  const chosen = state.models[key()] || opts.find((m) => m.default)?.id || opts[0].id;
  return `<label class="model-pick">AI model
    <select id="modelPick">${opts
      .map((m) => `<option value="${esc(m.id)}" ${m.id === chosen ? 'selected' : ''}>${esc(m.label)}${m.id.startsWith('deepseek') ? '' : ` (${esc(m.id)})`}</option>`)
      .join('')}</select></label>`;
}

function renderResults() {
  const r = state.results[key()] || {};
  if (state.compare) return renderPanel(r.on, true, 'With LayerOne') + renderPanel(r.off, false, 'Without LayerOne');
  return renderPanel(state.protected ? r.on : r.off, state.protected, null);
}

function renderPanel(slot, prot, heading) {
  const head = heading ? `<div class="panel-head ${prot ? 'on' : 'off'}">${prot ? '🛡️' : '⚠️'} ${esc(heading)}</div>` : '';
  if (!slot) return `<div class="panel idle">${head}<p class="muted">Click <b>${esc(currentWorkflow().action)}</b> to see what happens${heading ? '' : prot ? ' with LayerOne on' : ' with LayerOne off'}.</p></div>`;
  if (slot.error) return `<div class="panel">${head}<div class="notice bad">${esc(slot.error)}</div></div>`;
  const t = slot.trace;
  if (slot.running || !t || t.status === 'running') {
    const elapsed = fmtSec(performance.now() - slot.startedAt);
    return `<div class="panel working">${head}<div class="working-row"><div class="spinner"></div><p>${prot ? '🛡️ LayerOne is checking the request…' : 'Sending straight to the AI model…'} <span class="muted">${elapsed}</span></p></div></div>`;
  }
  return `<div class="panel">${head}${notice(t)}${body(t)}${footer(t)}</div>`;
}

// What the employee sees from LayerOne, in product language.
function notice(t) {
  const g = t.governance || {};
  const pol = g.policies || [];
  const by = (r) => pol.filter((p) => p.result === r);
  if (t.bypass) {
    const leaks = (t.output || '').match(new RegExp(LEAK_RE.source, 'gi')) || [];
    const issues = [];
    const wf = t.workflow;
    const model = t.request?.body?.model || '';
    if (leaks.length) issues.push(`${leaks.length} piece${leaks.length > 1 ? 's' : ''} of personal data went to the AI model and came back in the answer`);
    if (t.promptTokens > 8000) issues.push(`about ${fmtInt(t.promptTokens)} tokens were sent in one request, with no limit`);
    if (wf === 'unapproved-model' && /deepseek|qwen|public/i.test(model)) issues.push(`the data went to "${model}", a model that is not approved`);
    if (wf === 'eligibility' || wf === 'advice') issues.push('the answer was not checked for accuracy or policy compliance');
    if (wf === 'hidden-instructions' && /^Done\./.test(t.output || '')) issues.push('the AI followed instructions hidden in the email');
    return `<div class="notice bad"><b>⚠️ Not protected.</b> Sent directly to the AI model. Nothing was checked, removed, or recorded.${
      issues.length ? `<ul>${issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''
    }${t.bypassNote ? `<small>${esc(t.bypassNote)}</small>` : ''}</div>`;
  }
  if (t.status === 'error' && g.decision !== 'blocked') return `<div class="notice bad"><b>Something went wrong.</b> ${esc(t.error || '')}</div>`;
  if (g.decision === 'blocked') {
    const b = by('block')[0];
    const hint = b?.id === 'L1-IN-005' ? ' Choose an approved model to continue.' : b?.id === 'L1-IN-006' ? ' Try summarizing one section at a time.' : '';
    return `<div class="notice bad"><b>🛡️ Blocked by LayerOne.</b> ${esc(b ? `${b.name}: ${b.detail}.` : t.output || '')}${esc(hint)}<small>The request was not sent to the AI model.</small></div>`;
  }
  if (g.decision === 'held') {
    const h = by('hold')[0];
    return `<div class="notice warn"><b>🛡️ Held for review.</b> LayerOne's judge checked this answer and stopped it from reaching you. ${esc(h?.detail || '')}<small>A supervisor can review and release it.</small></div>`;
  }
  const removed = by('redact');
  if (removed.length) {
    return `<div class="notice warn"><b>🛡️ LayerOne protected personal data.</b> ${removed.map((p) => esc(`${p.detail}${p.stage === 'output' ? '' : ' before sending to the AI'}.`)).join(' ')}</div>`;
  }
  return `<div class="notice ok"><b>🛡️ Checked by LayerOne.</b> ${pol.length ? `${pol.length} checks passed.` : 'Approved.'}</div>`;
}

function body(t) {
  const g = t.governance || {};
  if (!t.bypass && (g.decision === 'blocked' || g.decision === 'held' || t.status === 'error')) return '';
  return `<pre class="ai-output">${markup(t.output || '')}</pre>`;
}

function footer(t) {
  const tokens = t.usage?.prompt_tokens || t.promptTokens;
  const cost = tokens ? ` · ≈ $${((tokens / 1e6) * COST_PER_M_TOKENS).toFixed(tokens > 20000 ? 2 : 4)} input` : '';
  const sent = t.governance?.decision === 'blocked' ? 'nothing sent to the AI model' : `${fmtInt(tokens)} tokens sent to the AI model${cost}`;
  return `<div class="panel-foot"><span class="muted">${fmtSec(t.totalMs || 0)} · ${sent}</span>
    <a href="#" class="see" data-trace="${esc(t.id)}">${t.bypass ? 'See the unprotected request' : 'See what LayerOne did'} →</a></div>`;
}

// ---------- behavior ----------
function wire() {
  document.querySelectorAll('.app-card').forEach((b) => (b.onclick = () => selectApp(b.dataset.app)));
  document.querySelectorAll('.day-item').forEach((b) => (b.onclick = () => selectWorkflow(b.dataset.wf)));
  $('#l1Toggle')?.addEventListener('change', (e) => {
    state.protected = e.target.checked;
    remember();
    render();
  });
  $('#compareBtn').onclick = () => {
    state.compare = !state.compare;
    remember();
    render();
  };
  $('#revealBtn')?.addEventListener('click', () => {
    state.showHidden = !state.showHidden;
    render();
  });
  $('#modelPick')?.addEventListener('change', (e) => {
    state.models[key()] = e.target.value;
    delete state.results[key()];
    render();
  });
  $('#aiBtn').onclick = runAction;
  document.querySelectorAll('[data-trace]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('l1:show-trace', { detail: { id: a.dataset.trace } }));
    }),
  );
  document.querySelectorAll('[data-goto-console]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('l1:view', { detail: 'console' }));
    }),
  );
}

function selectApp(id) {
  state.appId = id;
  state.workflowId = currentApp().workflows[0].id;
  state.showHidden = false;
  remember();
  render();
}

function selectWorkflow(id) {
  state.workflowId = id;
  state.showHidden = false;
  remember();
  render();
}

async function runOne(k, prot) {
  const wf = currentWorkflow();
  const slotName = prot ? 'on' : 'off';
  const slot = { running: true, startedAt: performance.now(), trace: null };
  (state.results[k] ||= {})[slotName] = slot;
  refreshResults();
  const tick = setInterval(() => key() === k && refreshResults(), 100);
  try {
    const opts = modelOptions(wf);
    const model = opts.length ? state.models[k] || opts.find((m) => m.default)?.id || opts[0].id : undefined;
    const res = await fetch('/api/app/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: state.appId, workflow: wf.id, protected: prot, model }),
    });
    await readTraceStream(res, (t) => (slot.trace = t));
  } catch (err) {
    slot.error = err.message;
  } finally {
    slot.running = false;
    clearInterval(tick);
    if (key() === k) refreshResults();
  }
}

function refreshResults() {
  const box = $('.results');
  if (!box) return;
  box.innerHTML = renderResults();
  box.querySelectorAll('[data-trace]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('l1:show-trace', { detail: { id: a.dataset.trace } }));
    }),
  );
}

async function runAction() {
  const btn = $('#aiBtn');
  btn.disabled = true;
  const k = key();
  delete state.results[k];
  try {
    if (state.compare) await Promise.all([runOne(k, true), runOne(k, false)]);
    else await runOne(k, state.protected);
  } finally {
    if (key() === k) {
      const b = $('#aiBtn');
      if (b) b.disabled = false;
    }
  }
}

// ---------- start ----------
export async function initSample() {
  restore();
  try {
    const [apps, config] = await Promise.all([fetch('/api/apps').then((r) => r.json()), fetch('/api/config').then((r) => r.json())]);
    state.apps = apps;
    state.config = config;
  } catch {
    $('#sampleRoot').innerHTML = '<p class="mode-note bad">The sample apps cannot reach their backend. See "Deploy to Cloudflare" in the README.</p>';
    return;
  }
  if (!currentApp()) state.appId = state.apps[0].id;
  if (!currentWorkflow()) state.workflowId = currentApp().workflows[0].id;
  render();
  // Settings may change the approved model name; keep the picker in sync.
  window.addEventListener('l1:config', (e) => {
    state.config = e.detail;
    render();
  });
}
