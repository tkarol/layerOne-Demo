// Sample applications: everyday work tools whose AI features run through
// LayerOne, with a switch to turn LayerOne off, a side-by-side comparison,
// customer profiles (white-labeling), step editing and a guided "Play the day".
import { readTraceStream, LEAK_RE, REDACTED_RE } from './stream.js';
import { openCustomize, authHeaders } from './customize.js';
import { mountDataApp } from './data-app.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtSec = (ms) => `${(ms / 1000).toFixed(1)} s`;
const fmtInt = (n) => Number(n || 0).toLocaleString('en-US');
const COST_PER_M_TOKENS = 2.5; // illustrative input price, USD per million tokens

const state = {
  apps: [],
  customer: null, // active customer profile { id, name } or null
  config: null,
  appId: 'benefits',
  workflowId: null,
  protected: true,
  compare: false,
  showHidden: false,
  editing: false,
  models: {}, // workflow key -> chosen model id
  results: {}, // workflow key -> { on, off } each { trace, running, startedAt, error }
  play: null, // guided "Play the day" run, see play()
};

const key = () => `${state.appId}:${state.workflowId}`;
const currentApp = () => state.apps.find((a) => a.id === state.appId);
const currentWorkflow = () => currentApp()?.workflows.find((w) => w.id === state.workflowId);
const findWf = (appId, wfId) => state.apps.find((a) => a.id === appId)?.workflows.find((w) => w.id === wfId);
const firstName = (name) => String(name || '').split(' ')[0];

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

// Text color that reads on the brand color.
function inkFor(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return lum > 0.4 ? '#111827' : '#ffffff';
}

// Highlight data the AI saw (red) and what LayerOne removed (amber).
function markup(text) {
  return esc(text)
    .replace(new RegExp(LEAK_RE.source, 'gi'), (m) => `<mark class="leak" title="Sensitive data">${m}</mark>`)
    .replace(REDACTED_RE, (m) => `<mark title="Removed by LayerOne">${m}</mark>`)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

// The app picker starts collapsed to the current app; remembered per browser.
function pickerOpen() {
  try {
    return localStorage.getItem('l1-picker') === 'open';
  } catch {
    return false;
  }
}
function setPicker(open) {
  try {
    localStorage.setItem('l1-picker', open ? 'open' : 'closed');
  } catch {}
  render();
}

// Optional features, turned on in Settings (both off by default).
const features = () => state.config?.features || { play: false, customize: false };

const pacePick = (fast, normal, slow) => ({ fast, normal, slow })[state.config?.pace] ?? normal;

// ---------- rendering ----------
function render() {
  const root = $('#sampleRoot');
  const app = currentApp();
  if (!app) {
    root.innerHTML = '<p class="empty">Loading…</p>';
    return;
  }
  const wf = currentWorkflow();
  const isData = app.type === 'data';
  const compare = state.compare && !isData; // the database app runs one way at a time
  const color = app.brand?.color || '#0f766e';
  const logo = app.brand?.logo ? `<img class="brand-logo" src="${esc(app.brand.logo)}" alt="" />` : `<span class="app-icon">${app.icon}</span>`;
  root.innerHTML = `
    <div class="demo-bar">
      <div class="prepared">${state.customer ? `<span class="for">Prepared for <b>${esc(state.customer.name)}</b></span>` : ''}${
        pickerOpen()
          ? ''
          : `<span class="app-picker-bar"><span class="muted">Sample app:</span>
            <span class="current-app" style="--app:${esc(color)}">${app.brand?.logo ? `<img class="card-logo" src="${esc(app.brand.logo)}" alt="" />` : `<span class="app-icon">${app.icon}</span>`}<b>${esc(app.org)}</b><small>${esc(app.sector)}</small></span>
            ${state.apps.length > 1 ? `<button class="link-btn" id="pickerToggle">Switch app (${state.apps.length}) ▾</button>` : ''}</span>`
      }</div>
      <div class="demo-actions">
        ${features().customize ? '<button class="demo-btn" id="customizeBtn" title="White-label the apps for a customer">🎨 Customize</button>' : ''}
        <button class="demo-btn" id="presentBtn" title="Full-screen presenter view">⛶ Present</button>
        ${features().play && !isData ? `<button class="demo-btn play" id="playBtn" ${state.play ? 'disabled' : ''} title="Run the whole day automatically, with captions">▶ Play ${esc(firstName(app.person.name))}'s day</button>` : ''}
      </div>
    </div>


    <div class="app-switch" role="tablist" aria-label="Sample application" ${pickerOpen() ? '' : 'hidden'}>
      ${state.apps
        .map(
          (a) => `<button role="tab" class="app-card ${a.id === app.id ? 'active' : ''}" data-app="${esc(a.id)}" aria-selected="${a.id === app.id}" style="--app:${esc(a.brand?.color || '#0f766e')}">
            ${a.brand?.logo ? `<img class="card-logo" src="${esc(a.brand.logo)}" alt="" />` : `<span class="app-icon">${a.icon}</span>`}
            <span><b>${esc(a.org)}</b><small>${esc(a.sector)} · ${esc(a.person.role)}</small></span>
          </button>`,
        )
        .join('')}
      <button class="link-btn picker-hide" id="pickerHide">Hide ▴</button>
    </div>

    <div class="appwin ${state.protected || compare ? '' : 'unprotected'}" style="--app:${esc(color)};--app-ink:${inkFor(color)}">
      <header class="appwin-bar">
        <div class="appwin-brand">${logo}<b>${esc(app.org)}</b><span class="product">${esc(app.product)}</span>${state.customer ? '' : '<span class="fictional">fictional</span>'}</div>
        <div class="appwin-tools">
          <label class="l1-switch ${compare ? 'disabled' : ''}" title="Turn LayerOne on or off for this app">
            <input type="checkbox" id="l1Toggle" ${state.protected ? 'checked' : ''} ${compare ? 'disabled' : ''} />
            <span class="track"><span class="knob"></span></span>
            <span class="l1-label">🛡️ LayerOne <b>${compare ? 'ON & OFF' : state.protected ? 'ON' : 'OFF'}</b></span>
          </label>
          ${isData ? '' : `<button class="compare-btn ${compare ? 'active' : ''}" id="compareBtn" aria-pressed="${compare}">⇆ Compare</button>`}
          <div class="who"><span class="avatar">${esc(app.person.initials)}</span><span><b>${esc(app.person.name)}</b><small>${esc(app.person.role)}</small></span></div>
        </div>
      </header>
      ${!state.protected && !compare ? `<div class="ribbon">⚠️ LayerOne is OFF. ${isData ? 'The AI’s database queries run unchecked, including deletes.' : 'AI requests go straight to the model: nothing is checked, removed, or recorded.'}</div>` : ''}
      ${compare ? '<div class="ribbon compare">⇆ Compare mode: each AI action runs twice, with LayerOne and without it, side by side.</div>' : ''}

      ${isData ? '<div class="appwin-body data-body"><div id="dataRoot"></div></div>' : renderDayBody(app, wf)}
    </div>`;
  wire();
  if (isData) mountDataApp({ el: $('#dataRoot'), isProtected: () => state.protected, paceMs: () => pacePick(350, 800, 1200), person: app.person });
}

function renderDayBody(app, wf) {
  return `<div class="appwin-body">
        <aside class="day">
          <div class="day-title">${esc(firstName(app.person.name))}'s day</div>
          <ol class="day-list">
            ${app.workflows
              .map(
                (w) => `<li><button class="day-item ${w.id === wf.id ? 'active' : ''}" data-wf="${esc(w.id)}">
                  <span class="time">${esc(w.time)}</span>
                  <span class="what"><b>${esc(w.title)}</b><span class="policy">${esc(w.policy)}</span>${w.edited ? '<span class="edited" title="Edited for this customer">✏️</span>' : ''}</span>
                </button></li>`,
              )
              .join('')}
          </ol>
          <p class="day-note">${esc(app.tagline)}</p>
        </aside>

        <section class="work">${state.editing ? renderEditor(wf) : renderWork(wf)}</section>
      </div>`;
}

function renderWork(wf) {
  return `
    <div class="crumb-row"><div class="crumb">${esc(wf.section)} · ${esc(wf.time)}</div>
      ${features().customize ? '<button class="edit-btn" id="editBtn" title="Rewrite this step for a customer">✏️ Edit step</button>' : ''}</div>
    <h2 class="work-title">${esc(wf.title)}</h2>
    <p class="story">${esc(wf.story)}</p>
    ${renderScreen(wf)}
    <div class="action-row">
      ${renderModelPicker(wf)}
      <button class="ai-btn" id="aiBtn" ${state.play ? 'disabled' : ''}>✨ ${esc(wf.action)}</button>
    </div>
    <div class="results ${state.compare ? 'two' : ''}">${renderResults()}</div>
    <details class="talk">
      <summary>Presenter notes: what to say</summary>
      <p><b>With LayerOne:</b> ${esc(wf.talk.on)}</p>
      <p><b>Without LayerOne:</b> ${esc(wf.talk.off)}</p>
      <p class="muted">Policy shown: <b>${esc(wf.policy)}</b>. Open <a href="#" data-goto-console>Behind the scenes</a> to show the request, LayerOne's checks and the audit record.</p>
    </details>`;
}

// Edit the step's text for the active customer profile.
function renderEditor(wf) {
  const s = wf.screen;
  const field = (name, label, value, rows = 0) =>
    `<label>${esc(label)}${rows ? `<textarea name="${name}" rows="${rows}">${esc(value)}</textarea>` : `<input name="${name}" value="${esc(value)}" />`}</label>`;
  const screenFields =
    s.type === 'email'
      ? field('from', 'From', s.from) + field('subject', 'Subject', s.subject) + field('body', 'Email body', s.body, 8) + (s.hidden != null ? field('hidden', 'Hidden text (prompt injection)', s.hidden, 3) : '')
      : s.type === 'document'
        ? field('docTitle', 'Document title', s.title) + '<p class="muted">The document body stays the same, so the token-limit step still triggers.</p>'
        : field('message', 'Question or request', s.message, 4);
  return `
    <form class="step-editor" id="stepEditor">
      <div class="crumb">Editing · ${esc(wf.section)} · ${esc(wf.time)} · for ${esc(state.customer?.name || '')}</div>
      ${field('title', 'Step title', wf.title)}
      ${field('story', 'Story (what the presenter says happens)', wf.story, 3)}
      ${screenFields}
      <p class="muted">In Dry run, the stand-in AI's answers stay the same; names you set in Customize carry through. LayerOne's checks run on whatever you write here.</p>
      <div class="editor-actions">
        <button type="button" class="link-btn" id="resetStep">Reset to original</button>
        <span class="spacer"></span>
        <button type="button" class="secondary" id="cancelEdit">Cancel</button>
        <button type="submit" class="save">Save step</button>
      </div>
      <p class="err" id="editErr"></p>
    </form>`;
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

// What went wrong on an unprotected run, in plain words.
function unprotectedIssues(t) {
  const w = findWf(t.app, t.workflow);
  const leaks = (t.output || '').match(new RegExp(LEAK_RE.source, 'gi')) || [];
  const model = t.request?.body?.model || '';
  // The step's own risk first, then anything else that got through.
  const issues = [];
  if (w?.policy === 'Prompt injection' && /^Done\./.test(t.output || '')) issues.push('the AI followed instructions hidden in the email');
  if (w?.policy === 'Model denylist' && /deepseek|qwen|public/i.test(model)) issues.push(`the data went to "${model}", a model that is not approved`);
  if (w?.policy === 'LLM judge') issues.push('the answer was not checked for accuracy or policy compliance');
  if (/CUI\/\//.test(t.prompt || '')) issues.push('controlled (CUI) data went to an AI model that is not authorized for it');
  if (t.promptTokens > 8000) issues.push(`about ${fmtInt(t.promptTokens)} tokens were sent in one request, with no limit`);
  if (leaks.length) issues.push(`${leaks.length} piece${leaks.length > 1 ? 's' : ''} of sensitive data went to the AI model and came back in the answer`);
  return issues;
}

// What the employee sees from LayerOne, in product language.
function notice(t) {
  const g = t.governance || {};
  const pol = g.policies || [];
  const by = (r) => pol.filter((p) => p.result === r);
  if (t.bypass) {
    const issues = unprotectedIssues(t);
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
    return `<div class="notice warn"><b>🛡️ LayerOne protected sensitive data.</b> ${removed.map((p) => esc(`${p.detail}${p.stage === 'output' ? '' : ' before sending to the AI'}.`)).join(' ')}</div>`;
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
function wireTraceLinks(root = document) {
  root.querySelectorAll('[data-trace]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('l1:show-trace', { detail: { id: a.dataset.trace } }));
    }),
  );
}

function wire() {
  document.querySelectorAll('.app-card').forEach(
    (b) =>
      (b.onclick = () => {
        if (state.play) return;
        try {
          localStorage.setItem('l1-picker', 'closed');
        } catch {}
        selectApp(b.dataset.app);
      }),
  );
  $('#pickerToggle')?.addEventListener('click', () => setPicker(true));
  $('#pickerHide')?.addEventListener('click', () => setPicker(false));
  document.querySelectorAll('.day-item').forEach((b) => (b.onclick = () => !state.play && selectWorkflow(b.dataset.wf)));
  $('#l1Toggle')?.addEventListener('change', (e) => {
    state.protected = e.target.checked;
    remember();
    render();
  });
  if ($('#compareBtn')) $('#compareBtn').onclick = () => {
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
  if ($('#aiBtn')) $('#aiBtn').onclick = runAction;
  $('#customizeBtn')?.addEventListener('click', () => openCustomize({ appId: state.appId, onChange: reloadApps }));
  $('#presentBtn').onclick = togglePresent;
  $('#playBtn')?.addEventListener('click', play);
  $('#editBtn')?.addEventListener('click', () => {
    if (!state.customer) {
      openCustomize({ appId: state.appId, onChange: reloadApps, hint: 'Create a customer profile first. Step edits are saved to it.' });
      return;
    }
    state.editing = true;
    render();
  });
  $('#stepEditor')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveStep(Object.fromEntries(new FormData(e.target)));
  });
  $('#cancelEdit')?.addEventListener('click', () => {
    state.editing = false;
    render();
  });
  $('#resetStep')?.addEventListener('click', () => saveStep(null));
  wireTraceLinks();
  document.querySelectorAll('[data-goto-console]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('l1:view', { detail: 'console' }));
    }),
  );
}

function selectApp(id) {
  state.appId = id;
  state.workflowId = (currentApp().workflows[0]?.id ?? null);
  state.showHidden = false;
  state.editing = false;
  remember();
  render();
}

function selectWorkflow(id) {
  state.workflowId = id;
  state.showHidden = false;
  state.editing = false;
  remember();
  render();
}

async function runOne(k, prot) {
  const wf = currentWorkflow();
  const slot = { running: true, startedAt: performance.now(), trace: null };
  (state.results[k] ||= {})[prot ? 'on' : 'off'] = slot;
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
  return slot;
}

function refreshResults() {
  const box = $('.results');
  if (!box) return;
  box.innerHTML = renderResults();
  wireTraceLinks(box);
}

async function runAction() {
  const btn = $('#aiBtn');
  if (btn) btn.disabled = true;
  const k = key();
  delete state.results[k];
  try {
    if (state.compare) await Promise.all([runOne(k, true), runOne(k, false)]);
    else await runOne(k, state.protected);
  } finally {
    const b = $('#aiBtn');
    if (b && key() === k && !state.play) b.disabled = false;
  }
  return state.results[k];
}

// ---------- customer profiles ----------
async function reloadApps() {
  const data = await fetch('/api/apps').then((r) => r.json());
  state.apps = data.apps;
  state.customer = data.customer;
  if (!currentApp()) state.appId = state.apps[0].id;
  if (!currentWorkflow()) state.workflowId = (currentApp().workflows[0]?.id ?? null);
  state.results = {};
  state.editing = false;
  updateTitle();
  render();
}

function updateTitle() {
  document.title = state.customer ? `Vellox LayerOne Demo · ${state.customer.name}` : 'Vellox LayerOne Demo · Booz Allen';
  const chip = $('#customerChip');
  if (chip) {
    chip.hidden = !state.customer;
    chip.textContent = state.customer ? `for ${state.customer.name}` : '';
  }
}

async function saveStep(fields) {
  const err = $('#editErr');
  try {
    const id = state.customer.id;
    const profile = await fetch(`/api/profiles/${id}`).then((r) => r.json());
    const steps = { ...(profile.steps || {}) };
    if (fields) steps[key()] = fields;
    else delete steps[key()];
    const res = await fetch(`/api/profiles/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ ...profile, steps }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.errors ? Object.values(data.errors).join('; ') : data.error);
    await reloadApps();
  } catch (e) {
    if (err) err.textContent = e.message;
  }
}

// ---------- presenter mode ----------
function togglePresent() {
  const on = !document.body.classList.contains('present');
  document.body.classList.toggle('present', on);
  if (on) document.documentElement.requestFullscreen?.().catch(() => {});
  else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.body.classList.remove('present');
});

// ---------- Play the day ----------
// Runs each step in order: caption with the story, run the AI action, caption
// with the talk track, then on to the next. Space pauses, → skips, Esc stops.
async function play() {
  if (state.play) return;
  const app = currentApp();
  const run = (state.play = { paused: false, stopped: false, skip: false, index: 0, outcomes: [], app });
  state.editing = false;
  document.addEventListener('keydown', playKeys);
  const wait = async (ms) => {
    let left = ms;
    while (left > 0) {
      if (run.stopped) throw new Error('stopped');
      if (run.skip) {
        run.skip = false;
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
      if (!run.paused) left -= 100;
      renderPlayBar();
    }
  };
  try {
    for (let i = 0; i < app.workflows.length; i++) {
      const w = app.workflows[i];
      run.index = i;
      selectWorkflow(w.id);
      if (w.screen.hidden) state.showHidden = true;
      delete state.results[key()];
      render();
      $('.work')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      run.caption = { kicker: `${w.time} · ${w.policy}`, title: w.title, text: w.story };
      renderPlayBar();
      await wait(pacePick(2500, 4500, 7000));
      run.caption = { ...run.caption, text: 'Running the AI action…' };
      renderPlayBar();
      const results = await runAction();
      if (run.stopped) throw new Error('stopped');
      run.outcomes.push({ w, on: results?.on?.trace, off: results?.off?.trace });
      const talk = state.compare ? `With LayerOne: ${w.talk.on} Without it: ${w.talk.off}` : state.protected ? w.talk.on : w.talk.off;
      run.caption = { ...run.caption, text: talk };
      renderPlayBar();
      await wait(pacePick(4000, 8000, 12000));
    }
    run.done = true;
  } catch (e) {
    if (e.message !== 'stopped') console.error(e);
  } finally {
    document.removeEventListener('keydown', playKeys);
    const finished = run.done;
    state.play = null;
    renderPlayBar();
    render();
    if (finished) showSummary(run);
  }
}

function playKeys(e) {
  const run = state.play;
  if (!run || e.target.closest?.('input, textarea, select')) return;
  if (e.key === ' ') {
    e.preventDefault();
    run.paused = !run.paused;
    renderPlayBar();
  } else if (e.key === 'ArrowRight') run.skip = true;
  else if (e.key === 'Escape') run.stopped = true;
}

function renderPlayBar() {
  let bar = $('#playBar');
  const run = state.play;
  if (!run) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'playBar';
    bar.className = 'play-bar';
    document.body.append(bar);
  }
  const c = run.caption || {};
  bar.style.setProperty('--app', run.app.brand?.color || '#0f766e');
  bar.innerHTML = `
    <div class="play-dots">${run.app.workflows.map((_, i) => `<span class="${i < run.index ? 'done' : i === run.index ? 'now' : ''}"></span>`).join('')}</div>
    <div class="play-caption"><small>${esc(c.kicker || '')}</small><b>${esc(c.title || '')}</b><p>${esc(c.text || '')}</p></div>
    <div class="play-controls">
      <button id="playPause" title="Pause or resume (Space)">${run.paused ? '▶ Resume' : '⏸ Pause'}</button>
      <button id="playNext" title="Skip ahead (→)">⏭ Next</button>
      <button id="playStop" title="Stop (Esc)">■ Stop</button>
    </div>`;
  $('#playPause', bar).onclick = () => {
    run.paused = !run.paused;
    renderPlayBar();
  };
  $('#playNext', bar).onclick = () => (run.skip = true);
  $('#playStop', bar).onclick = () => (run.stopped = true);
}

// End-of-day recap: what LayerOne did at each step, with and without it.
function outcomeLabel(t) {
  if (!t) return '—';
  if (t.bypass) return unprotectedIssues(t)[0] ? `⚠️ ${unprotectedIssues(t)[0]}` : '⚠️ Unchecked';
  const g = t.governance || {};
  const pol = g.policies || [];
  if (g.decision === 'blocked') return `🛡️ Blocked: ${pol.find((p) => p.result === 'block')?.name || ''}`;
  if (g.decision === 'held') return '🛡️ Held for review by the judge';
  if (g.decision === 'redacted') return `🛡️ ${pol.find((p) => p.result === 'redact')?.detail || 'Sensitive data removed'}`;
  return '🛡️ Checked and allowed';
}

function showSummary(run) {
  const { app, outcomes } = run;
  const stopped = outcomes.filter((o) => o.on && !o.on.bypass && o.on.governance?.decision !== 'allowed').length;
  const hasOn = outcomes.some((o) => o.on);
  const hasOff = outcomes.some((o) => o.off);
  const dlg = document.createElement('dialog');
  dlg.className = 'settings summary';
  dlg.innerHTML = `
    <div class="s-head"><h2>End of ${esc(firstName(app.person.name))}'s day</h2><button class="icon-btn" data-close aria-label="Close">✕</button></div>
    <div class="s-body">
      ${hasOn ? `<p class="summary-lead">LayerOne stepped in <b>${stopped} of ${outcomes.length}</b> times today, and kept an audit record of every request.</p>` : '<p class="summary-lead">LayerOne was off all day: nothing was checked or recorded.</p>'}
      <table class="summary-table">
        <thead><tr><th>Step</th>${hasOn ? '<th>With LayerOne</th>' : ''}${hasOff ? '<th>Without LayerOne</th>' : ''}</tr></thead>
        <tbody>${outcomes
          .map(
            (o) => `<tr><td><b>${esc(o.w.time)} · ${esc(o.w.title)}</b><small>${esc(o.w.policy)}</small></td>${hasOn ? `<td>${esc(outcomeLabel(o.on))}</td>` : ''}${hasOff ? `<td class="bad">${esc(outcomeLabel(o.off))}</td>` : ''}</tr>`,
          )
          .join('')}</tbody>
      </table>
      ${hasOn && !hasOff ? '<p class="muted">Tip: turn on ⇆ Compare before playing to show the unprotected side next to each result.</p>' : ''}
    </div>
    <div class="s-foot"><span class="spacer"></span><button class="save" data-close>Done</button></div>`;
  document.body.append(dlg);
  dlg.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => dlg.close()));
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
}

// ---------- start ----------
export async function initSample() {
  restore();
  try {
    const [data, config] = await Promise.all([fetch('/api/apps').then((r) => r.json()), fetch('/api/config').then((r) => r.json())]);
    state.apps = data.apps;
    state.customer = data.customer;
    state.config = config;
  } catch {
    $('#sampleRoot').innerHTML = '<p class="mode-note bad">The sample apps cannot reach their backend. See "Deploy to Cloudflare" in the README.</p>';
    return;
  }
  if (!currentApp()) state.appId = state.apps[0].id;
  if (!currentWorkflow()) state.workflowId = (currentApp().workflows[0]?.id ?? null);
  updateTitle();
  render();
  // Settings may change the approved model name or pace; keep in sync.
  window.addEventListener('l1:config', (e) => {
    state.config = e.detail;
    if (!state.play) render();
  });
}
