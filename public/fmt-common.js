// Shared by the sample apps with their own screens (live call, batch queue,
// tool-using agent): run one AI step through LayerOne and describe the outcome.
import { readTraceStream, LEAK_RE, REDACTED_RE } from './stream.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Sensitive data in red, what LayerOne removed in amber.
export const mark = (text) =>
  esc(text)
    .replace(new RegExp(LEAK_RE.source, 'gi'), (m) => `<mark class="leak" title="Sensitive data">${m}</mark>`)
    .replace(REDACTED_RE, (m) => `<mark title="Removed by LayerOne">${m}</mark>`);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One AI step through /api/app/run; onTrace gets each live snapshot. Resolves with the final trace.
export async function runStep(appId, wfId, prot, onTrace = () => {}) {
  const res = await fetch('/api/app/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app: appId, workflow: wfId, protected: prot }),
  });
  return readTraceStream(res, onTrace);
}

export const showTrace = (id) => window.dispatchEvent(new CustomEvent('l1:show-trace', { detail: { id } }));

// What LayerOne decided, in a few words: { cls, badge, text, received?, list? }.
export function outcome(t, wf) {
  if (!t || t.status === 'running') return { cls: 'wait', badge: '<span class="spinner small"></span>', text: 'Checking…' };
  const g = t.governance || {};
  const pol = g.policies || [];
  if (t.bypass) {
    const list = offIssues(t, wf);
    return { cls: list.length ? 'bad' : 'ok', badge: list.length ? '⚠️ Got through' : '✓ Sent', text: list.length ? 'LayerOne was off. Nothing was checked:' : 'LayerOne was off, but nothing risky this time.', list };
  }
  if (t.status === 'error' && g.decision !== 'blocked') return { cls: 'bad', badge: 'Error', text: t.error || 'Something went wrong.' };
  if (g.decision === 'blocked') {
    const b = pol.find((p) => p.result === 'block');
    return { cls: 'stop', badge: '⛔ Blocked', text: b ? `${b.name}: ${b.detail}.` : 'Stopped by policy.' };
  }
  if (g.decision === 'held') {
    const h = pol.find((p) => p.result === 'hold');
    return { cls: 'held', badge: '✋ Held', text: (h?.detail || 'Held for review.').replace(/^Judge score \d+\/10:\s*/, '') };
  }
  const removed = pol.filter((p) => p.result === 'redact');
  if (removed.length) {
    return {
      cls: 'clean',
      badge: '🛡️ Cleaned',
      text: removed.map((p) => (p.stage === 'output' ? `${p.detail}.` : `${p.detail} before it reached the AI.`)).join(' '),
      received: t.governance?.extensions?.layerone?.sanitized_prompt || null,
    };
  }
  return { cls: 'ok', badge: '✅ Allowed', text: 'Nothing risky. Went straight through.' };
}

// What went wrong when LayerOne was off, in plain words.
export function offIssues(t, wf) {
  const prompt = t.prompt || '';
  const out = t.output || '';
  const list = [];
  if (wf?.policy === 'Prompt injection' && /^Done\./.test(out)) list.push('The AI followed instructions it should never have obeyed');
  if (/\bCUI\/\//.test(prompt)) list.push('Controlled (CUI) data went to an AI model that is not authorized for it');
  const pii = (prompt.replace(/\bCUI(?:\/\/[A-Z-]+)?\b/g, '').match(new RegExp(LEAK_RE.source, 'gi')) || []).length;
  if (pii) list.push(`${pii} piece${pii > 1 ? 's' : ''} of personal data went to the AI model provider`);
  if ((t.promptTokens || 0) > 8000) list.push(`About ${Number(t.promptTokens).toLocaleString('en-US')} tokens went out in one request, with no limit`);
  if (wf?.policy === 'Bulk personal data') list.push('A bulk export of everyone’s SSNs went ahead');
  if (/^LLM judge: grounding/.test(wf?.policy || '')) list.push('Nobody checked the answer against the documents it cites, and it is wrong');
  else if (/^LLM judge/.test(wf?.policy || '')) list.push('Nobody checked the answer before it was used, and it is wrong');
  if (new RegExp(LEAK_RE.source, 'i').test(out.replace(/\bCUI(?:\/\/[A-Z-]+)?\b/g, '')) && !list.some((x) => x.includes('obeyed'))) list.push('Sensitive data appeared in the AI’s answer');
  return list;
}
