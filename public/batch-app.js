// "Batch document queue": an AI reviews a whole FOIA release at once. Each record
// is its own AI request through LayerOne, run a few at a time; the board fills
// in as they finish. Run it again with LayerOne off to compare the two batches.
import { esc, mark, runStep, outcome, showTrace, cmpCols } from './fmt-common.js';

const PARALLEL = 2;
const s = { runs: { on: null, off: null }, running: false, selected: null, showHidden: false };
let ctx; // { el, app, isProtected }

export function mountBatchApp(options) {
  if (ctx?.app?.id !== options.app.id) Object.assign(s, { runs: { on: null, off: null }, running: false, selected: null });
  ctx = options;
  draw();
}

const docs = () => ctx.app.workflows;
const mode = () => (ctx.isProtected() ? 'on' : 'off');
const KIND_ICON = (k) => (/email/i.test(k) ? '✉️' : /spreadsheet|export/i.test(k) ? '📊' : /invoice|contract/i.test(k) ? '🧾' : /medical|form/i.test(k) ? '🩺' : '📄');

// Totals for one run: what LayerOne did (on) or what got through (off).
function tally(run) {
  const t = { allowed: 0, clean: 0, stop: 0, held: 0, bad: 0, done: 0 };
  if (!run) return t;
  for (const d of docs()) {
    const r = run.results[d.id];
    if (!r?.trace || r.trace.status === 'running') continue;
    t.done++;
    const v = outcome(r.trace, d).cls;
    if (v === 'ok') t.allowed++;
    else if (v === 'clean') t.clean++;
    else if (v === 'stop') t.stop++;
    else if (v === 'held') t.held++;
    else if (v === 'bad') t.bad++;
  }
  return t;
}

function draw() {
  if (!ctx?.el?.isConnected) return;
  const cmp = ctx.isCompare?.();
  const m = cmp ? 'on' : mode();
  const run = s.runs[m];
  const t = tally(run);
  const n = docs().length;
  const req = ctx.app.request || {};
  const on = tally(s.runs.on);
  const off = tally(s.runs.off);
  const both = s.runs.on?.finished && s.runs.off?.finished;
  ctx.el.innerHTML = `
    <div class="fmt-flow ${m === 'on' || cmp ? '' : 'off'}">
      <span class="hop">🗂️ ${n} records</span><span class="arr">→</span>
      <span class="hop l1">${cmp ? '⇆ With and without LayerOne' : m === 'on' ? '🛡️ LayerOne checks each one' : '⚠️ LayerOne off'}</span><span class="arr">→</span>
      <span class="hop">✨ AI model, ${PARALLEL} at a time</span><span class="arr">→</span><span class="hop">📋 Release recommendations</span>
    </div>
    <div class="batch-head">
      <div class="batch-req"><small>FOIA request</small><b>${esc(req.number || '')}</b><span>${esc(req.subject || '')} · ${n} responsive records</span></div>
      <button class="batch-go" id="batchGo" ${s.running ? 'disabled' : ''}>${s.running ? '<span class="spinner small"></span> Reviewing…' : run ? `↻ Review all ${n} again` : `▶ Review all ${n} with AI`}</button>
    </div>
    <div class="batch-progress"><i style="width:${run ? (t.done / n) * 100 : 0}%"></i></div>
    ${cmp ? `<div class="batch-tally"><span class="cmp-tag on">🛡️ With LayerOne</span><span class="bt ok"><b>${on.allowed}</b> passed</span><span class="bt clean"><b>${on.clean}</b> cleaned</span><span class="bt stop"><b>${on.stop}</b> blocked</span><span class="bt held"><b>${on.held}</b> held</span></div>
      <div class="batch-tally"><span class="cmp-tag off">⚠️ Without LayerOne</span><span class="bt bad"><b>${off.bad}</b> problems got through</span><span class="bt ok"><b>${off.done - off.bad}</b> fine</span></div>` : `<div class="batch-tally">
      ${
        m === 'on'
          ? `<span class="bt ok"><b>${t.allowed}</b> passed</span><span class="bt clean"><b>${t.clean}</b> cleaned</span><span class="bt stop"><b>${t.stop}</b> blocked</span><span class="bt held"><b>${t.held}</b> held</span>`
          : `<span class="bt bad"><b>${t.bad}</b> problems got through</span><span class="bt ok"><b>${t.done - t.bad}</b> fine</span>`
      }
      <span class="muted small">${run ? `${t.done} of ${n} reviewed` : `LayerOne is ${m === 'on' ? 'on' : 'off'}`}</span>
    </div>`}
    ${
      both
        ? `<div class="batch-compare"><div class="bc on"><b>With LayerOne</b><span>${on.stop} blocked · ${on.clean} cleaned · ${on.held} held · <b>0 problems got through</b></span></div><div class="bc off"><b>Without LayerOne</b><span><b>${off.bad} problems got through</b>: personal data sent out, CUI spilled, instructions obeyed, wrong advice used</span></div></div>`
        : !cmp && (s.runs.on?.finished || s.runs.off?.finished)
          ? `<p class="batch-hint">Now switch LayerOne <b>${m === 'on' ? 'off' : 'on'}</b> and run the same batch to compare.</p>`
          : ''
    }
    <div class="batch-grid">${docs().map((d) => drawTile(d, run, cmp)).join('')}</div>
    ${s.selected ? drawDetail(docs().find((d) => d.id === s.selected), run, cmp) : '<p class="muted batch-pick">Click any record to see what the AI was sent and what came back.</p>'}`;
  wire();
}

// Chip color follows the outcome, not the side.
const tone = (cls) => (cls === 'bad' ? 'bad' : ['stop', 'held', 'clean'].includes(cls) ? 'caught' : cls === 'ok' ? 'good' : '');
const LABEL = { ok: '✓ Passed', clean: '🛡️ Cleaned', stop: '⛔ Blocked', held: '✋ Held', bad: '⚠️ Problem', wait: '…', queued: 'Queued', idle: '' };
const tileVerdict = (d, r) => (r ? (r.error ? { cls: 'bad', badge: 'Error' } : r.trace ? outcome(r.trace, d) : { cls: 'queued', badge: 'Queued' }) : { cls: 'idle', badge: '' });

function drawTile(d, run, cmp) {
  const v = tileVerdict(d, run?.results[d.id]);
  const label = LABEL[v.cls] ?? v.badge;
  // Compare: the tile's color follows what LayerOne did; underneath, both outcomes in a few words.
  const vOff = cmp ? tileVerdict(d, s.runs.off?.results[d.id]) : null;
  const st = cmp
    ? `<span class="chip2"><span class="${tone(v.cls)}">🛡️ ${v.cls === 'wait' ? '…' : esc(label || '·')}</span><span class="${tone(vOff.cls)}">⚠️ ${vOff.cls === 'wait' ? '…' : esc(LABEL[vOff.cls] ?? vOff.badge) || '·'}</span></span>`
    : `<span class="bt-st">${v.cls === 'wait' ? '<span class="spinner small"></span>' : esc(label)}</span>`;
  return `<button class="btile t-${v.cls} ${s.selected === d.id ? 'sel' : ''}" data-doc="${esc(d.id)}">
    <span class="bt-ic">${KIND_ICON(d.screen.meta)}</span>
    <span class="bt-name">${esc(d.screen.title)}</span>
    <span class="bt-kind">${esc(d.screen.meta)}</span>
    ${st}
  </button>`;
}

function drawDetail(d, run, cmp) {
  const sc = d.screen;
  return `<div class="batch-detail">
    <div class="bd-doc">
      <div class="bd-title"><span>${KIND_ICON(sc.meta)}</span><b>${esc(sc.title)}</b><small>${esc(sc.meta)}${sc.long ? ` · about ${Math.round(sc.size / 4).toLocaleString('en-US')} tokens` : ''}</small></div>
      <pre>${mark(sc.excerpt)}${sc.long ? '\n\n[… 300 pages …]' : ''}${sc.hidden ? `<span class="hidden-text ${s.showHidden ? 'shown' : ''}">${esc(sc.hidden)}</span>` : ''}</pre>
      ${sc.hidden ? `<button class="reveal" id="bdReveal">${s.showHidden ? '🙈 Hide' : '👁 Reveal'} hidden text</button>` : ''}
    </div>
    <div class="bd-result">
      ${cmp ? cmpCols(resultHtml(d, run?.results[d.id]), resultHtml(d, s.runs.off?.results[d.id])) : resultHtml(d, run?.results[d.id])}
    </div>
  </div>`;
}

// What happened to one record in one run.
function resultHtml(d, r) {
  const tr = r?.trace;
  const v = r?.error ? { cls: 'bad', badge: 'Error', text: r.error } : tr ? outcome(tr, d) : null;
  return `${
        !v
          ? '<p class="muted">Not reviewed yet in this mode.</p>'
          : `<div class="bd-verdict v-${v.cls}"><span class="ac-badge">${v.badge}</span><span>${esc(v.text)}</span></div>
             ${v.list?.length ? `<ul class="ac-issues">${v.list.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
             ${v.received ? `<p class="ac-recv"><span>The AI received</span>${mark(v.received.replace(/^TASK:[^\n]*\n\n/, '').slice(0, 400))}</p>` : ''}
             ${tr && tr.status !== 'running' && !['stop', 'held'].includes(v.cls) ? `<p class="ac-recv"><span>AI recommendation</span>${mark(tr.output || '')}</p>` : ''}
             ${v.cls === 'held' ? '<p class="ac-none">Held for a person to review; not added to the release package.</p>' : ''}
             ${v.cls === 'stop' ? '<p class="ac-none">Not sent to the AI. Flagged for a person to review.</p>' : ''}
             ${tr?.id ? `<a href="#" class="muted small" data-trace="${esc(tr.id)}">See what LayerOne did →</a>` : ''}`
      }`;
}

function wire() {
  const el = ctx.el;
  el.querySelector('#batchGo')?.addEventListener('click', runBatch);
  el.querySelectorAll('[data-doc]').forEach(
    (b) =>
      (b.onclick = () => {
        s.selected = s.selected === b.dataset.doc ? null : b.dataset.doc;
        s.showHidden = false;
        draw();
      }),
  );
  el.querySelector('#bdReveal')?.addEventListener('click', () => {
    s.showHidden = !s.showHidden;
    draw();
  });
  el.querySelectorAll('[data-trace]').forEach((a) => (a.onclick = (e) => (e.preventDefault(), showTrace(a.dataset.trace))));
}

async function runBatch() {
  if (s.running) return;
  s.running = true;
  draw();
  let redraw = 0;
  const later = () => {
    if (!redraw) redraw = requestAnimationFrame(() => ((redraw = 0), draw()));
  };
  // Compare runs both batches at once; each has its own queue.
  const modes = ctx.isCompare?.() ? ['on', 'off'] : [mode()];
  await Promise.all(
    modes.map(async (m) => {
      const run = { results: {}, finished: false };
      s.runs[m] = run;
      const queue = [...docs()];
      for (const d of queue) run.results[d.id] = {};
      const worker = async () => {
        for (let d = queue.shift(); d; d = queue.shift()) {
          const r = run.results[d.id];
          r.trace = { status: 'running' };
          later();
          try {
            await runStep(ctx.app.id, d.id, m === 'on', (tr) => ((r.trace = tr), later()));
          } catch (err) {
            r.error = err.message;
          }
          later();
          await new Promise((ok) => setTimeout(ok, ctx.paceMs() / 2)); // a beat between records, so the board fills in visibly
        }
      };
      await Promise.all(Array.from({ length: PARALLEL }, worker));
      run.finished = true;
    }),
  );
  s.running = false;
  draw();
}
