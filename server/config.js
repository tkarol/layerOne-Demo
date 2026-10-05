import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env loader so the demo runs with zero dependencies.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let value = m[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}

function parseJson(text, fallback) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    console.warn(`[config] Could not parse JSON value: ${text}`);
    return fallback;
  }
}

loadEnvFile(path.join(ROOT, '.env'));
const env = process.env;

const mode = (env.LAYERONE_MODE || (env.LAYERONE_BASE_URL ? 'live' : 'mock')).toLowerCase();

export const config = {
  port: Number(env.PORT || 3000),
  host: env.HOST || '127.0.0.1',
  mode,
  baseUrl: (env.LAYERONE_BASE_URL || '').replace(/\/+$/, ''),
  chatPath: env.LAYERONE_CHAT_PATH || '/v1/chat/completions',
  apiKey: env.LAYERONE_API_KEY || (mode === 'mock' ? 'mock-demo-key' : ''),
  authHeader: env.LAYERONE_AUTH_HEADER || 'Authorization',
  authScheme: env.LAYERONE_AUTH_SCHEME ?? 'Bearer',
  model: env.LAYERONE_MODEL || 'demo-model',
  extraHeaders: parseJson(env.LAYERONE_EXTRA_HEADERS, {}),
  timeoutMs: Number(env.LAYERONE_TIMEOUT_MS || 60000),
  systemPrompt: env.DEMO_SYSTEM_PROMPT || 'You are a helpful mission-support assistant.',
  dataFile: env.TRACE_FILE || path.join(ROOT, 'data', 'traces.jsonl'),
};

// In mock mode the app calls its own simulated gateway over real HTTP, so the
// trace shows a genuine network round trip. The port is only known after listen().
export function endpointUrl() {
  const base = config.mode === 'mock' ? `http://127.0.0.1:${config.port}/mock/layerone` : config.baseUrl;
  return base + config.chatPath;
}

export function publicConfig() {
  return {
    mode: config.mode,
    endpoint: { method: 'POST', url: endpointUrl() },
    model: config.model,
    authHeader: config.authHeader,
    authConfigured: Boolean(config.apiKey),
    extraHeaderNames: Object.keys(config.extraHeaders),
    configured: config.mode === 'mock' || Boolean(config.baseUrl),
  };
}
