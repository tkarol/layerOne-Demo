// "Grounded answers": a policy assistant answers from the agency's documents and
// cites them (retrieval-augmented generation). LayerOne's grounding check (its
// LLM judge, given the retrieved sources) holds answers the sources don't
// support: wrong numbers, invented sections, benefits that don't exist.
import { esc, mark, runStep, outcome, showTrace, cmpCols } from './fmt-common.js';

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

// The claim-by-claim comparison comes from the Dry-run judge; a live judge returns its verdict and rationale only.
const isDryRun = (t) => /\/mock\//.test(t?.endpoint?.url || '') || /\/mock\//.test(t?.governance?.judge?.url || '');

function draw() {
  if (!ctx?.el?.isConnected) return;
  const cmp = ctx.isCompare?.();
  const m = cmp ? 'on' : mode();
  const wf = qs().find((w) => w.id === s.selected) || qs()[0];
  const r = s.results[m][wf.id];
  const rOff = s.results.off[wf.id];
  const t = r?.trace;
  const done = t && t.status !== 'running';
  const checked = done && !t.bypass && isDryRun(t);
  // Which library sections to light up: retrieved for this question, and how each cited claim fared.
  const retrieved = new Set(r ? wf.sources : []);
  const claimBy = {};
  if (checked) for (const c of wf.claims || []) claimBy[c.cite] = c.status;

  ctx.el.innerHTML = `
    <div class="fmt-flow ${m === 'on' || cmp ? '' : 'off'}">
      <span class="hop">❓ Question</span><span class="arr">→</span><span class="hop">📚 Search the agency’s documents</span><span class="arr">→</span>
      <span class="hop">✨ AI answers with citations</span><span class="arr">→</span><span class="hop l1">${cmp ? '⇆ With and without LayerOne' : m === 'on' ? '🛡️ LayerOne checks it against the sources' : '⚠️ LayerOne off'}</span><span class="arr">→</span><span class="hop">👤 Employee</span>
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
          <span class="muted small">${cmp ? 'Compare: asked with and without LayerOne' : `LayerOne is <b>${m === 'on' ? 'on' : 'off'}</b>`}</span>
        </div>
        ${cmp ? (r || rOff ? drawCompare(wf, r, rOff) : '<p class="muted">Ask, and the answer appears twice: with LayerOne and without it.</p>') : r ? drawResult(wf, r) : '<p class="muted">The assistant searches the documents on the left, then answers with a citation for every claim.</p>'}
      </section>
    </div>`;
  wire();
}

function cites(text, wf, checked) {
  const status = {};
  if (checked) for (const c of wf.claims || []) status[c.cite] = c.status;
  return mark(text).replace(CITE_RE, (_, ref) => `<span class="cite ${status[ref] ? `c-${status[ref]}` : ''}">${esc(ref)}</span>`);
}

function drawResult(wf, r) {
  return story(wf, r, !r.trace?.bypass);
}

// Compare: the same four steps, with and without LayerOne, side by side.
function drawCompare(wf, rOn, rOff) {
  return cmpCols(rOn ? story(wf, rOn, true) : '<p class="muted">…</p>', rOff ? story(wf, rOff, false) : '<p class="muted">…</p>');
}

// One answer, told as four steps: search → AI's answer → the check → what the employee sees.
function story(wf, r, on) {
  if (r.error) return `<p class="ac-issues">${esc(r.error)}</p>`;
  const t = r.trace;
  if (!t || t.status === 'running') return '<p class="muted"><span class="spinner small"></span> Searching the documents and drafting an answer…</p>';
  const dry = isDryRun(t);
  const stopped = on && t.governance?.decision === 'held';
  const wrong = (wf.claims || []).filter((c) => c.status !== 'supported');
  const step = (n, cls, title, body) => `<li class="gs ${cls}"><span class="gs-n">${n}</span><div><b>${title}</b>${body}</div></li>`;
  const claimLine = (c) =>
    c.status === 'supported'
      ? `<li class="ok">✓ “${esc(c.text)}”: matches ${esc(c.cite)}</li>`
      : c.status === 'contradicted'
        ? `<li class="bad">✗ “${esc(c.text)}”: ${esc(c.cite)} actually says “${esc(c.source)}”</li>`
        : `<li class="bad">✗ “${esc(c.text)}”: ${esc(c.source)}</li>`;

  const s1 = step(1, '', 'Searched the policy documents', `<p>Found ${wf.sources.length} relevant section${wf.sources.length > 1 ? 's' : ''}: ${wf.sources.map((x) => `<span class="cite">${esc(x)}</span>`).join('')}</p>`);
  const draftText = stopped ? (dry ? wf.draft : null) : t.output;
  const s2 = step(
    2,
    stopped ? 'stopped' : '',
    stopped ? 'The AI wrote a draft answer' : 'The AI wrote an answer',
    draftText ? `<div class="gs-draft ${stopped ? 'struck' : ''}">${cites(draftText, wf, dry)}</div>${stopped ? '<small>Not shown to the employee</small>' : ''}` : '<p class="muted">LayerOne stopped the draft before the employee saw it.</p>',
  );
  let s3;
  if (on) {
    const verdict = stopped
      ? `<p class="gs-verdict bad">${wrong.length ? 'The draft doesn’t match the documents' : 'The draft isn’t supported by the documents'}, so LayerOne stopped it.</p>`
      : '<p class="gs-verdict ok">Every statement matches the section it cites.</p>';
    const lines = dry && wf.claims?.length ? `<ul class="gs-claims">${wf.claims.map(claimLine).join('')}</ul>` : stopped ? `<p class="muted small">${esc(outcome(t, wf).text)}</p>` : '';
    s3 = step(3, stopped ? 'caught' : 'ok', '🛡️ LayerOne checked it against those sections', `${lines}${verdict}`);
  } else {
    s3 = step(3, 'bad', '⚠️ Nobody checked it', '<p>LayerOne was off, so the answer went straight to the employee.</p>');
  }
  let s4;
  if (stopped) s4 = step(4, 'ok', 'What the employee sees', safeReply(wf));
  else if (on) s4 = step(4, 'ok', 'What the employee sees', '<p class="muted">The answer above, as written.</p>');
  else {
    const issues = dry && wrong.length ? `<ul class="gs-claims">${wrong.map(claimLine).join('')}</ul>` : '';
    s4 = step(4, wrong.length ? 'bad' : 'ok', 'What the employee sees', `<p>${wrong.length ? 'The answer above, and it’s wrong:' : 'The answer above, as written.'}</p>${issues}${wrong.length ? '<p class="gr-looks">It looks just as authoritative as a correct answer: same tone, real-looking citations.</p>' : ''}`);
  }
  return `<ol class="gstory">${s1}${s2}${s3}${s4}</ol>${t.id ? `<a href="#" class="muted small" data-trace="${esc(t.id)}">See what LayerOne did →</a>` : ''}`;
}

// When LayerOne holds an answer, the employee still gets a reply: only what the
// retrieved sources say, or a plain "the documents don't cover this". Nothing invented.
function safeReply(wf) {
  const text = wf.right || 'I couldn’t confirm an answer to that in the policy documents. Please check with your HR office.';
  return `<div class="cbubble b-ai gr-answer gr-safe"><span class="gr-safe-h">An answer using only what the documents say</span>${cites(text, wf, false)}</div>`;
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
  const id = s.selected;
  const modes = ctx.isCompare?.() ? ['on', 'off'] : [mode()];
  s.running = true;
  draw();
  await Promise.all(
    modes.map(async (m) => {
      const r = (s.results[m][id] = { trace: { status: 'running' } });
      try {
        await runStep(ctx.app.id, id, m === 'on', (tr) => ((r.trace = tr), draw()));
      } catch (err) {
        r.error = err.message;
      }
      draw();
    }),
  );
  s.running = false;
  draw();
}
