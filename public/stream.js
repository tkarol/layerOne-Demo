// Reads a /api/run or /api/app/run response: server-sent events, one trace
// snapshot per frame. Calls onTrace for each snapshot; resolves with the last one.
export const NO_BACKEND_MSG =
  'This page cannot reach its backend, so Send and Settings will not work. If it is hosted on Cloudflare, deploy this repo as a Cloudflare Worker (see "Deploy to Cloudflare" in the README), not as a static Pages site.';

export async function readTraceStream(res, onTrace) {
  if (!(res.headers.get('content-type') || '').includes('text/event-stream')) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || NO_BACKEND_MSG);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let last = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let i;
    while ((i = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, i);
      buffer = buffer.slice(i + 2);
      const data = frame.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('');
      if (!data) continue;
      last = JSON.parse(data);
      onTrace(last);
    }
  }
  return last;
}

// Personal data patterns, used to highlight what leaked (raw) or was removed (token).
export const LEAK_RE = /\bCUI(?:\/\/[A-Z-]+)?\b|(?<=\bMRN[:#]?\s*)\d{6,10}\b|\b(?:\d{4}[ -]){3}\d{4}\b|\b\d{3}-\d{2}-\d{4}\b|\b\d{1,2}\/\d{1,2}\/(?:19|20)\d{2}\b|(?:\(\d{3}\)\s?|\b\d{3}[-.])\d{3}[-.]\d{4}\b|(?<=\baccount(?:\s*number)?(?:\s+is)?\s*[:#]?\s*)\d{8,12}\b/gi;
export const REDACTED_RE = /\[REDACTED-[A-Z]+\]/g;

// ---------- Sending from this browser ----------
// For a LayerOne gateway the server can't reach (one running on this laptop, at
// http://localhost:4000): the server builds the request and records the trace, and this
// browser makes the call. Saved on this device only; the API key never leaves it.
const ROUTE_KEY = 'l1-browser-route';
export const ROUTE_DEFAULTS = { on: false, url: 'http://localhost:4000/v1/chat/completions', key: '', model: 'haiku-5-5' };

export function browserRoute() {
  try {
    return { ...ROUTE_DEFAULTS, ...JSON.parse(localStorage.getItem(ROUTE_KEY) || '{}') };
  } catch {
    return { ...ROUTE_DEFAULTS };
  }
}

export function saveBrowserRoute(r) {
  try {
    localStorage.setItem(ROUTE_KEY, JSON.stringify({ on: Boolean(r.on), url: String(r.url || '').trim(), key: String(r.key || ''), model: String(r.model || '').trim() }));
  } catch {}
  window.dispatchEvent(new CustomEvent('l1:route', { detail: browserRoute() }));
}

// Send one built request to LayerOne from here. Never throws: returns what happened.
export async function callFromBrowser(req, key) {
  const headers = { ...req.headers };
  if (key) headers[req.authHeader || 'Authorization'] = req.authScheme ? `${req.authScheme} ${key}` : key;
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  try {
    const res = await fetch(req.url, { method: req.method || 'POST', headers, body: req.body, signal: AbortSignal.timeout(req.timeoutMs || 60000) });
    const text = await res.text();
    return { status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries()), body: text, ms: ms() };
  } catch (err) {
    return { error: browserFetchError(err, req), ms: ms() };
  }
}

export function browserFetchError(err, req) {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return `No response within ${req.timeoutMs || 60000} ms`;
  let host = req.url;
  try {
    host = new URL(req.url).origin;
  } catch {}
  return (
    `This browser could not reach ${host}. Check that LayerOne is running there, that you clicked Allow ` +
    `when the browser asked to reach devices on your local network, and that LayerOne accepts requests from ` +
    `${location.origin} (CORS). Use Chrome or Edge; Safari blocks http://localhost from an https page.`
  );
}

// POST to /api/run or /api/app/run. Returns a response that readTraceStream reads the same
// way whichever route is on. LayerOne switched off always goes from the server.
export async function postRun(path, body) {
  const post = (b) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  const r = browserRoute();
  if (!r.on || body.protected === false) return post(body);
  const via = { url: r.url, model: r.model };
  const prep = await post({ ...body, via: { ...via, step: 'build' } });
  const built = await prep.json().catch(() => null);
  if (!prep.ok || !built?.trace) throw new Error(built?.error || NO_BACKEND_MSG);
  const enc = new TextEncoder();
  const frame = (t) => enc.encode(`data: ${JSON.stringify(t)}\n\n`);
  const stream = new ReadableStream({
    async start(ctrl) {
      ctrl.enqueue(frame(built.trace)); // "Waiting for LayerOne…"
      if (!built.request) return ctrl.close(); // failed before the call
      const result = await callFromBrowser(built.request, r.key);
      try {
        const fin = await post({ ...body, via: { ...via, traceId: built.trace.id, result } });
        if (!(fin.headers.get('content-type') || '').includes('text/event-stream')) {
          const d = await fin.json().catch(() => null);
          throw new Error(d?.error || 'The server could not record the result');
        }
        const reader = fin.body.getReader();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          ctrl.enqueue(value);
        }
        ctrl.close();
      } catch (err) {
        ctrl.error(err);
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
}
