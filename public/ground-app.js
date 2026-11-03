// "Grounded answers": a policy assistant answers from the agency's documents and
// cites them (retrieval-augmented generation). LayerOne's grounding check (its
// LLM judge, given the retrieved sources) holds answers the sources don't
// support: wrong numbers, invented sections, benefits that don't exist.
import { esc, mark, runStep, outcome, showTrace } from './fmt-common.js';

const s = { selected: null, results: { on: {}, off: {} }, running: false };
let ctx; // { el, app, isProtected }

export function mountGroundApp(options) {
  if (ctx?.app?.id !== options.app.id) Object.assign(s, { selected: null, results: { on: {}, off: {} }, running: false });
  ctx = options;
  s.selected ||= ctx.app.workflows[0]?.id;
  draw();
}

const qs = () => ctx.app.workflows;
const mode = () => (ctx.isProtected() ? 'on' : 'off');
const CITE_RE = /\[((?:HR|FIN)-\d+ §[\d.]+(?:, §[\d.]+)*)\]/g;
const STATUS = { supported: ['✓', 'Supported by the source'], contradicted: ['✗', 'The source says otherwise'], missing: ['✗', 'No such source'] };

// The claim-by-claim comparison comes from the Dry-run judge; a live judge returns its verdict and rationale only.
const isDryRun = (t) => /\/mock\//.test(t?.endpoint?.url || '') || /\/mock\//.test(t?.governance?.judge?.url || '');

function draw() {
  if (!ctx?.el?.isConnected) return;
  const m = mode();
  const wf = qs().find((w) => w.id === s.selected) || qs()[0];
  const r = s.results[m][wf.id];
  const t = r?.trace;
  const done = t && t.status !== 'running';
  const checked = done && !t.bypass && isDryRun(t);
  // Which library sections to light up: retrieved for this question, and how each cited claim fared.
  const retrieved = new Set(r ? wf.sources : []);
  const claimBy = {};
  if (checked) for (const c of wf.claims || []) claimBy[c.cite] = c.status;

  ctx.el.innerHTML = `
    <div class="fmt-flow ${m === 'on' ? '' : 'off'}">
      <span class="hop">❓ Question</span><span class="arr">→</span><span class="hop">📚 Search the agency’s documents</span><span class="arr">→</span>
      <span class="hop">✨ AI answers with citations</span><span class="arr">→</span><span class="hop l1">${m === 'on' ? '🛡️ LayerOne checks it against the sources' : '⚠️ LayerOne off'}</span><span class="arr">→</span><span class="hop">👤 Employee</span>
    </div>
    <div class="gr-app">
      <aside class="gr-lib">
        <div class="side-title">Agency documents</div>
        ${(ctx.app.library || [])
          .map(
            (d) => `<div class="gr-doc"><b>${esc(d.id)}</b> <span>${esc(d.title)}</span>
              ${d.sections
                .map((sec) => {
                  const ref = `${d.id} §${sec.id}`;
                  const st = claimBy[ref];
                  return `<div class="gr-sec ${retrieved.has(ref) ? 'retrieved' : ''} ${st ? `c-${st}` : ''}"><span class="gr-sid">§${esc(sec.id)}</span><span>${esc(sec.text)}</span></div>`;
                })
                .join('')}</div>`,
          )
          .join('')}
        <p class="muted small">Highlighted: the sections the search found for this question.</p>
      </aside>

      <section class="gr-main">
        <div class="gr-qs">${qs()
          .map((w) => `<button class="gr-q ${w.id === wf.id ? 'on' : ''}" data-q="${esc(w.id)}" ${s.running ? 'disabled' : ''}>${esc(w.title)}</button>`)
          .join('')}</div>
        <div class="gr-ask">
          <div class="cbubble b-you">${esc(wf.screen.message)}</div>
          <button class="ai-btn" id="grAsk" ${s.running ? 'disabled' : ''}>${s.running ? '<span class="spinner small"></span> Answering…' : r ? '↻ Ask again' : '📚 Ask Policy Answers'}</button>
          <span class="muted small">LayerOne is <b>${m === 'on' ? 'on' : 'off'}</b></span>
        </div>
        ${r ? drawResult(wf, r, checked) : '<p class="muted">The assistant searches the documents on the left, then answers with a citation for every claim.</p>'}
      </section>
    </div>`;
  wire();
}

function cites(text, wf, checked) {
  const status = {};
  if (checked) for (const c of wf.claims || []) status[c.cite] = c.status;
  return mark(text).replace(CITE_RE, (_, ref) => `<span class="cite ${status[ref] ? `c-${status[ref]}` : ''}">${esc(ref)}</span>`);
}

function drawResult(wf, r, checked) {
  if (r.error) return `<p class="ac-issues">${esc(r.error)}</p>`;
  const t = r.trace;
  if (!t || t.status === 'running') return '<p class="muted"><span class="spinner small"></span> Searching the documents and drafting an answer…</p>';
  const v = outcome(t, wf);
  const found = `<div class="gr-found"><span>Found in the documents:</span>${wf.sources.map((x) => `<span class="cite">${esc(x)}</span>`).join('')}</div>`;
  const head = `<div class="bd-verdict v-${v.cls}"><span class="ac-badge">${v.cls === 'ok' ? '✅ Grounded' : v.badge}</span><span>${esc(v.cls === 'ok' ? 'Every claim is backed by the cited source.' : v.text)}</span></div>${v.list?.length ? `<ul class="ac-issues">${v.list.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}`;
  const draft = t.governance?.decision === 'held' ? null : t.output;
  // With LayerOne on and the answer held, show the AI's draft so the audience sees what was stopped.
  const heldDraft = t.governance?.decision === 'held' ? (wf.claims ? wf.claims : null) : null;
  const claimTable = checked && wf.claims?.length
    ? `<div class="gr-check"><div class="gr-check-h">🛡️ Grounding check: ${wf.claims.filter((c) => c.status === 'supported').length} of ${wf.claims.length} claims supported</div>
        <table><tbody>${wf.claims
          .map((c) => `<tr class="c-${c.status}"><td class="gc-mark">${STATUS[c.status][0]}</td><td><b>${esc(c.text)}</b><small>cites <span class="cite c-${c.status}">${esc(c.cite)}</span></small></td><td>${c.status === 'supported' ? STATUS.supported[1] : `${STATUS[c.status][1]}: <i>${esc(c.source)}</i>`}</td></tr>`)
          .join('')}</tbody></table></div>`
    : '';
  const answerBox = draft != null
    ? `<div class="cbubble b-ai gr-answer ${t.bypass && wf.claims?.some((c) => c.status !== 'supported') ? 'risky' : ''}">${cites(draft, wf, checked)}</div>${t.bypass && wf.right ? '<p class="gr-looks">Looks exactly as authoritative as a correct answer: same tone, real-looking citations.</p>' : ''}`
    : `<div class="gr-held"><b>✋ Held. The employee doesn’t see this answer.</b>${heldDraft ? '<span>The AI’s draft cited sources that don’t say what it claimed (see the check below).</span>' : ''}</div>`;
  const right = wf.right && (t.governance?.decision === 'held' || t.bypass) ? `<div class="gr-right"><span>What the documents actually say</span>${cites(wf.right, wf, false)}</div>` : '';
  return `${found}${head}${answerBox}${claimTable}${right}${t.id ? `<a href="#" class="muted small" data-trace="${esc(t.id)}">See what LayerOne did →</a>` : ''}`;
}

function wire() {
  const el = ctx.el;
  el.querySelectorAll('[data-q]').forEach(
    (b) =>
      (b.onclick = () => {
        s.selected = b.dataset.q;
        draw();
      }),
  );
  el.querySelector('#grAsk')?.addEventListener('click', ask);
  el.querySelectorAll('[data-trace]').forEach((a) => (a.onclick = (e) => (e.preventDefault(), showTrace(a.dataset.trace))));
}

async function ask() {
  if (s.running) return;
  const m = mode();
  const id = s.selected;
  const r = (s.results[m][id] = { trace: { status: 'running' } });
  s.running = true;
  draw();
  try {
    await runStep(ctx.app.id, id, m === 'on', (tr) => ((r.trace = tr), draw()));
  } catch (err) {
    r.error = err.message;
  }
  s.running = false;
  draw();
}
