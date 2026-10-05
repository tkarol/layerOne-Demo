// Runtime settings editable from the UI. Precedence: built-in defaults < .env /
// environment < values saved from the settings panel (data/settings.json).
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { config, endpointUrl } from './config.js';
import { buildRequest, send, parseBody, extractGovernance, extractOutput } from './layerone.js';

const FIELDS = ['mode', 'baseUrl', 'chatPath', 'apiKey', 'authHeader', 'authScheme', 'model', 'timeoutMs', 'upstreamUrl', 'upstreamProvider'];

// Snapshot of the .env / environment values, used by "Reset to defaults".
const envDefaults = Object.fromEntries(FIELDS.map((k) => [k, config[k]]));

function isHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const originOf = (s) => {
  try {
    return new URL(s).origin;
  } catch {
    return '';
  }
};

// Validate a partial update against the current values. Returns the merged
// settings, or field-level errors. `apiKey` is only changed when a new value
// is given (or `clearApiKey` is set), because the UI never receives the key.
export function validate(input, current = config) {
  const errors = {};
  const next = Object.fromEntries(FIELDS.map((k) => [k, current[k]]));
  const str = (v) => (typeof v === 'string' ? v.trim() : v);

  if (input.mode !== undefined) {
    if (['mock', 'live'].includes(input.mode)) next.mode = input.mode;
    else errors.mode = 'Choose dry run or live';
  }
  if (input.baseUrl !== undefined) next.baseUrl = str(input.baseUrl).replace(/\/+$/, '');
  if (input.chatPath !== undefined) next.chatPath = str(input.chatPath) || '/v1/chat/completions';
  if (input.authHeader !== undefined) next.authHeader = str(input.authHeader) || 'Authorization';
  if (input.authScheme !== undefined) next.authScheme = str(input.authScheme);
  if (input.model !== undefined) next.model = str(input.model) || 'demo-model';
  if (input.upstreamUrl !== undefined) next.upstreamUrl = str(input.upstreamUrl);
  if (input.upstreamProvider !== undefined) next.upstreamProvider = str(input.upstreamProvider);
  if (input.timeoutMs !== undefined) next.timeoutMs = Number(input.timeoutMs);

  if (next.mode === 'live' && !next.baseUrl) errors.baseUrl = 'Required for live mode';
  else if (next.baseUrl && !isHttpUrl(next.baseUrl)) errors.baseUrl = 'Must be an http(s) URL';
  if (!next.chatPath.startsWith('/')) errors.chatPath = 'Must start with /';
  if (!/^[A-Za-z0-9-]+$/.test(next.authHeader)) errors.authHeader = 'Letters, numbers and dashes only';
  if (!/^[A-Za-z0-9-]*$/.test(next.authScheme)) errors.authScheme = 'Letters, numbers and dashes only (or empty)';
  if (next.model.length > 200) errors.model = 'Too long';
  if (next.upstreamUrl && !isHttpUrl(next.upstreamUrl)) errors.upstreamUrl = 'Must be an http(s) URL';
  if (next.upstreamProvider.length > 100) errors.upstreamProvider = 'Too long';
  if (!Number.isFinite(next.timeoutMs) || next.timeoutMs < 1000 || next.timeoutMs > 300000) errors.timeoutMs = 'Between 1,000 and 300,000 ms';

  let notice = null;
  if (input.clearApiKey) next.apiKey = '';
  else if (typeof input.apiKey === 'string' && input.apiKey.trim()) next.apiKey = input.apiKey.trim();
  else if (next.apiKey && current.baseUrl && originOf(next.baseUrl) !== originOf(current.baseUrl)) {
    // Never forward a saved key to a different host without it being re-entered.
    next.apiKey = '';
    notice = 'The saved API key was removed because the LayerOne host changed. Enter the key for the new host.';
  }

  return { next, errors, notice, ok: Object.keys(errors).length === 0 };
}

export function publicSettings() {
  const key = config.apiKey;
  return {
    mode: config.mode,
    baseUrl: config.baseUrl,
    chatPath: config.chatPath,
    authHeader: config.authHeader,
    authScheme: config.authScheme,
    model: config.model,
    timeoutMs: config.timeoutMs,
    upstreamUrl: config.upstreamUrl,
    upstreamProvider: config.upstreamProvider,
    apiKeySet: Boolean(key),
    apiKeyHint: key ? `…${key.slice(-4)}` : null,
    endpoint: endpointUrl(),
    savedInUi: fs.existsSync(config.settingsFile),
    locked: config.settingsLocked,
  };
}

function persist() {
  const data = Object.fromEntries(FIELDS.map((k) => [k, config[k]]));
  fs.mkdirSync(path.dirname(config.settingsFile), { recursive: true });
  fs.writeFileSync(config.settingsFile, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function applySettings(input) {
  const result = validate(input);
  if (result.ok) {
    Object.assign(config, result.next);
    persist();
  }
  return result;
}

export function resetSettings() {
  Object.assign(config, envDefaults);
  if (fs.existsSync(config.settingsFile)) fs.rmSync(config.settingsFile);
}

export function loadSavedSettings() {
  if (!fs.existsSync(config.settingsFile)) return;
  try {
    const saved = JSON.parse(fs.readFileSync(config.settingsFile, 'utf8'));
    const { next, ok, errors } = validate({ ...saved, apiKey: saved.apiKey || undefined, clearApiKey: !saved.apiKey }, config);
    if (ok) Object.assign(config, next);
    else console.warn('[settings] Ignoring invalid saved settings:', errors);
  } catch (err) {
    console.warn(`[settings] Could not read ${config.settingsFile}: ${err.message}`);
  }
}

// Send one small request using draft settings (not saved) and report the result.
export async function testConnection(input) {
  const { next, errors, ok } = validate(input);
  if (!ok) return { ok: false, errors };
  const cfg = { ...config, ...next };
  const req = buildRequest({ prompt: 'Connection test from the LayerOne demo. Reply with the single word OK.', traceId: `test_${Date.now()}` }, cfg);
  const t0 = performance.now();
  try {
    const res = await send(req, Math.min(cfg.timeoutMs, 20000));
    const text = await res.text();
    const headers = Object.fromEntries(res.headers.entries());
    const body = parseBody(text);
    const gov = extractGovernance({ status: res.status, headers, body });
    return {
      ok: res.ok,
      url: req.url,
      status: res.status,
      statusText: res.statusText,
      latencyMs: Math.round(performance.now() - t0),
      decision: gov.decision,
      upstream: gov.upstream,
      reply: String(extractOutput(body) ?? '').slice(0, 300),
    };
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'Timed out' : err.cause?.message || err.message;
    return { ok: false, url: req.url, error: `Could not reach ${req.url}: ${reason}`, latencyMs: Math.round(performance.now() - t0) };
  }
}
