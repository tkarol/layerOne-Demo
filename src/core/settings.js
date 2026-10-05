// Settings editable from the UI. Saved values live in the app's storage
// (a Durable Object on Cloudflare, a JSON file locally) and override the environment.
import { SETTINGS_FIELDS, endpointUrl } from './config.js';
import { buildRequest, send, parseBody, extractGovernance, extractOutput, describeFetchError } from './layerone.js';
import { now } from './util.js';

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
// settings, or field-level errors. `apiKey` only changes when a new value is
// given (or `clearApiKey` is set), because the UI never receives the key.
export function validate(input, current) {
  const errors = {};
  const next = Object.fromEntries(SETTINGS_FIELDS.map((k) => [k, current[k]]));
  const str = (v) => (typeof v === 'string' ? v.trim() : String(v ?? ''));

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
  if (input.directUrl !== undefined) next.directUrl = str(input.directUrl);
  if (input.directAuthHeader !== undefined) next.directAuthHeader = str(input.directAuthHeader) || 'Authorization';
  if (input.directAuthScheme !== undefined) next.directAuthScheme = str(input.directAuthScheme);
  if (input.directModel !== undefined) next.directModel = str(input.directModel);
  for (const k of ['showPlay', 'showCustomize']) if (input[k] !== undefined) next[k] = input[k] === true || input[k] === 'true';
  if (input.pace !== undefined) {
    if (['fast', 'normal', 'slow'].includes(input.pace)) next.pace = input.pace;
    else errors.pace = 'Choose fast, normal or slow';
  }

  if (next.mode === 'live' && !next.baseUrl) errors.baseUrl = 'Required for live mode';
  else if (next.baseUrl && !isHttpUrl(next.baseUrl)) errors.baseUrl = 'Must be an http(s) URL';
  if (!next.chatPath.startsWith('/')) errors.chatPath = 'Must start with /';
  if (!/^[A-Za-z0-9-]+$/.test(next.authHeader)) errors.authHeader = 'Letters, numbers and dashes only';
  if (!/^[A-Za-z0-9-]*$/.test(next.authScheme)) errors.authScheme = 'Letters, numbers and dashes only (or empty)';
  if (next.model.length > 200) errors.model = 'Too long';
  if (next.upstreamUrl && !isHttpUrl(next.upstreamUrl)) errors.upstreamUrl = 'Must be an http(s) URL';
  if (next.upstreamProvider.length > 100) errors.upstreamProvider = 'Too long';
  if (next.directUrl && !isHttpUrl(next.directUrl)) errors.directUrl = 'Must be an http(s) URL';
  if (!/^[A-Za-z0-9-]+$/.test(next.directAuthHeader)) errors.directAuthHeader = 'Letters, numbers and dashes only';
  if (!/^[A-Za-z0-9-]*$/.test(next.directAuthScheme)) errors.directAuthScheme = 'Letters, numbers and dashes only (or empty)';
  if (next.directModel.length > 200) errors.directModel = 'Too long';
  if (!Number.isFinite(next.timeoutMs) || next.timeoutMs < 1000 || next.timeoutMs > 300000) errors.timeoutMs = 'Between 1,000 and 300,000 ms';

  // Keys only change when re-entered, and are never forwarded to a different host.
  const notices = [];
  const keyRule = (keyField, clearField, urlField, what) => {
    if (input[clearField]) next[keyField] = '';
    else if (typeof input[keyField] === 'string' && input[keyField].trim()) next[keyField] = input[keyField].trim();
    else if (next[keyField] && current[urlField] && originOf(next[urlField]) !== originOf(current[urlField])) {
      next[keyField] = '';
      notices.push(`The saved ${what} API key was removed because its host changed. Enter the key for the new host.`);
    }
  };
  keyRule('apiKey', 'clearApiKey', 'baseUrl', 'LayerOne');
  keyRule('directApiKey', 'clearDirectApiKey', 'directUrl', 'direct model');
  const notice = notices.join(' ') || null;

  return { next, errors, notice, ok: Object.keys(errors).length === 0 };
}

export function publicSettings(cfg, origin, { savedInUi }) {
  return {
    mode: cfg.mode,
    baseUrl: cfg.baseUrl,
    chatPath: cfg.chatPath,
    authHeader: cfg.authHeader,
    authScheme: cfg.authScheme,
    model: cfg.model,
    timeoutMs: cfg.timeoutMs,
    upstreamUrl: cfg.upstreamUrl,
    upstreamProvider: cfg.upstreamProvider,
    pace: cfg.pace,
    showPlay: Boolean(cfg.showPlay),
    showCustomize: Boolean(cfg.showCustomize),
    directUrl: cfg.directUrl,
    directAuthHeader: cfg.directAuthHeader,
    directAuthScheme: cfg.directAuthScheme,
    directModel: cfg.directModel,
    directApiKeySet: Boolean(cfg.directApiKey),
    directApiKeyHint: cfg.directApiKey ? `…${cfg.directApiKey.slice(-4)}` : null,
    apiKeySet: Boolean(cfg.apiKey),
    apiKeyHint: cfg.apiKey ? `…${cfg.apiKey.slice(-4)}` : null,
    endpoint: endpointUrl(cfg, origin),
    savedInUi,
    locked: cfg.settingsLocked,
    passwordRequired: Boolean(cfg.settingsPassword),
  };
}

export const toSaved = (cfg) => Object.fromEntries(SETTINGS_FIELDS.map((k) => [k, cfg[k]]));

// Send one small request using draft settings (not saved) and report the result.
export async function testConnection(input, cfg, { origin, fetchFn }) {
  const { next, errors, ok } = validate(input, cfg);
  if (!ok) return { ok: false, errors };
  const draft = { ...cfg, ...next };
  const req = buildRequest({ prompt: 'Connection test from the LayerOne demo. Reply with the single word OK.', traceId: `test_${Date.now()}`, origin }, draft);
  const t0 = now();
  try {
    const res = await send(req, Math.min(draft.timeoutMs, 20000), fetchFn);
    const text = await res.text();
    const headers = Object.fromEntries(res.headers.entries());
    const body = parseBody(text);
    const gov = extractGovernance({ status: res.status, headers, body });
    return {
      ok: res.ok,
      url: req.url,
      status: res.status,
      statusText: res.statusText,
      latencyMs: Math.round(now() - t0),
      decision: gov.decision,
      upstream: gov.upstream,
      reply: String(extractOutput(body) ?? '').slice(0, 300),
    };
  } catch (err) {
    const reason = describeFetchError(err, Math.min(draft.timeoutMs, 20000));
    return { ok: false, url: req.url, error: `Could not reach ${req.url}: ${reason}`, latencyMs: Math.round(now() - t0) };
  }
}
