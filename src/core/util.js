// Small helpers built only on Web APIs, so the core runs on Cloudflare Workers and Node.
const encoder = new TextEncoder();

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const jitter = (min, max) => Math.round(min + Math.random() * (max - min));

// Dry-run timing multiplier for the X-Demo-Pace header.
export const paceFactor = (pace) => ({ fast: 0.3, normal: 1, slow: 1.7 })[pace] ?? 1;
export const byteLength = (s) => encoder.encode(s).length;
export const now = () => performance.now();

export function randomHex(bytes) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function json(status, data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

// Length-independent string comparison for the settings password.
export function safeEqual(a, b) {
  const x = encoder.encode(String(a));
  const y = encoder.encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
