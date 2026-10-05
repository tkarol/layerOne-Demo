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
export const LEAK_RE = /\b(?:\d{4}[ -]){3}\d{4}\b|\b\d{3}-\d{2}-\d{4}\b|\b\d{1,2}\/\d{1,2}\/(?:19|20)\d{2}\b|(?:\(\d{3}\)\s?|\b\d{3}[-.])\d{3}[-.]\d{4}\b|(?<=\baccount(?:\s*number)?(?:\s+is)?\s*[:#]?\s*)\d{8,12}\b/gi;
export const REDACTED_RE = /\[REDACTED-[A-Z]+\]/g;
