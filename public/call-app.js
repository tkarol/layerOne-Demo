// "Live call assist": a contact-center call plays out line by line. After some
// lines, CallAssist (the AI) suggests what the agent should say, and every one
// of those requests goes through LayerOne. The call keeps going while it checks.
import { esc, mark, sleep, runStep, outcome, showTrace, cmpCols } from './fmt-common.js';

const s = { shown: [], cards: [], playing: false, done: false, run: 0, started: 0 };
let ctx; // { el, app, isProtected, paceMs }

export function mountCallApp(options) {
  if (ctx?.app?.id !== options.app.id) reset();
  ctx = options;
  draw();
}

function reset() {
  s.run++;
  Object.assign(s, { shown: [], cards: [], playing: false, done: false, started: 0 });
}

const wfOf = (id) => ctx.app.workflows.find((w) => w.id === id);
const clock = () => {
  if (!s.started) return '0:00';
  const sec = Math.floor((Date.now() - s.started) / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

function draw() {
  if (!ctx?.el?.isConnected) return;
  const prot = ctx.isProtected();
  const caller = ctx.app.caller || { name: 'Caller', role: '' };
  const speaking = s.playing && s.shown.at(-1)?.typing;
  // A compared card counts on both sides.
  const onTrace = (c) => (c.both ? c.on.trace : c.prot ? c.trace : null);
  const offTrace = (c) => (c.both ? c.off.trace : c.prot ? null : c.trace);
  const stopped = s.cards.filter((c) => ['blocked', 'held', 'redacted'].includes(onTrace(c)?.governance?.decision)).length;
  const through = s.cards.filter((c) => offTrace(c) && offTrace(c).status !== 'running' && outcome(offTrace(c), wfOf(c.wf)).cls === 'bad').length;
  const cmp = ctx.isCompare?.();
  ctx.el.innerHTML = `
    <div class="fmt-flow ${prot || cmp ? '' : 'off'}">
      <span class="hop">🎙️ The call</span><span class="arr">→</span><span class="hop">📝 Live transcript</span><span class="arr">→</span>
      <span class="hop l1">${cmp ? '⇆ With and without LayerOne' : prot ? '🛡️ LayerOne' : '⚠️ LayerOne off'}</span><span class="arr">→</span><span class="hop">✨ AI model</span><span class="arr">→</span><span class="hop">💡 Suggestion to the agent</span>
    </div>
    <div class="call-app">
      <section class="call-phone">
        <div class="call-head">
          <span class="call-avatar">${esc(initials(caller.name))}</span>
          <span class="call-who"><b>${esc(caller.name)}</b><small>${esc(caller.role)}</small></span>
          <span class="call-state ${s.playing ? 'live' : ''}">${s.playing ? `<i></i>Live · ${clock()}` : s.done ? 'Call ended' : 'Ready'}</span>
        </div>
        <div class="call-wave ${speaking ? 'on' : ''}" aria-hidden="true">${'<i></i>'.repeat(28)}</div>
        <ol class="call-lines" id="callLines">
          ${s.shown.length ? s.shown.map(drawLine).join('') : `<li class="call-empty">Press <b>Start the call</b>. The conversation plays out here, and CallAssist's suggestions appear on the right.</li>`}
        </ol>
        <div class="call-controls">
          ${s.playing ? '<button class="secondary" id="callPause">⏸ Pause</button>' : `<button class="call-start" id="callStart">${s.shown.length && !s.done ? '▶ Resume' : s.done ? '↻ Replay the call' : '▶ Start the call'}</button>`}
          ${s.shown.length && !s.playing ? '<button class="link-btn" id="callReset">Start over</button>' : ''}
          <span class="muted small">${cmp ? 'Compare: every suggestion runs with and without LayerOne' : `LayerOne is <b>${prot ? 'on' : 'off'}</b>${s.shown.length && !s.done ? ' · switch it before you start to compare' : ''}`}</span>
        </div>
      </section>

      <aside class="call-assist">
        <div class="assist-head"><b>💡 CallAssist</b><small>suggestions for ${esc(ctx.app.person.name.split(' ')[0])}</small></div>
        <div class="assist-cards" id="assistCards">
          ${s.cards.length ? s.cards.map(drawCard).join('') : '<p class="muted">Suggestions appear here as the caller talks.</p>'}
        </div>
        <div class="fmt-score">
          <div class="score good"><b>${stopped}</b><span>caught by LayerOne</span></div>
          <div class="score bad"><b>${through}</b><span>got through with LayerOne off</span></div>
        </div>
      </aside>
    </div>`;
  wire();
  const lines = ctx.el.querySelector('#callLines');
  if (lines) lines.scrollTop = lines.scrollHeight;
  const cards = ctx.el.querySelector('#assistCards');
  if (cards) cards.scrollTop = cards.scrollHeight;
}

const initials = (n) => String(n).split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

function drawLine(l) {
  const text = l.typing ? esc(l.text.split(' ').slice(0, l.words).join(' ')) + '<span class="caret">▍</span>' : mark(l.text);
  return `<li class="cl ${l.who}"><span class="cl-who">${l.who === 'caller' ? 'Caller' : 'Agent'}</span><p>${text}</p>${l.ai && !l.typing ? '<span class="cl-ai">↳ sent to CallAssist</span>' : ''}</li>`;
}

function drawCard(c) {
  if (c.both) return drawBoth(c);
  const wf = wfOf(c.wf);
  const v = c.error ? { cls: 'bad', badge: 'Error', text: c.error } : outcome(c.trace, wf);
  const t = c.trace;
  const done = t && t.status !== 'running';
  let body = '';
  if (done && !c.error) {
    if (v.cls === 'stop') body = '<p class="ac-none">No suggestion. The request never reached the AI.</p>';
    else if (v.cls === 'held') body = '<p class="ac-none">Held, so the agent never reads this aloud.</p>';
    else body = `<p class="ac-text">${mark(t.output || '')}</p>`;
  }
  return `<div class="assist-card v-${v.cls}">
    <div class="ac-top"><span class="ac-badge">${v.badge}</span><b>${esc(wf.title)}</b></div>
    <p class="ac-why">${esc(v.text)}</p>
    ${v.list?.length ? `<ul class="ac-issues">${v.list.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
    ${v.received ? `<p class="ac-recv"><span>The AI received</span>${mark(v.received.replace(/^TASK:[^\n]*\n\n/, ''))}</p>` : ''}
    ${body}
    ${done && t.id ? `<a href="#" class="muted small" data-trace="${esc(t.id)}">See what LayerOne did →</a>` : ''}
  </div>`;
}

// Compare: one suggestion, with and without LayerOne, as two short rows.
function drawBoth(c) {
  const wf = wfOf(c.wf);
  const side = (slot) => {
    const t = slot.trace;
    const v = slot.error ? { cls: 'bad', badge: 'Error', text: slot.error } : outcome(t, wf);
    if (!t || t.status === 'running') return `<p class="ac-why">${v.badge} Checking…</p>`;
    const text = v.cls === 'stop' ? 'No suggestion: never reached the AI.' : v.cls === 'held' ? 'Held: the agent never reads it aloud.' : '';
    return `<p class="ac-why"><span class="ac-badge">${v.badge}</span> ${text ? esc(text) : ''}</p>${text ? '' : `<p class="ac-text">${mark(t.output || '')}</p>`}`;
  };
  return `<div class="assist-card both"><div class="ac-top"><b>${esc(wf.title)}</b></div>${cmpCols(side(c.on), side(c.off), true)}</div>`;
}

function wire() {
  const el = ctx.el;
  el.querySelector('#callStart')?.addEventListener('click', () => {
    if (s.done) reset();
    play();
  });
  el.querySelector('#callPause')?.addEventListener('click', () => {
    s.playing = false;
    draw();
  });
  el.querySelector('#callReset')?.addEventListener('click', () => {
    reset();
    draw();
  });
  el.querySelectorAll('[data-trace]').forEach((a) => (a.onclick = (e) => (e.preventDefault(), showTrace(a.dataset.trace))));
}

async function play() {
  const run = s.run;
  s.playing = true;
  if (!s.started) s.started = Date.now();
  const tick = setInterval(() => (s.playing && run === s.run ? ctx.el.querySelector('.call-state') && (ctx.el.querySelector('.call-state').innerHTML = `<i></i>Live · ${clock()}`) : clearInterval(tick)), 1000);
  const script = ctx.app.script || [];
  const wordMs = Math.max(70, ctx.paceMs() / 6); // close to speaking pace
  while (s.playing && run === s.run && s.shown.length < script.length) {
    const line = { ...script[s.shown.length], words: 0, typing: true };
    s.shown.push(line);
    const words = line.text.split(' ').length;
    while (line.words < words) {
      if (!s.playing || run !== s.run) return;
      line.words++;
      draw();
      await sleep(wordMs);
    }
    line.typing = false;
    draw();
    if (line.ai) suggest(line.ai, run);
    await sleep(line.who === 'caller' ? ctx.paceMs() * 1.6 : ctx.paceMs());
  }
  if (run !== s.run) return;
  if (s.shown.length >= script.length) {
    s.playing = false;
    s.done = true;
    clearInterval(tick);
    draw();
  }
}

// The AI request runs alongside the call, the way real agent assist does.
async function suggest(wfId, run) {
  const go = async (slot, prot) => {
    try {
      await runStep(ctx.app.id, wfId, prot, (tr) => {
        slot.trace = tr;
        if (run === s.run) draw();
      });
    } catch (err) {
      slot.error = err.message;
    }
    if (run === s.run) draw();
  };
  if (ctx.isCompare?.()) {
    const card = { wf: wfId, both: true, on: { trace: { status: 'running' } }, off: { trace: { status: 'running' } } };
    s.cards.push(card);
    draw();
    await Promise.all([go(card.on, true), go(card.off, false)]);
    return;
  }
  const card = { wf: wfId, prot: ctx.isProtected(), trace: { status: 'running' } };
  s.cards.push(card);
  draw();
  await go(card, card.prot);
}
