const $ = (sel) => document.querySelector(sel);
const state = { config: null, scenarios: [], traces: new Map(), history: [], selectedId: null, scenario: null };

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
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
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
const OUTCOME_LABEL = { allowed: 'Allowed', redacted: 'Cleaned up', blocked: 'Blocked', error: 'Error', running: 'Sending…' };

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

// ---------- step 2: journey + verdict ----------
function renderJourney(t) {
  const o = outcome(t);
  const st = (key) => t?.steps.find((s) => s.key === key)?.status;
  const running = (...keys) => keys.some((k) => st(k) === 'running');

  const stops = { agent: ['', 'Waiting'], layerone: ['', 'Waiting'], model: ['', 'Waiting'] };
  const paths = { in: '', model: '' };
  if (t) {
    stops.agent = running('client', 'prepare', 'outbound') ? ['active', 'Sending…'] : ['done', 'Sent request'];
    if (running('gateway', 'outbound')) {
      paths.in = 'active';
      stops.layerone = ['active', 'Checking…'];
    } else if (st('gateway') === 'error') {
      paths.in = 'blocked';
      stops.layerone = ['blocked', 'Unreachable'];
    } else if (st('gateway')) {
      paths.in = 'done';
      stops.layerone = { allowed: ['done', 'Approved'], redacted: ['warn', 'Cleaned up'], blocked: ['blocked', 'Blocked'] }[o] || ['active', 'Checking…'];
      if (o === 'error') stops.layerone = ['blocked', 'Error'];
    }
    if (o === 'allowed' || o === 'redacted') {
      paths.model = 'done';
      stops.model = ['done', 'Answered'];
    } else if (o === 'blocked') {
      paths.model = 'cut';
      stops.model = ['skipped', 'Never reached'];
    }
    if (o !== 'running') stops.agent = ['done', o === 'blocked' ? 'Told it was blocked' : o === 'error' ? 'Got an error' : 'Got the answer'];
  }
  for (const [key, [cls, caption]] of Object.entries(stops)) {
    const el = document.querySelector(`[data-stop="${key}"]`);
    el.className = `stop ${key === 'layerone' ? 'layerone' : ''} ${cls}`;
    el.querySelector('[data-caption]').textContent = caption;
  }
  for (const [key, cls] of Object.entries(paths)) document.querySelector(`[data-path="${key}"]`).className = `path ${cls}`;

  const v = $('#verdict');
  v.className = `verdict ${t ? o : 'idle'}`;
  if (!t) {
    v.textContent = 'Send a request to see what happens.';
    return;
  }
  const g = t.governance || {};
  const policies = g.policies || [];
  const blocker = policies.find((p) => p.result === 'block');
  const cleaned = policies.filter((p) => p.result === 'redact');
  const msg = {
    running: ['Checking with LayerOne…', 'The request is on its way to LayerOne.'],
    allowed: ['✅ Allowed', policies.length ? `LayerOne checked ${policies.length} rules. All passed, so the AI answered.` : 'LayerOne approved the request, so the AI answered.'],
    redacted: ['✂️ Allowed, with sensitive info removed', `LayerOne took out sensitive details before the AI saw the request.${cleaned[0]?.detail ? ` ${cleaned[0].detail}.` : ''}`],
    blocked: ['🛑 Blocked', `LayerOne stopped this request, so the AI never saw it.${blocker ? ` Reason: ${blocker.name}. ${blocker.detail}.` : ''}`],
    error: ['⚠️ Something went wrong', t.error || 'The request could not be completed.'],
  }[o];
  const meta = [];
  if (g.evidenceId) meta.push(`🔒 Audit record saved: <span class="mono">${esc(g.evidenceId)}</span>`);
  if (t.totalMs) meta.push(`Took ${fmtMs(t.totalMs)}`);
  v.innerHTML = `<h3>${esc(msg[0])}</h3><p>${esc(msg[1])}</p>${meta.length ? `<div class="meta">${meta.join(' · ')}</div>` : ''}`;
}

// ---------- step 3: details ----------
function renderResult(t) {
  const card = $('#resultCard');
  if (!t || t.status === 'running') {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const o = outcome(t);
  const g = t.governance || {};
  const sanitized = g.extensions?.layerone?.sanitized_prompt;
  const RESULT = { pass: ['✓', 'Passed'], redact: ['✂', 'Cleaned up'], block: ['✕', 'Blocked'] };

  const sent = sanitized
    ? `<div class="compare">
         <div><div class="label">You sent</div><pre class="box">${esc(t.prompt)}</pre></div>
         <div><div class="label">The AI received</div><pre class="box">${markRedactions(sanitized)}</pre></div>
       </div>`
    : `<div class="label">You sent</div><pre class="box">${esc(t.prompt)}</pre>`;

  const answer =
    o === 'blocked'
      ? `<div class="label">LayerOne's response</div><pre class="box stopped">${esc(t.output || 'Request blocked.')}</pre>`
      : o === 'error'
        ? `<div class="label">Error</div><pre class="box stopped">${esc(t.error || t.output || 'Unknown error')}</pre>`
        : `<div class="label">The AI's answer</div><pre class="box answer">${markRedactions(t.output || '')}</pre>`;

  const checks = g.policies?.length
    ? `<div class="label">Rules LayerOne checked</div><ul class="checks">${g.policies
        .map((p) => {
          const r = p.result || p.status || 'pass';
          const [ic, word] = RESULT[r] || ['•', r];
          return `<li class="${esc(r)}"><span class="ic">${ic}</span><span><b>${esc(p.name || p.id)}</b> · ${esc(word)}</span><small>${esc(p.detail || '')}</small></li>`;
        })
        .join('')}</ul>`
    : '';

  $('#result').innerHTML = sent + answer + checks;
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
    <div class="label">Endpoint called</div>
    <div class="endpoint mono"><span class="method">${esc(t.endpoint.method)}</span> ${esc(t.endpoint.url)}</div>
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
  renderJourney(t);
  renderResult(t);
  renderTech(t);
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

  new EventSource('/api/stream').addEventListener('trace', (e) => onTrace(JSON.parse(e.data)));
  [state.config, state.scenarios, state.history] = await Promise.all([api('/api/config'), api('/api/scenarios'), api('/api/traces')]);

  const mock = state.config.mode === 'mock';
  $('#modeBadge').textContent = mock ? 'Practice mode' : 'Connected to LayerOne';
  $('#modeBadge').className = `badge ${mock ? 'mock' : 'live'}`;
  $('#modeBadge').title = state.config.endpoint.url;
  $('#mockNote').hidden = !mock;

  renderExamples();
  renderHistory();
  if (state.history[0]) select(state.history[0].id);
  else render();
}

init();
