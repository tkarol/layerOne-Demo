const $ = (sel) => document.querySelector(sel);
const state = { config: null, scenarios: [], traces: new Map(), history: [], selectedId: null, scenario: 'custom', tab: 'overview' };

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtMs = (ms) => (ms == null ? '' : ms < 1 ? '<1 ms' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`);
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const chip = (v) => `<span class="chip ${esc(v)}">${esc(v)}</span>`;

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
const headerTable = (h) =>
  h && Object.keys(h).length
    ? `<table><thead><tr><th>Header</th><th>Value</th></tr></thead><tbody>${Object.entries(h)
        .map(([k, v]) => `<tr><td class="mono">${esc(k)}</td><td class="mono">${esc(v)}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="note">None</p>';

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

function toCurl(req) {
  if (!req) return '';
  const lines = [`curl -X ${req.method} '${req.url}'`];
  for (const [k, v] of Object.entries(req.headers)) {
    const val = /•/.test(v) ? v.replace(/\S*•+\S*/, '$LAYERONE_API_KEY') : v;
    lines.push(`  -H '${k}: ${val}'`);
  }
  lines.push(`  -d '${JSON.stringify(req.body).replace(/'/g, "'\\''")}'`);
  return lines.join(' \\\n');
}

// ---------- theme ----------
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('l1-theme'); } catch {}
  if (saved) document.documentElement.dataset.theme = saved;
  $('#themeToggle').onclick = () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('l1-theme', next); } catch {}
  };
}

// ---------- config & scenarios ----------
function renderConfig() {
  const c = state.config;
  const badge = $('#modeBadge');
  badge.textContent = c.mode === 'mock' ? 'SIMULATED' : 'LIVE';
  badge.className = `badge ${c.mode === 'mock' ? 'mock' : 'live'}`;
  $('#endpointUrl').textContent = c.endpoint.url || '(LAYERONE_BASE_URL not set)';
  $('#mockBanner').hidden = c.mode !== 'mock';
  $('#gwSub').textContent = c.mode === 'mock' ? 'Simulated gateway' : 'Assurance gateway';
  $('#modelSub').textContent = c.mode === 'mock' ? 'Simulated model' : c.model;
  try {
    $('#linkLabel').textContent = new URL(c.endpoint.url).protocol.replace(':', '').toUpperCase();
  } catch {}
}

function renderScenarios() {
  $('#scenarios').innerHTML = state.scenarios
    .map((s) => `<button class="scenario ${state.scenario === s.id ? 'active' : ''}" data-id="${esc(s.id)}"><b>${esc(s.title)}</b><span>${esc(s.tests)}</span></button>`)
    .join('');
  $('#scenarios').querySelectorAll('.scenario').forEach((btn) => {
    btn.onclick = () => {
      const s = state.scenarios.find((x) => x.id === btn.dataset.id);
      state.scenario = s.id;
      $('#prompt').value = s.prompt;
      renderScenarios();
    };
  });
}

// ---------- history ----------
function summarize(t) {
  return { id: t.id, createdAt: t.createdAt, status: t.status, scenario: t.scenario, prompt: t.prompt.slice(0, 140), decision: t.governance?.decision ?? null, httpStatus: t.response?.status ?? null, totalMs: t.totalMs };
}

function renderHistory() {
  const list = $('#history');
  if (!state.history.length) {
    list.innerHTML = '<li class="muted" style="cursor:default">No requests yet.</li>';
    return;
  }
  list.innerHTML = state.history
    .map(
      (h) => `<li data-id="${esc(h.id)}" class="${h.id === state.selectedId ? 'selected' : ''}">
        <div class="h-top"><span>${fmtTime(h.createdAt)} · ${esc(h.scenario)}</span>${chip(h.status === 'running' ? 'running' : h.decision || h.status)}</div>
        <div class="h-prompt">${esc(h.prompt)}</div>
        <div class="h-top"><span>${h.httpStatus ? `HTTP ${h.httpStatus}` : ''}</span><span>${fmtMs(h.totalMs)}</span></div>
      </li>`,
    )
    .join('');
  list.querySelectorAll('li[data-id]').forEach((li) => (li.onclick = () => select(li.dataset.id)));
}

async function select(id) {
  state.selectedId = id;
  if (!state.traces.has(id)) state.traces.set(id, await api(`/api/traces/${id}`));
  renderHistory();
  renderTrace();
}

// ---------- workflow diagram ----------
const STEP_TARGETS = {
  client: ['node:ui', 'link:ui-app.fwd'],
  prepare: ['node:app'],
  outbound: ['link:app-gw.fwd'],
  gateway: ['node:gw', 'link:gw-model.fwd', 'node:model', 'link:gw-model.back'],
  inbound: ['link:app-gw.back'],
  validate: ['node:app'],
  deliver: ['link:ui-app.back', 'node:ui'],
};

function renderFlow(trace) {
  const states = {};
  for (const step of trace?.steps || []) {
    for (const target of STEP_TARGETS[step.key] || []) (states[target] ||= []).push(step.status);
  }
  const blocked = trace?.governance?.decision === 'blocked';
  const resolve = (list = []) => {
    if (list.includes('running')) return 'active';
    if (list.includes('error')) return 'error';
    if (list.includes('blocked')) return 'blocked';
    if (list.some((s) => s === 'done' || s === 'warn')) return 'done';
    if (list.length && list.every((s) => s === 'skipped')) return 'skipped';
    return '';
  };
  document.querySelectorAll('.node').forEach((el) => {
    let s = resolve(states[`node:${el.dataset.node}`]);
    if (blocked && el.dataset.node === 'gw') s = 'blocked';
    if (blocked && el.dataset.node === 'model') s = 'skipped';
    el.className = `node ${el.dataset.node === 'gw' ? 'gateway' : ''} ${s}`;
  });
  document.querySelectorAll('.link').forEach((el) => {
    for (const dir of ['fwd', 'back']) {
      let s = resolve(states[`link:${el.dataset.link}.${dir}`]);
      if (blocked && el.dataset.link === 'gw-model') s = '';
      if (blocked && el.dataset.link === 'app-gw' && dir === 'back' && s === 'done') s = 'blocked';
      el.querySelector(`.${dir}`).className = `${dir} ${s}`;
    }
  });
  const meta = trace ? `${trace.id} · ${fmtTime(trace.createdAt)}${trace.totalMs ? ` · ${fmtMs(trace.totalMs)} total` : ''}` : '';
  $('#traceMeta').textContent = meta;
}

function renderTimeline(trace) {
  if (!trace) {
    $('#timeline').innerHTML = '';
    return;
  }
  $('#timeline').innerHTML = trace.steps
    .map((s, i) => {
      const icon = { done: '✓', blocked: '✕', error: '!', warn: '!', running: '…', skipped: '–' }[s.status] || i + 1;
      return `<li class="${s.status}">
        <span class="dot">${icon}</span>
        <div class="t-label"><b>${esc(s.label)}</b><span class="t-actor">${esc(s.actor)}</span>${s.detail ? `<small>${esc(s.detail)}</small>` : ''}</div>
        <span class="t-ms">${fmtMs(s.durationMs)}</span>
      </li>`;
    })
    .join('');
}

// ---------- inspector tabs ----------
const TABS = {
  overview(t) {
    const g = t.governance || {};
    const decision = t.status === 'running' ? 'running' : g.decision || t.status;
    const blocked = g.decision === 'blocked';
    return `
      <div class="kv">
        <div><small>LayerOne decision</small><span>${chip(decision)}${g.inferred ? ' <span class="muted">(inferred)</span>' : ''}</span></div>
        <div><small>HTTP status</small><span>${t.response ? `${t.response.status} ${esc(t.response.statusText)}` : '—'}</span></div>
        <div><small>Gateway latency</small><span>${fmtMs(t.response?.latencyMs) || '—'}</span></div>
        <div><small>End to end</small><span>${fmtMs(t.totalMs) || '—'}</span></div>
        <div><small>Evidence ID</small><span class="mono">${esc(g.evidenceId || '—')}</span></div>
        <div><small>Policies evaluated</small><span>${g.policies?.length ?? '—'}</span></div>
      </div>
      <div class="section-title">Endpoint</div>
      <div class="endpoint-line mono"><span class="method">${esc(t.endpoint.method)}</span> ${esc(t.endpoint.url)}</div>
      <div class="section-title">Prompt</div>
      <pre class="output">${esc(t.prompt)}</pre>
      ${g.extensions?.layerone?.sanitized_prompt ? `<div class="section-title">Prompt as forwarded to model (after LayerOne)</div><pre class="output">${esc(g.extensions.layerone.sanitized_prompt)}</pre>` : ''}
      <div class="section-title">${blocked ? 'Gateway response' : 'Model response (via LayerOne)'}</div>
      <pre class="output ${blocked || t.status === 'error' ? 'blocked' : ''}">${esc(t.output ?? t.error ?? (t.status === 'running' ? 'Waiting…' : '—'))}</pre>`;
  },
  request(t) {
    if (!t.request) return '<p class="empty">Request not built yet.</p>';
    return `
      <div class="section-title">Endpoint</div>
      <div class="endpoint-line mono"><span class="method">${esc(t.request.method)}</span> ${esc(t.request.url)}</div>
      <div class="section-title">Headers <span class="muted" style="text-transform:none;font-weight:400">secrets masked</span></div>
      ${headerTable(t.request.headers)}
      <div class="section-title">Body</div>
      ${codeBlock(t.request.body)}
      <div class="section-title">Reproduce with cURL <button class="ghost small" id="copyCurl">Copy</button></div>
      <pre class="code">${esc(toCurl(t.request))}</pre>`;
  },
  response(t) {
    if (!t.response) return `<p class="empty">${t.error ? esc(t.error) : 'Waiting for LayerOne…'}</p>`;
    return `
      <div class="kv">
        <div><small>Status</small><span>${t.response.status} ${esc(t.response.statusText)}</span></div>
        <div><small>Latency</small><span>${fmtMs(t.response.latencyMs)}</span></div>
        <div><small>Size</small><span>${t.response.bytes} bytes</span></div>
      </div>
      <div class="section-title">Headers</div>
      ${headerTable(t.response.headers)}
      <div class="section-title">Body</div>
      ${codeBlock(t.response.body)}`;
  },
  governance(t) {
    const g = t.governance;
    if (!g) return '<p class="empty">No governance data yet.</p>';
    const policies = g.policies.length
      ? `<table><thead><tr><th>Policy</th><th>Stage</th><th>Result</th><th>Detail</th></tr></thead><tbody>${g.policies
          .map((p) => `<tr><td><b>${esc(p.name || p.id)}</b><br><span class="muted mono">${esc(p.id || '')}</span></td><td>${esc(p.stage || '')}</td><td>${chip(p.result || p.status || '')}</td><td>${esc(p.detail || p.reason || '')}</td></tr>`)
          .join('')}</tbody></table>`
      : '<p class="note">The gateway did not return a per-policy breakdown in this response.</p>';
    const record = g.record || g.extensions?.layerone?.record;
    return `
      <div class="kv">
        <div><small>Decision</small><span>${chip(g.decision)}</span></div>
        <div><small>Evidence ID</small><span class="mono">${esc(g.evidenceId || '—')}</span></div>
        <div><small>Gateway request ID</small><span class="mono">${esc(g.gatewayRequestId || '—')}</span></div>
      </div>
      ${g.inferred ? '<p class="note">LayerOne did not return an explicit decision; it was inferred from the HTTP status.</p>' : ''}
      <div class="section-title">Policy evaluation</div>
      ${policies}
      ${record ? `<div class="section-title">Evidence record (tamper-evident)</div>${codeBlock(record)}` : ''}
      <div class="section-title">Governance headers</div>
      ${headerTable(g.headers)}
      <div class="section-title">Gateway extension fields</div>
      ${Object.keys(g.extensions || {}).length ? codeBlock(g.extensions) : '<p class="note">None</p>'}`;
  },
  raw(t) {
    return `<div class="section-title">Full trace <a href="/api/traces/${esc(t.id)}/export"><button class="ghost small">Export JSON</button></a></div>${codeBlock(t)}`;
  },
};

function renderTrace() {
  const t = state.traces.get(state.selectedId);
  renderFlow(t);
  renderTimeline(t);
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  if (!t) {
    $('#tabBody').innerHTML = '<p class="empty">Send a request to see the trace.</p>';
    return;
  }
  $('#tabBody').innerHTML = TABS[state.tab](t);
  const copy = $('#copyCurl');
  if (copy) copy.onclick = () => navigator.clipboard?.writeText(toCurl(t.request)).then(() => (copy.textContent = 'Copied'));
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
    state.tab = 'overview';
    renderTrace();
  } catch (err) {
    alert(`Request failed: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

function onTrace(trace) {
  state.traces.set(trace.id, trace);
  const idx = state.history.findIndex((h) => h.id === trace.id);
  if (idx >= 0) state.history[idx] = summarize(trace);
  else state.history.unshift(summarize(trace));
  renderHistory();
  if (trace.id === state.selectedId) renderTrace();
}

function connectStream() {
  const es = new EventSource('/api/stream');
  es.onopen = () => $('#connState').classList.add('on');
  es.onerror = () => $('#connState').classList.remove('on');
  es.addEventListener('trace', (e) => onTrace(JSON.parse(e.data)));
}

async function init() {
  initTheme();
  $('#send').onclick = send;
  $('#prompt').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
  });
  $('#prompt').addEventListener('input', () => {
    const preset = state.scenarios.find((s) => s.id === state.scenario);
    if (preset && preset.prompt !== $('#prompt').value) {
      state.scenario = 'custom';
      renderScenarios();
    }
  });
  $('#clear').onclick = async () => {
    if (!confirm('Clear all recorded traces?')) return;
    await api('/api/traces', { method: 'DELETE' });
    state.traces.clear();
    state.history = [];
    state.selectedId = null;
    renderHistory();
    renderTrace();
  };
  $('#tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('button')?.dataset.tab;
    if (!tab) return;
    state.tab = tab;
    renderTrace();
  });

  connectStream();
  [state.config, state.scenarios, state.history] = await Promise.all([api('/api/config'), api('/api/scenarios'), api('/api/traces')]);
  renderConfig();
  renderScenarios();
  renderHistory();
  if (state.history[0]) select(state.history[0].id);
  else renderTrace();
}

init();
