// "Ask AI": a company AI chat. Under every message, one line says what
// LayerOne did and what the AI model actually received.
import { readTraceStream, LEAK_RE, REDACTED_RE } from './stream.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const mark = (text) =>
  esc(text)
    .replace(new RegExp(LEAK_RE.source, 'gi'), (m) => `<mark class="leak" title="Sensitive data">${m}</mark>`)
    .replace(REDACTED_RE, (m) => `<mark title="Removed by LayerOne">${m}</mark>`)
    .replace(/Brightline-Admin-\d+/g, (m) => `<mark class="leak" title="A password">${m}</mark>`);

const s = { turns: [], draft: '' };
let ctx; // { el, app, isProtected }

export function mountChatApp(options) {
  ctx = options;
  draw();
}

const examples = () => ctx.app.workflows.filter((w) => w.id !== 'free');

function draw() {
  if (!ctx?.el?.isConnected) return;
  const prot = ctx.isProtected();
  const busy = s.turns.some((t) => t.running);
  const stopped = s.turns.filter((t) => !t.running && t.protected && ['redacted', 'blocked', 'held'].includes(t.trace?.governance?.decision)).length;
  const exposed = s.turns.filter((t) => !t.running && !t.protected && t.trace && issues(t).length).length;
  ctx.el.innerHTML = `
    <div class="chat-app">
      <div class="chat-flow ${prot ? '' : 'off'}">
        <span class="hop">💬 You type</span><span class="arr">→</span>
        <span class="hop l1">${prot ? '🛡️ LayerOne checks it' : '⚠️ LayerOne off'}</span><span class="arr">→</span>
        <span class="hop">✨ Outside AI model</span>
        <small>${prot ? 'LayerOne checks what goes out to the AI, and what comes back.' : 'Everything goes straight to the AI model, as typed.'}</small>
      </div>

      <div class="chat-grid">
        <section class="chat-main">
          <div class="chat-log" id="chatLog">
            ${s.turns.length ? s.turns.map(drawTurn).join('') : `<div class="chat-empty"><b>Pick an example on the right</b>, or type your own message below.</div>`}
          </div>
          <form class="chat-input" id="chatForm">
            <input id="chatText" placeholder="Message Ask AI…" autocomplete="off" value="${esc(s.draft)}" ${busy ? 'disabled' : ''} />
            <button class="chat-send" ${busy ? 'disabled' : ''}>Send</button>
          </form>
        </section>

        <aside class="chat-side">
          <div class="side-title">Try one</div>
          <ol class="chat-examples">
            ${examples()
              .map((w, i) => `<li><button class="chat-example" data-wf="${esc(w.id)}" ${busy ? 'disabled' : ''}><span class="num">${i + 1}</span><span><b>${esc(w.title)}</b><small>${esc(w.policy)}</small></span></button></li>`)
              .join('')}
          </ol>
          <div class="chat-score">
            <div class="score good"><b>${stopped}</b><span>stopped by LayerOne</span></div>
            <div class="score bad"><b>${exposed}</b><span>got through with LayerOne off</span></div>
          </div>
          ${s.turns.length ? `<button class="link-btn" id="chatClear" ${busy ? 'disabled' : ''}>Clear chat</button>` : ''}
        </aside>
      </div>
    </div>`;
  wire();
  const log = ctx.el.querySelector('#chatLog');
  log.scrollTop = log.scrollHeight;
}

// One message: what you typed, what LayerOne did, what the AI received, the answer.
function drawTurn(t) {
  const v = verdict(t);
  return `<div class="cx">
    <div class="cx-you"><div class="cbubble b-you">${mark(t.message)}</div></div>
    <div class="cx-check v-${v.cls}">
      <div class="cx-verdict"><span class="cx-badge">${v.badge}</span><span>${esc(v.text)}</span></div>
      ${v.received != null ? `<div class="cx-received"><span>The AI model received</span><div>${v.received}</div></div>` : ''}
      ${v.list?.length ? `<ul class="cx-issues">${v.list.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
    </div>
    ${v.answer != null ? `<div class="cx-ai"><div class="cbubble b-ai ${v.answerCls || ''}">${v.answer}</div></div>` : ''}
    ${
      t.running
        ? ''
        : `<div class="cx-foot">
      ${t.wfId !== 'free' || t.message ? `<button class="link-btn" data-retry="${esc(t.id)}">↻ Try this with LayerOne ${t.protected ? 'OFF' : 'ON'}</button>` : ''}
      ${t.trace?.id ? `<a href="#" class="muted" data-trace="${esc(t.trace.id)}">See the details →</a>` : ''}</div>`
    }
  </div>`;
}

function verdict(t) {
  if (t.error) return { cls: 'bad', badge: 'Error', text: t.error };
  const tr = t.trace;
  if (t.running || !tr || tr.status === 'running') {
    return { cls: 'wait', badge: '<span class="spinner small"></span>', text: t.protected ? 'LayerOne is checking…' : 'Sending straight to the AI model…' };
  }
  const g = tr.governance || {};
  const pol = g.policies || [];
  const answer = mark(tr.output || '');
  if (tr.bypass) {
    const list = issues(t);
    return {
      cls: 'bad',
      badge: '⚠️ No LayerOne',
      text: list.length ? 'Sent as typed. Nothing was checked:' : 'Sent as typed. Nothing was checked or recorded.',
      list,
      received: mark(t.message),
      answer,
      answerCls: list.length ? 'risky' : '',
    };
  }
  if (tr.status === 'error' && g.decision !== 'blocked') return { cls: 'bad', badge: 'Error', text: tr.error || 'Something went wrong.' };
  if (g.decision === 'blocked') {
    const b = pol.find((p) => p.result === 'block');
    return {
      cls: 'stop',
      badge: '⛔ Blocked',
      text: `${b ? `${b.name}: ${b.detail}.` : 'Stopped by policy.'}`,
      received: '<i>Nothing. The message never left the company.</i>',
      answer: '<i>No answer. LayerOne stopped the request.</i>',
      answerCls: 'muted-bubble',
    };
  }
  if (g.decision === 'held') {
    const h = pol.find((p) => p.result === 'hold');
    const why = (h?.detail || '').replace(/^Judge score \d+\/10:\s*/, '');
    return {
      cls: 'warn',
      badge: '✋ Answer held',
      text: `The AI answered, but LayerOne's judge stopped the answer from reaching you. ${why}`,
      answer: '<i>Held for review. A supervisor can release it.</i>',
      answerCls: 'muted-bubble',
    };
  }
  const removed = pol.filter((p) => p.result === 'redact');
  if (removed.length) {
    return {
      cls: 'warn',
      badge: '🛡️ Cleaned',
      text: removed.map((p) => (p.stage === 'output' ? `${p.detail}.` : `${p.detail} before it reached the AI.`)).join(' '),
      received: receivedText(t),
      answer,
    };
  }
  return { cls: 'ok', badge: '✅ Allowed', text: 'Nothing risky found. Sent to the AI as typed.', received: mark(t.message), answer };
}

// What LayerOne forwarded, when it reports it.
function receivedText(t) {
  const sent = t.trace?.governance?.extensions?.layerone?.sanitized_prompt;
  if (sent) return mark(sent);
  const cleanedInput = (t.trace?.governance?.policies || []).some((p) => p.stage === 'input' && p.result === 'redact');
  return mark(t.message) + (cleanedInput ? ' <small class="muted">(LayerOne did not report its cleaned copy)</small>' : '');
}

// What went wrong when LayerOne was off, in plain words.
function issues(t) {
  const out = t.trace?.output || '';
  const list = [];
  const sent = (t.message.match(new RegExp(LEAK_RE.source, 'gi')) || []).length;
  if (sent) list.push(`${sent} piece${sent > 1 ? 's' : ''} of personal data went to the outside AI model`);
  if (/ignore|disregard/i.test(t.message) && /password|Sure!/i.test(out)) list.push('The AI was tricked into revealing its instructions and a password');
  if (t.wfId === 'bad-advice') list.push('Nobody checked the answer: it breaks the refund policy');
  if (new RegExp(LEAK_RE.source, 'i').test(out)) list.push('The AI copied personal data into its answer');
  return list;
}

function wire() {
  const el = ctx.el;
  el.querySelectorAll('.chat-example').forEach((b) => (b.onclick = () => send(b.dataset.wf)));
  const input = el.querySelector('#chatText');
  input.oninput = () => (s.draft = input.value);
  el.querySelector('#chatForm').onsubmit = (e) => {
    e.preventDefault();
    if (s.draft.trim()) send('free', s.draft.trim());
  };
  el.querySelector('#chatClear')?.addEventListener('click', () => {
    s.turns = [];
    draw();
  });
  el.querySelectorAll('[data-retry]').forEach(
    (b) =>
      (b.onclick = () => {
        const t = s.turns.find((x) => x.id === b.dataset.retry);
        if (t) send(t.wfId, t.wfId === 'free' ? t.message : undefined, !t.protected);
      }),
  );
  el.querySelectorAll('[data-trace]').forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('l1:show-trace', { detail: { id: a.dataset.trace } }));
      }),
  );
}

async function send(wfId, text, prot = ctx.isProtected()) {
  if (s.turns.some((t) => t.running)) return;
  const wf = ctx.app.workflows.find((w) => w.id === wfId);
  const message = wfId === 'free' ? text : wf.screen.message;
  const turn = { id: `c${Date.now()}`, wfId, message, protected: prot, running: true, trace: null };
  s.turns.push(turn);
  if (wfId === 'free') s.draft = '';
  draw();
  try {
    const res = await fetch('/api/app/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: ctx.app.id, workflow: wfId, protected: prot, message: wfId === 'free' ? message : undefined }),
    });
    await readTraceStream(res, (tr) => (turn.trace = tr));
  } catch (err) {
    turn.error = err.message;
  } finally {
    turn.running = false;
    draw();
  }
}
