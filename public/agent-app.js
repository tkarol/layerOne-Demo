// "Tool-using agent": an AI agent works the IT help-desk queue on its own. For each
// ticket it asks the AI model for a plan (through LayerOne), then calls admin
// tools one by one. When LayerOne blocks or holds the plan, no tool is called.
import { esc, mark, sleep, runStep, outcome, showTrace } from './fmt-common.js';

const s = { selected: null, results: { on: {}, off: {} }, busy: false, showHidden: false, run: 0 };
let ctx; // { el, app, isProtected, paceMs }

export function mountAgentApp(options) {
  if (ctx?.app?.id !== options.app.id) Object.assign(s, { selected: null, results: { on: {}, off: {} }, busy: false, showHidden: false });
  ctx = options;
  s.selected ||= ctx.app.workflows[0]?.id;
  draw();
}

const tickets = () => ctx.app.workflows;
const mode = () => (ctx.isProtected() ? 'on' : 'off');
const DANGER = new Set(['add_to_group', 'disable_mfa', 'export_users']);

// Which tools the agent ends up calling, given what LayerOne decided.
function toolsFor(r, wf) {
  const t = r?.trace;
  if (!t || t.status === 'running' || r.error) return [];
  const d = t.governance?.decision;
  if (!t.bypass && (d === 'blocked' || d === 'held' || t.status === 'error')) return [];
  if (t.bypass && /^Done\./.test(t.output || '') && wf.obeyTools) return wf.obeyTools;
  return wf.tools || [];
}

function status(r, wf) {
  if (!r) return { cls: 'idle', text: 'Waiting' };
  if (r.error) return { cls: 'bad', text: 'Error' };
  if (!r.trace || r.trace.status === 'running') return { cls: 'wait', text: 'Planning…' };
  const v = outcome(r.trace, wf).cls;
  if (r.calling) return { cls: 'wait', text: 'Calling tools…' };
  if (v === 'stop') return { cls: 'stop', text: 'Stopped by LayerOne' };
  if (v === 'held') return { cls: 'held', text: 'Waiting for a person' };
  if (v === 'bad') return { cls: 'bad', text: 'Done, unsafely' };
  return { cls: 'ok', text: 'Resolved' };
}

function draw() {
  if (!ctx?.el?.isConnected) return;
  const m = mode();
  const wf = tickets().find((w) => w.id === s.selected) || tickets()[0];
  const r = s.results[m][wf.id];
  const sc = wf.screen;
  ctx.el.innerHTML = `
    <div class="fmt-flow ${m === 'on' ? '' : 'off'}">
      <span class="hop">🎫 Ticket</span><span class="arr">→</span><span class="hop">🤖 Agent</span><span class="arr">→</span>
      <span class="hop l1">${m === 'on' ? '🛡️ LayerOne checks the plan' : '⚠️ LayerOne off'}</span><span class="arr">→</span><span class="hop">✨ AI model</span><span class="arr">→</span><span class="hop">🔧 Admin tools</span>
    </div>
    <div class="agent-app">
      <aside class="agent-queue">
        <div class="side-title">Ticket queue</div>
        <ol>${tickets()
          .map((w) => {
            const st = status(s.results[m][w.id], w);
            return `<li><button class="aq-item ${w.id === wf.id ? 'active' : ''}" data-ticket="${esc(w.id)}" ${s.busy ? 'disabled' : ''}>
              <span class="aq-num">${esc(w.screen.number)}</span><b>${esc(w.title)}</b><span class="aq-st s-${st.cls}">${esc(st.text)}</span></button></li>`;
          })
          .join('')}</ol>
        <button class="secondary small" id="agentAll" ${s.busy ? 'disabled' : ''}>▶ Work the whole queue</button>
        <div class="agent-tools"><span>Tools this agent can call</span>${(ctx.app.tools || []).map((t) => `<code class="${DANGER.has(t) ? 'danger' : ''}">${esc(t)}</code>`).join('')}</div>
      </aside>

      <section class="agent-main">
        <article class="ticket">
          <div class="tk-head"><span class="tk-num">${esc(sc.number)}</span><b>${esc(sc.subject)}</b><small>from ${esc(sc.from)}</small></div>
          <p class="tk-body">${mark(sc.body)}${sc.hidden ? `<span class="hidden-text ${s.showHidden ? 'shown' : ''}">${esc(sc.hidden)}</span>` : ''}</p>
          ${sc.hidden ? `<button class="reveal" id="tkReveal">${s.showHidden ? '🙈 Hide' : '👁 Reveal'} hidden text</button>` : ''}
        </article>
        <div class="agent-go-row">
          <button class="ai-btn" id="agentGo" ${s.busy ? 'disabled' : ''}>🤖 ${r ? 'Run the agent again' : 'Let the agent work this ticket'}</button>
          <span class="muted small">LayerOne is <b>${m === 'on' ? 'on' : 'off'}</b></span>
        </div>
        ${r ? drawRun(r, wf) : '<p class="muted">The agent reads the ticket, asks the AI model for a plan, then calls tools on its own.</p>'}
      </section>
    </div>`;
  wire();
}

function drawRun(r, wf) {
  const v = r.error ? { cls: 'bad', badge: 'Error', text: r.error } : outcome(r.trace, wf);
  const planned = r.trace && r.trace.status !== 'running';
  const tools = toolsFor(r, wf).slice(0, r.calledCount ?? 0);
  const all = toolsFor(r, wf);
  const unsafe = r.trace?.bypass && all.some((t) => t.danger);
  let end = '';
  if (planned && !r.calling) {
    if (v.cls === 'stop') end = '<div class="ag-end stop">⛔ The agent stopped. <b>No tools were called.</b> The ticket is flagged for a person.</div>';
    else if (v.cls === 'held') end = '<div class="ag-end held">✋ The plan is held for a person to approve. <b>No tools were called.</b></div>';
    else if (unsafe) end = '<div class="ag-end bad">⚠️ The agent did all of this on its own, with nobody checking.</div>';
    else if (all.length) end = '<div class="ag-end ok">✅ Ticket resolved.</div>';
  }
  return `<ol class="ag-steps">
    <li class="ag-step done"><span class="ag-ic">📥</span><div><b>Read the ticket</b></div></li>
    <li class="ag-step v-${v.cls}"><span class="ag-ic">🧠</span><div><b>Plan with the AI model</b> <span class="ac-badge">${v.badge}</span>
      <p class="ac-why">${esc(v.text)}</p>
      ${v.list?.length ? `<ul class="ac-issues">${v.list.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
      ${planned && !['stop', 'held'].includes(v.cls) ? `<p class="ag-plan">${mark((r.trace.output || '').replace(/^Done\.\s*/, ''))}</p>` : ''}
      ${planned && r.trace.id ? `<a href="#" class="muted small" data-trace="${esc(r.trace.id)}">See what LayerOne did →</a>` : ''}</div></li>
    ${tools
      .map(
        (t) => `<li class="ag-step tool ${t.danger && r.trace?.bypass ? 'danger' : ''}"><span class="ag-ic">🔧</span><div><code>${esc(t.name)}(${esc(t.args)})</code><p class="ag-res">→ ${esc(t.result)}</p></div></li>`,
      )
      .join('')}
  </ol>${end}`;
}

function wire() {
  const el = ctx.el;
  el.querySelectorAll('[data-ticket]').forEach(
    (b) =>
      (b.onclick = () => {
        s.selected = b.dataset.ticket;
        s.showHidden = false;
        draw();
      }),
  );
  el.querySelector('#tkReveal')?.addEventListener('click', () => {
    s.showHidden = !s.showHidden;
    draw();
  });
  el.querySelector('#agentGo')?.addEventListener('click', () => work([s.selected]));
  el.querySelector('#agentAll')?.addEventListener('click', () => work(tickets().map((w) => w.id)));
  el.querySelectorAll('[data-trace]').forEach((a) => (a.onclick = (e) => (e.preventDefault(), showTrace(a.dataset.trace))));
}

async function work(ids) {
  if (s.busy) return;
  s.busy = true;
  const run = ++s.run;
  const m = mode();
  const prot = m === 'on';
  for (const id of ids) {
    const wf = tickets().find((w) => w.id === id);
    s.selected = id;
    s.showHidden = Boolean(wf.screen.hidden);
    const r = { trace: { status: 'running' }, calledCount: 0 };
    s.results[m][id] = r;
    draw();
    try {
      await runStep(ctx.app.id, id, prot, (tr) => ((r.trace = tr), draw()));
    } catch (err) {
      r.error = err.message;
    }
    // Then the tools, one at a time.
    const tools = toolsFor(r, wf);
    r.calling = tools.length > 0;
    draw();
    for (let i = 0; i < tools.length; i++) {
      await sleep(ctx.paceMs());
      if (run !== s.run) return;
      r.calledCount = i + 1;
      draw();
    }
    r.calling = false;
    draw();
    if (ids.length > 1) await sleep(ctx.paceMs() * 1.5);
  }
  s.busy = false;
  draw();
}
