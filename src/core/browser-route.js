// "Send from this browser": for a LayerOne gateway the server can't reach, such as one
// running on the presenter's own laptop (http://localhost:4000). The server still builds
// the request and records the trace, but the presenter's browser makes the call:
//   1. POST /api/run (or /api/app/run) with via: { url, model, step: 'build' }
//      → { trace, request }: the first trace snapshot and the request to send
//        (no API key: the browser adds its own, which never reaches the server).
//   2. The browser sends the request to LayerOne itself.
//   3. POST the same body again with via: { url, model, traceId, result }, where result is
//      { status, statusText, headers, body, ms } or { error, ms }
//      → the rest of the trace, as server-sent events, saved to History as usual.
import { createTrace, runWorkflow } from './workflow.js';

const MAX_BODY = 2_000_000;
const TRACE_ID = /^trc_\d{14}_[0-9a-f]{6}$/;
const KEY_NOTE = '•••••••• (added by the browser)';

const isHttpUrl = (s) => {
  try {
    return ['http:', 'https:'].includes(new URL(s).protocol);
  } catch {
    return false;
  }
};

// The settings for one browser-sent request: Live, to the browser's URL, with no key
// (and none of the server's extra headers, which could hold secrets).
export function viaConfig(cfg, via) {
  const url = String(via?.url ?? '').trim().replace(/\/+$/, '');
  if (!isHttpUrl(url)) return { error: 'Enter the LayerOne URL this browser should send to, like http://localhost:4000/v1/chat/completions' };
  const full = /\/chat\/completions$/.test(url);
  const model = String(via.model ?? '').trim().slice(0, 200);
  return { cfg: { ...cfg, mode: 'live', via: 'browser', baseUrl: url, chatPath: full ? '' : cfg.chatPath, apiKey: '', extraHeaders: {}, ...(model ? { model } : {}) } };
}

const gatewayDone = (t) => !['pending', 'running'].includes(t.steps.find((s) => s.key === 'gateway')?.status);

// Show where the key came from, and LayerOne's real response time (measured in the browser).
function patch(t, cfg, ms) {
  if (t.request?.headers && !t.request.headers[cfg.authHeader]) t.request.headers = { ...t.request.headers, [cfg.authHeader]: KEY_NOTE };
  if (ms == null) return t;
  const g = t.steps.find((s) => s.key === 'gateway');
  if (g?.durationMs != null) g.durationMs = ms;
  if (t.response) t.response.latencyMs = Math.round(ms);
  if (t.totalMs != null) t.totalMs = Math.round(t.totalMs + ms);
  return t;
}

// Step 1: run the workflow up to the moment it would call LayerOne, and hand that call back.
export async function buildForBrowser(input, cfg) {
  let request = null;
  let snapshot = null;
  let handed = false;
  let stop;
  const trace = createTrace(input, cfg, '');
  const run = runWorkflow(trace, {
    cfg,
    origin: '',
    input,
    fetchFn: (url, init) => {
      request = { url, method: init.method, headers: { ...init.headers }, body: init.body };
      return new Promise((_, reject) => (stop = reject));
    },
    emit: (t) => !handed && (snapshot = t),
  });
  // The workflow is synchronous up to the call, so by now `request` is set and the last
  // snapshot shows "Waiting for LayerOne…" (or it failed before the call).
  handed = true;
  stop?.(new Error('handed to the browser'));
  await run.catch(() => {});
  if (!request) return { trace: snapshot };
  return {
    trace: patch(snapshot, cfg),
    request: { ...request, authHeader: cfg.authHeader, authScheme: cfg.authScheme, timeoutMs: cfg.timeoutMs },
  };
}

// Step 3: replay the workflow with the browser's result in place of the network call.
export function resultFetch(result) {
  return async () => {
    if (!result || typeof result !== 'object') throw new Error('The browser did not send a result');
    if (result.error) throw new Error(String(result.error).slice(0, 500));
    const status = Number(result.status);
    if (!Number.isInteger(status) || status < 200 || status > 599) throw new Error(`The browser got an unusable HTTP status (${result.status})`);
    const headers = new Headers();
    for (const [k, v] of Object.entries(result.headers || {}).slice(0, 200)) {
      try {
        headers.set(k, String(v));
      } catch {}
    }
    const body = [204, 205, 304].includes(status) ? null : String(result.body ?? '').slice(0, MAX_BODY);
    const statusText = String(result.statusText || '').replace(/[^\t\x20-\x7e]/g, '').slice(0, 100);
    return new Response(body, { status, statusText, headers });
  };
}

export function finishOptions(via, cfg) {
  const ms = Math.max(0, Math.min(Number(via.result?.ms) || 0, 600_000));
  return {
    traceId: TRACE_ID.test(via.traceId) ? via.traceId : null,
    fetchFn: resultFetch(via.result),
    // Steps before the call were already shown from step 1.
    filter: gatewayDone,
    patch: (t) => patch(t, cfg, ms),
  };
}
