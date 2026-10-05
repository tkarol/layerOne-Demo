// Configuration. Precedence: built-in defaults < environment (.env locally, Worker
// variables/secrets on Cloudflare) < values saved from the in-app Settings panel.

export const SETTINGS_FIELDS = ['mode', 'baseUrl', 'chatPath', 'apiKey', 'authHeader', 'authScheme', 'model', 'timeoutMs', 'upstreamUrl', 'upstreamProvider'];

// Key sent to the built-in simulated gateway during a dry run.
export const DRY_RUN_KEY = 'dry-run-demo-key';

function parseJson(text, fallback) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// Read configuration from an environment object (process.env or a Worker env).
export function envConfig(env = {}) {
  const mode = String(env.LAYERONE_MODE || (env.LAYERONE_BASE_URL ? 'live' : 'mock')).toLowerCase();
  return {
    mode: mode === 'live' ? 'live' : 'mock',
    baseUrl: String(env.LAYERONE_BASE_URL || '').replace(/\/+$/, ''),
    chatPath: env.LAYERONE_CHAT_PATH || '/v1/chat/completions',
    apiKey: env.LAYERONE_API_KEY || '',
    authHeader: env.LAYERONE_AUTH_HEADER || 'Authorization',
    authScheme: env.LAYERONE_AUTH_SCHEME ?? 'Bearer',
    model: env.LAYERONE_MODEL || 'demo-model',
    extraHeaders: parseJson(env.LAYERONE_EXTRA_HEADERS, {}),
    timeoutMs: Number(env.LAYERONE_TIMEOUT_MS || 60000),
    systemPrompt: env.DEMO_SYSTEM_PROMPT || 'You are a benefits claims assistant helping caseworkers process claims.',
    // Where LayerOne forwards requests. Display only, for when LayerOne does not report it.
    upstreamUrl: env.LAYERONE_UPSTREAM_URL || '',
    upstreamProvider: env.LAYERONE_UPSTREAM_PROVIDER || '',
    // ALLOW_UI_SETTINGS=false makes the Settings panel read-only.
    settingsLocked: /^(0|false|no)$/i.test(env.ALLOW_UI_SETTINGS || ''),
    // When set, saving/testing/resetting settings requires this password.
    settingsPassword: env.SETTINGS_PASSWORD || '',
  };
}

export function mergeSaved(base, saved) {
  if (!saved) return { ...base };
  const out = { ...base };
  for (const k of SETTINGS_FIELDS) if (saved[k] !== undefined) out[k] = saved[k];
  return out;
}

// In dry run the endpoints point at this app's own built-in stand-ins.
export function endpointUrl(cfg, origin) {
  const base = cfg.mode === 'mock' ? `${origin}/mock/layerone` : cfg.baseUrl;
  return base + cfg.chatPath;
}

export const mockModelUrl = (origin) => `${origin}/mock/model/v1/chat/completions`;

// Best known target of the LayerOne → AI model hop before any response arrives.
export function configuredUpstream(cfg, origin) {
  if (cfg.mode === 'mock') return { method: 'POST', url: mockModelUrl(origin), provider: 'Simulated AI model', model: cfg.model, source: 'simulated' };
  if (cfg.upstreamUrl) return { method: 'POST', url: cfg.upstreamUrl, provider: cfg.upstreamProvider || null, model: cfg.model, source: 'config' };
  return null;
}

export function publicConfig(cfg, origin) {
  return {
    mode: cfg.mode,
    endpoint: { method: 'POST', url: endpointUrl(cfg, origin) },
    upstream: configuredUpstream(cfg, origin),
    model: cfg.model,
    authHeader: cfg.authHeader,
    authConfigured: cfg.mode === 'mock' || Boolean(cfg.apiKey),
    configured: cfg.mode === 'mock' || Boolean(cfg.baseUrl),
    settingsLocked: cfg.settingsLocked,
  };
}
