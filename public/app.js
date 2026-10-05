const $ = (sel) => document.querySelector(sel);
const state = { config: null, scenarios: [], traces: new Map(), history: [], selectedId: null, scenario: null, reveal: null };

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtMs = (ms) => (ms == null ? '' : ms < 1 ? '<1 ms' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const markRedactions = (s) => esc(s).replace(/\[REDACTED-[A-Z]+\]/g, (m) => `<mark>${m}</mark>`);

function highlightJson(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return esc(text).replace(
    /(&quot;(?:\\.|[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gi,
    (m, str, colon, bool) => {
      if (str) return colon ? `<span class="j-key">${str}</span>${colon}` : `<span class="j-str">${str}</span>`;
      if (bool) return `<span class="j-bool">${m}</span>`;
      return `<span class="j-num">${m}</span>`;
    },
  );
}
const codeBlock = (v) => `<pre class="code">${highlightJson(v ?? null)}</pre>`;

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) {
    const err = new Error((await res.json().catch(() => ({}))).error || res.statusText);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function toCurl(req) {
  const lines = [`curl -X ${req.method} '${req.url}'`];
  for (const [k, v] of Object.entries(req.headers)) {
    lines.push(`  -H '${k}: ${/•/.test(v) ? v.replace(/\S*•+\S*/, '$LAYERONE_API_KEY') : v}'`);
  }
  lines.push(`  -d '${JSON.stringify(req.body).replace(/'/g, "'\\''")}'`);
  return lines.join(' \\\n');
}

// The one word that describes the outcome, used everywhere.
function outcome(t) {
  if (!t || t.status === 'running') return 'running';
  if (t.status === 'error' && t.governance?.decision !== 'blocked') return 'error';
  return t.governance?.decision || t.status;
}
const OUTCOME_LABEL = { allowed: 'Clean', redacted: 'Info removed', blocked: 'Blocked', error: 'Error', running: 'Sending…' };

// ---------- theme ----------
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('l1-theme'); } catch {}
  if (saved) document.documentElement.dataset.theme = saved;
  $('#themeToggle').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('l1-theme', next); } catch {}
  };
}

// ---------- step 1: ask ----------
function renderExamples() {
  $('#examples').innerHTML = state.scenarios
    .map((s) => `<button class="example ${state.scenario === s.id ? 'active' : ''}" data-id="${esc(s.id)}" title="${esc(s.tests)}">${esc(s.title)}</button>`)
    .join('');
  $('#examples').querySelectorAll('.example').forEach((btn) => {
    btn.onclick = () => {
      const s = state.scenarios.find((x) => x.id === btn.dataset.id);
      state.scenario = s.id;
      $('#prompt').value = s.prompt;
      renderExamples();
    };
  });
}

// ---------- step 2: request & response lanes + verdict ----------
const REQ_STAGES = new Set(['input', 'request', 'pre', 'inbound']);
const RES_STAGES = new Set(['output', 'response', 'post', 'outbound']);
const RESPONSE_ORDER = ['res-model', 'res-1', 'res-l1', 'res-2', 'res-app'];
const REVEAL_MS = 260;

function splitPolicies(policies = []) {
  return {
    req: policies.filter((p) => REQ_STAGES.has(String(p.stage).toLowerCase())),
    res: policies.filter((p) => RES_STAGES.has(String(p.stage).toLowerCase())),
    other: policies.filter((p) => !REQ_STAGES.has(String(p.stage).toLowerCase()) && !RES_STAGES.has(String(p.stage).toLowerCase())),
  };
}

// Short caption for a LayerOne box, from the rules checked in that direction.
function checkCaption(list, fallback) {
  const block = list.find((p) => p.result === 'block');
  if (block) return ['blocked', 'Blocked'];
  const removed = list.filter((p) => p.result === 'redact');
  if (removed.length) return ['warn', removed.map((p) => p.detail.replace(/ from the AI’s answer$/, '')).join('; ')];
  if (list.length) return ['done', `${list.length} checks passed`];
  return fallback;
}

// Animate the response lane hop by hop once the answer arrives (presentation only).
function revealStep(t) {
  const r = state.reveal;
  if (!r || r.id !== t?.id) return Infinity;
  const n = Math.floor((performance.now() - r.start) / REVEAL_MS);
  if (n >= RESPONSE_ORDER.length) {
    state.reveal = null;
    return Infinity;
  }
  setTimeout(render, REVEAL_MS / 2);
  return n;
}

function renderJourney(t) {
  const o = outcome(t);
  const st = (key) => t?.steps.find((s) => s.key === key)?.status;
  const waiting = t && ['client', 'prepare', 'outbound', 'gateway'].some((k) => st(k) === 'running');
  const { req, res } = splitPolicies(t?.governance?.policies);
  const view = {};
  const idle = ['', 'Waiting'];
  for (const k of ['req-app', 'req-l1', 'req-model', 'res-model', 'res-l1', 'res-app']) view[k] = idle;
  for (const k of ['req-1', 'req-2', 'res-1', 'res-2']) view[k] = '';

  if (t) {
    view['req-app'] = ['done', 'Sent the request'];
    view['req-1'] = 'done';
    if (waiting) {
      view['req-1'] = st('gateway') === 'running' ? 'done' : 'active';
      view['req-l1'] = ['active', 'Checking…'];
      view['req-2'] = 'active';
      view['req-model'] = ['active', 'Working…'];
    } else if (o === 'error' && !t.response) {
      view['req-1'] = 'blocked';
      view['req-l1'] = ['blocked', 'Could not reach LayerOne'];
      view['req-2'] = 'cut';
      view['req-model'] = ['skipped', 'Never reached'];
      view['res-model'] = ['skipped', 'Never called'];
      view['res-1'] = 'cut';
      view['res-l1'] = ['skipped', 'Not reached'];
      view['res-2'] = 'cut';
      view['res-app'] = ['blocked', 'Showed the error'];
    } else if (o === 'blocked') {
      view['req-l1'] = checkCaption(req, ['blocked', 'Blocked']);
      view['req-l1'] = ['blocked', view['req-l1'][1]];
      view['req-2'] = 'cut';
      view['req-model'] = ['skipped', 'Never reached'];
      view['res-model'] = ['skipped', 'Never called'];
      view['res-1'] = 'cut';
      view['res-l1'] = ['blocked', 'Sent a block notice'];
      view['res-2'] = 'blocked';
      view['res-app'] = ['done', 'Showed the block notice'];
    } else if (o === 'error') {
      view['req-l1'] = ['blocked', `Error (HTTP ${t.response.status})`];
      view['res-l1'] = ['blocked', 'Returned an error'];
      view['res-2'] = 'blocked';
      view['res-app'] = ['done', 'Showed the error'];
    } else {
      view['req-l1'] = checkCaption(req, ['done', 'Passed']);
      view['req-2'] = 'done';
      view['req-model'] = ['done', view['req-l1'][0] === 'warn' ? 'Got the cleaned request' : 'Got the request'];
      view['res-model'] = ['done', 'Sent its answer'];
      view['res-1'] = 'done';
      view['res-l1'] = checkCaption(res, ['done', 'Passed']);
      view['res-2'] = 'done';
      view['res-app'] = ['done', view['res-l1'][0] === 'warn' ? 'Showed the cleaned answer' : 'Showed the answer'];
    }

    // Hold back the response lane while it animates in.
    const shown = o === 'running' ? -1 : revealStep(t);
    RESPONSE_ORDER.forEach((k, i) => {
      if (i < shown) return;
      if (i === shown) view[k] = k.startsWith('res-') && k.length === 5 ? 'active' : ['active', '…'];
      else view[k] = k.length === 5 ? '' : idle;
    });
  }

  for (const [key, val] of Object.entries(view)) {
    if (typeof val === 'string') {
      document.querySelector(`[data-path="${key}"]`).className = `path ${val}`;
    } else {
      const el = document.querySelector(`[data-stop="${key}"]`);
      el.className = `stop ${key.endsWith('l1') ? 'layerone' : ''} ${val[0]}`;
      el.querySelector('[data-caption]').textContent = val[1];
    }
  }
  renderVerdict(t, state.reveal?.id === t?.id ? 'running' : o, req, res);
}

function renderVerdict(t, o, req, res) {
  const v = $('#verdict');
  v.className = `verdict ${t ? o : 'idle'}`;
  if (!t) {
    v.textContent = 'Pick an example and press Send to see what happens.';
    return;
  }
  const g = t.governance || {};
  const all = g.policies || [];
  const blocker = all.find((p) => p.result === 'block');
  const inRemoved = req.filter((p) => p.result === 'redact');
  const outRemoved = res.filter((p) => p.result === 'redact');
  let msg;
  if (o === 'running') msg = ['Following the request…', 'The request is going through LayerOne to the AI model and back.'];
  else if (o === 'blocked') msg = ['🛑 Blocked before it reached the AI model', `LayerOne stopped this request, so the AI model never saw it.${blocker ? ` Reason: ${blocker.detail}.` : ''}`];
  else if (o === 'error') msg = ['⚠️ Something went wrong', t.error || 'The request could not be completed.'];
  else if (inRemoved.length && outRemoved.length) msg = ['✂️ Personal information removed both ways', `${inRemoved[0].detail} from the request, and ${outRemoved[0].detail.replace(/^Removed /, '').replace(/ from the AI’s answer$/, '')} from the AI model’s answer.`];
  else if (inRemoved.length) msg = ['✂️ Personal information removed before the AI model saw it', `${inRemoved[0].detail}. The AI model only received the cleaned request.`];
  else if (outRemoved.length) msg = ['✂️ LayerOne caught personal information in the AI’s answer', `The AI model’s answer contained personal information. ${outRemoved[0].detail}, before it reached the web application.`];
  else if (o === 'redacted') msg = ['✂️ Allowed, with sensitive information removed', 'LayerOne removed sensitive details from this exchange.'];
  else msg = ['✅ Clean both ways', all.length ? `LayerOne ran ${all.length} checks on the request and the answer. Everything passed.` : 'LayerOne approved the request and the answer.'];

  const meta = [];
  if (g.evidenceId && o !== 'running') meta.push(`🔒 Audit record saved: <span class="mono">${esc(g.evidenceId)}</span>`);
  if (t.totalMs && o !== 'running') meta.push(`Took ${fmtMs(t.totalMs)}`);
  v.innerHTML = `<h3>${esc(msg[0])}</h3><p>${esc(msg[1])}</p>${meta.length ? `<div class="meta">${meta.join(' · ')}</div>` : ''}`;
}

// ---------- step 2: endpoints ----------
function renderEndpoints(t) {
  const c = state.config;
  if (!c) return;
  const mock = c.mode === 'mock';
  const gatewayUrl = t?.endpoint?.url || c.endpoint.url;
  $('#epGateway').textContent = gatewayUrl || '(LAYERONE_BASE_URL not set)';
  const gNote = $('#epGatewayNote');
  if (t?.response) {
    gNote.textContent = `Called · HTTP ${t.response.status} in ${fmtMs(t.response.latencyMs)}`;
    gNote.className = 'ep-note ok';
  } else if (t && t.status === 'error') {
    gNote.textContent = 'Could not be reached';
    gNote.className = 'ep-note bad';
  } else {
    gNote.textContent = mock ? 'Dry run: built-in stand-in for LayerOne on this computer' : 'Your LayerOne gateway';
    gNote.className = 'ep-note';
  }

  const up = t?.upstream || c.upstream;
  const box = $('#epUpstreamBox');
  const uNote = $('#epUpstreamNote');
  if (!up) {
    $('#epUpstreamMethod').textContent = '';
    $('#epUpstream').textContent = 'LayerOne did not report where it sent the request';
    box.className = 'ep-url unknown';
    uNote.textContent = 'Set LAYERONE_UPSTREAM_URL in .env to show the configured model endpoint.';
    uNote.className = 'ep-note';
    return;
  }
  $('#epUpstreamMethod').textContent = up.method || 'POST';
  $('#epUpstream').textContent = up.url;
  const unreached = Boolean(t && t.status === 'error' && !t.response);
  const blocked = outcome(t) === 'blocked' || up.called === false || unreached;
  box.className = `ep-url ${t && blocked ? 'not-called' : ''}`;
  const parts = [];
  if (up.provider) parts.push(up.provider);
  if (up.model) parts.push(`model "${up.model}"`);
  const src = { reported: mock ? 'reported by the simulated gateway' : 'reported by LayerOne', config: 'from demo settings', simulated: 'simulated' }[up.source] || '';
  if (unreached) {
    uNote.textContent = 'Not called. The request never reached LayerOne.';
    uNote.className = 'ep-note bad';
  } else if (t && blocked) {
    uNote.textContent = 'Not called. LayerOne blocked the request first.';
    uNote.className = 'ep-note bad';
  } else if (t?.response && up.source === 'reported') {
    uNote.textContent = [`Called${up.status ? ` · HTTP ${up.status}` : ''}${up.latencyMs != null ? ` in ${fmtMs(up.latencyMs)}` : ''}`, ...parts, src].join(' · ');
    uNote.className = 'ep-note ok';
  } else {
    uNote.textContent = [...parts, src].filter(Boolean).join(' · ');
    uNote.className = 'ep-note';
  }
}

// ---------- step 3: details by direction ----------
const RESULT = { pass: ['✓', 'Passed'], redact: ['✂', 'Removed'], block: ['✕', 'Blocked'] };
function checkList(list) {
  if (!list.length) return '';
  return `<div class="label">Rules checked</div><ul class="checks">${list
    .map((p) => {
      const r = p.result || p.status || 'pass';
      const [ic, word] = RESULT[r] || ['•', r];
      return `<li class="${esc(r)}"><span class="ic">${ic}</span><span><b>${esc(p.name || p.id)}</b> · ${esc(word)}</span><small>${esc(p.detail || '')}</small></li>`;
    })
    .join('')}</ul>`;
}

function renderResult(t) {
  const card = $('#resultCard');
  if (!t || t.status === 'running' || state.reveal?.id === t.id) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const o = outcome(t);
  const g = t.governance || {};
  const { req, res, other } = splitPolicies(g.policies);
  const sanitized = g.extensions?.layerone?.sanitized_prompt;

  if (o === 'error' && !t.response) {
    const live = state.config?.mode !== 'mock';
    $('#result').innerHTML = `
      <pre class="box stopped">${esc(t.error || 'The request could not be completed.')}</pre>
      <p class="same">The request never reached LayerOne, so nothing was checked.${live ? ' Check the LayerOne URL in Settings, or switch to Dry run to demo without a connection.' : ''}</p>`;
    return;
  }

  const received =
    o === 'blocked'
      ? '<pre class="box stopped">Nothing. LayerOne blocked the request.</pre>'
      : sanitized
        ? `<pre class="box">${markRedactions(sanitized)}</pre>`
        : '<p class="same">The same text. Nothing needed removing.</p>';

  const requestSide = `
    <div class="direction">Request: Web Application → LayerOne → AI Model</div>
    <div class="compare">
      <div><div class="label">Typed in the web application</div><pre class="box">${esc(t.prompt)}</pre></div>
      <div><div class="label">What the AI model received</div>${received}</div>
    </div>
    ${checkList(req)}`;

  const answer =
    o === 'blocked'
      ? `<div class="label">What the web application received</div><pre class="box stopped">${esc(t.output || 'Request blocked.')}</pre>`
      : o === 'error'
        ? `<div class="label">Error</div><pre class="box stopped">${esc(t.error || t.output || 'Unknown error')}</pre>`
        : `<div class="label">What the web application received</div><pre class="box answer">${markRedactions(t.output || '')}</pre>`;

  const responseSide = `
    <div class="direction">Response: AI Model → LayerOne → Web Application</div>
    ${o === 'blocked' ? '<p class="same">The AI model was never called, so there was no answer to check.</p>' : ''}
    ${answer}
    ${checkList(res)}`;

  const otherSide = other.length ? `<div class="direction">Other checks</div>${checkList(other)}` : '';
  $('#result').innerHTML = requestSide + responseSide + otherSide;
}

// ---------- technical details ----------
function renderTech(t) {
  const tech = $('#tech');
  if (!t) {
    tech.hidden = true;
    return;
  }
  tech.hidden = false;
  const icon = { done: '✓', blocked: '✕', error: '✕', warn: '!', running: '…', skipped: '–', pending: '·' };
  const steps = t.steps
    .map((s) => `<li class="${s.status === 'error' || s.status === 'blocked' ? 'bad' : ''}">${icon[s.status] || ''} ${esc(s.label)} <span class="ms">${fmtMs(s.durationMs)}${s.detail ? ` · ${esc(s.detail)}` : ''}</span></li>`)
    .join('');
  const record = t.governance?.record || t.governance?.extensions?.layerone?.record;
  $('#techBody').innerHTML = `
    <div class="label">Web Application → LayerOne</div>
    <div class="endpoint mono"><span class="method">${esc(t.endpoint.method)}</span> ${esc(t.endpoint.url)}</div>
    <div class="label">LayerOne → AI Model</div>
    <div class="endpoint mono">${t.upstream ? `<span class="method">${esc(t.upstream.method || 'POST')}</span> ${esc(t.upstream.url)}${t.upstream.called === false ? ' <span class="muted">(not called)</span>' : ''}` : '<span class="muted">Not reported by LayerOne</span>'}</div>
    <div class="label">Step by step</div>
    <ol class="steps">${steps}</ol>
    ${t.request ? `<div class="label">Request sent to LayerOne <span class="muted">(API key hidden)</span></div>${codeBlock({ headers: t.request.headers, body: t.request.body })}` : ''}
    ${t.response ? `<div class="label">Response from LayerOne · HTTP ${t.response.status} · ${fmtMs(t.response.latencyMs)}</div>${codeBlock({ headers: t.response.headers, body: t.response.body })}` : ''}
    ${record ? `<div class="label">Audit record</div>${codeBlock(record)}` : ''}
    <div class="tech-actions">
      ${t.request ? '<button class="small-btn" id="copyCurl">Copy as cURL</button>' : ''}
      <a class="small-btn" href="/api/traces/${esc(t.id)}/export">Download full trace (JSON)</a>
    </div>`;
  const copy = $('#copyCurl');
  if (copy) copy.onclick = () => navigator.clipboard?.writeText(toCurl(t.request)).then(() => (copy.textContent = 'Copied ✓'));
}

// ---------- history ----------
function summarize(t) {
  return { id: t.id, createdAt: t.createdAt, status: t.status, prompt: t.prompt.slice(0, 140), decision: t.governance?.decision ?? null };
}

function renderHistory() {
  $('#historyCard').hidden = !state.history.length;
  $('#history').innerHTML = state.history
    .map((h) => {
      const o = h.status === 'running' ? 'running' : h.status === 'error' && h.decision !== 'blocked' ? 'error' : h.decision || h.status;
      return `<li data-id="${esc(h.id)}" class="${h.id === state.selectedId ? 'selected' : ''}">
        <span class="pill ${esc(o)}">${esc(OUTCOME_LABEL[o] || o)}</span>
        <span class="txt">${esc(h.prompt)}</span>
        <time>${fmtTime(h.createdAt)}</time>
      </li>`;
    })
    .join('');
  $('#history').querySelectorAll('li').forEach((li) => (li.onclick = () => select(li.dataset.id)));
}

async function select(id) {
  state.selectedId = id;
  if (!state.traces.has(id)) state.traces.set(id, await api(`/api/traces/${id}`));
  renderHistory();
  render();
}

function render() {
  const t = state.traces.get(state.selectedId);
  renderEndpoints(t);
  renderJourney(t);
  renderResult(t);
  renderTech(t);
}

// ---------- mode badge ----------
function renderConfig() {
  const c = state.config;
  const mock = c.mode === 'mock';
  const badge = $('#modeBadge');
  badge.textContent = mock ? 'Dry run' : 'Live: LayerOne';
  badge.className = `badge ${mock ? 'mock' : 'live'}`;
  badge.title = `${c.endpoint.url}\nClick to change in Settings`;
  const note = $('#modeNote');
  note.hidden = false;
  note.className = 'mode-note';
  if (mock) {
    note.innerHTML = 'Dry run: requests go to a built-in stand-in for LayerOne. Nothing leaves this computer. <a data-open-settings>Change in Settings</a>';
  } else if (!c.configured) {
    note.className = 'mode-note bad';
    note.innerHTML = 'Live mode has no LayerOne URL yet. <a data-open-settings>Add it in Settings</a>';
  } else if (!c.authConfigured) {
    note.innerHTML = 'Live mode has no API key set. Requests are sent without one. <a data-open-settings>Add it in Settings</a>';
  } else {
    note.hidden = true;
  }
  note.querySelectorAll('[data-open-settings]').forEach((a) => (a.onclick = openSettings));
  $('#send').textContent = mock ? 'Send through LayerOne (dry run)' : 'Send through LayerOne';
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 4500);
}

// ---------- settings ----------
const form = () => $('#settingsForm');
const SETTINGS_FIELDS = ['baseUrl', 'chatPath', 'model', 'apiKey', 'authHeader', 'authScheme', 'timeoutMs', 'upstreamUrl', 'upstreamProvider'];

function readForm() {
  const f = form();
  const data = { mode: f.mode.value };
  for (const k of SETTINGS_FIELDS) data[k] = f[k].value;
  data.timeoutMs = Number(data.timeoutMs);
  data.clearApiKey = f.clearApiKey.checked;
  if (!data.apiKey) delete data.apiKey; // blank keeps the saved key
  return data;
}

function showErrors(errors = {}) {
  const f = form();
  for (const k of SETTINGS_FIELDS) {
    f[k].classList.toggle('invalid', Boolean(errors[k]));
    const slot = f.querySelector(`[data-err="${k}"]`);
    if (slot) slot.textContent = errors[k] || '';
  }
}

function updatePreview() {
  const f = form();
  const mock = f.mode.value === 'mock';
  $('#liveFields').classList.toggle('dim', mock);
  const base = f.baseUrl.value.trim().replace(/\/+$/, '');
  const path = f.chatPath.value.trim() || '/v1/chat/completions';
  $('#epPreview').textContent = mock
    ? 'The built-in dry-run gateway on this computer (nothing leaves this machine)'
    : base
      ? `POST ${base}${path}`
      : 'Enter the LayerOne base URL above';
}

function fillForm(st) {
  const f = form();
  f.mode.value = st.mode;
  for (const k of SETTINGS_FIELDS) f[k].value = k === 'apiKey' ? '' : (st[k] ?? '');
  f.apiKey.placeholder = st.apiKeySet ? `Saved (ends in ${st.apiKeyHint.slice(1)}). Leave blank to keep it.` : 'Paste your LayerOne API key';
  f.clearApiKey.checked = false;
  $('#clearKeyRow').hidden = !st.apiKeySet;
  $('#settingsLocked').hidden = !st.locked;
  $('#settingsLocked').textContent = st.lockedReason || 'Settings are locked on this server (ALLOW_UI_SETTINGS=false).';
  for (const el of f.querySelectorAll('input, #settingsSave, #settingsTest, #settingsReset')) el.disabled = st.locked;
  $('#testResult').hidden = true;
  showErrors();
  updatePreview();
}

const RESTART_MSG = 'The demo server is running an older version than this page, so Settings is not available yet. Stop the server (Ctrl+C) and run npm start again, then reload this page.';

async function openSettings() {
  try {
    fillForm(await api('/api/settings'));
  } catch (err) {
    // Still open the panel, read-only, and say why, rather than failing silently.
    const c = state.config || {};
    fillForm({ mode: c.mode || 'mock', chatPath: '', model: c.model || '', authHeader: c.authHeader || '', locked: true, lockedReason: err.status === 404 ? RESTART_MSG : `Could not load settings from the server: ${err.message}` });
  }
  $('#settings').showModal();
}

async function testSettings() {
  const out = $('#testResult');
  const btn = $('#settingsTest');
  showErrors();
  out.hidden = false;
  out.className = 'test-result pending';
  out.textContent = 'Sending a test request…';
  out.scrollIntoView({ block: 'nearest' });
  btn.disabled = true;
  try {
    const r = await api('/api/settings/test', { method: 'POST', body: JSON.stringify(readForm()) });
    if (r.errors) {
      showErrors(r.errors);
      out.className = 'test-result bad';
      out.textContent = 'Fix the highlighted fields first.';
      form().querySelector('.invalid')?.scrollIntoView({ block: 'center' });
      return;
    }
    const hint = { 401: 'Check the API key.', 403: 'Check the API key and permissions.', 404: 'Check the base URL and chat path.' }[r.status] || '';
    out.className = `test-result ${r.ok ? 'ok' : 'bad'}`;
    requestAnimationFrame(() => out.scrollIntoView({ block: 'nearest' }));
    out.innerHTML = r.error
      ? `✕ ${esc(r.error)}`
      : `${r.ok ? '✓ Connected' : '✕ Reached the server, but it returned an error'} · HTTP ${r.status} ${esc(r.statusText)} in ${fmtMs(r.latencyMs)} ${hint ? `· ${esc(hint)}` : ''}
         <small>${esc(r.url)}${r.upstream?.url ? ` → ${esc(r.upstream.url)}` : ''}${r.reply ? ` · Reply: "${esc(r.reply)}"` : ''}</small>`;
  } catch (err) {
    out.className = 'test-result bad';
    out.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

async function saveSettings(e) {
  e.preventDefault();
  const btn = $('#settingsSave');
  btn.disabled = true;
  showErrors();
  try {
    const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(readForm()) });
    const data = await res.json();
    if (!res.ok) {
      showErrors(data.errors);
      const out = $('#testResult');
      out.hidden = false;
      out.className = 'test-result bad';
      out.textContent = data.errors ? 'Fix the highlighted fields.' : data.error;
      (form().querySelector('.invalid') || out).scrollIntoView({ block: 'center' });
      return;
    }
    $('#settings').close();
    state.config = await api('/api/config');
    renderConfig();
    render();
    toast(data.notice || `Saved. ${data.settings.mode === 'mock' ? 'Dry run is on.' : `Live: requests now go to ${data.settings.endpoint}`}`);
  } finally {
    btn.disabled = false;
  }
}

function initSettings() {
  $('#openSettings').onclick = openSettings;
  $('#modeBadge').onclick = openSettings;
  $('#settingsClose').onclick = () => $('#settings').close();
  $('#settingsTest').onclick = testSettings;
  form().addEventListener('submit', saveSettings);
  form().addEventListener('input', updatePreview);
  $('#settingsReset').onclick = async () => {
    if (!confirm('Discard settings saved from this screen and go back to the .env values?')) return;
    const { settings } = await api('/api/settings', { method: 'DELETE' });
    fillForm(settings);
    state.config = await api('/api/config');
    renderConfig();
    render();
    toast('Settings reset to the .env values.');
  };
}

// ---------- actions ----------
async function send() {
  const prompt = $('#prompt').value.trim();
  if (!prompt) return $('#prompt').focus();
  const btn = $('#send');
  btn.disabled = true;
  try {
    const preset = state.scenarios.find((s) => s.id === state.scenario);
    const scenario = preset && preset.prompt === prompt ? preset.id : 'custom';
    const { id } = await api('/api/run', { method: 'POST', body: JSON.stringify({ prompt, scenario }) });
    state.selectedId = id;
    render();
  } catch (err) {
    alert(`Request failed: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

function onTrace(trace) {
  const prev = state.traces.get(trace.id);
  if (prev?.status === 'running' && trace.status !== 'running' && trace.response) state.reveal = { id: trace.id, start: performance.now() };
  state.traces.set(trace.id, trace);
  const idx = state.history.findIndex((h) => h.id === trace.id);
  if (idx >= 0) state.history[idx] = summarize(trace);
  else state.history.unshift(summarize(trace));
  renderHistory();
  if (trace.id === state.selectedId) render();
}

async function init() {
  initTheme();
  $('#send').onclick = send;
  $('#prompt').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
  });
  $('#prompt').addEventListener('input', () => {
    if (state.scenario) {
      state.scenario = null;
      renderExamples();
    }
  });
  $('#clear').onclick = async () => {
    if (!confirm('Clear all recent requests?')) return;
    await api('/api/traces', { method: 'DELETE' });
    state.traces.clear();
    state.history = [];
    state.selectedId = null;
    renderHistory();
    render();
  };

  const stream = new EventSource('/api/stream');
  stream.addEventListener('trace', (e) => onTrace(JSON.parse(e.data)));
  stream.addEventListener('config', (e) => {
    state.config = JSON.parse(e.data);
    renderConfig();
    render();
  });
  initSettings();
  [state.config, state.scenarios, state.history] = await Promise.all([api('/api/config'), api('/api/scenarios'), api('/api/traces')]);

  renderConfig();
  // Catch a server that was not restarted after an update (new page, old API).
  api('/api/settings').catch((err) => {
    if (err.status !== 404) return;
    const note = $('#modeNote');
    note.hidden = false;
    note.className = 'mode-note bad';
    note.textContent = RESTART_MSG;
  });

  renderExamples();
  renderHistory();
  if (state.history[0]) select(state.history[0].id);
  else render();
}

init();
