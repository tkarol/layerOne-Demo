// Configuration. Precedence: built-in defaults < environment (.env locally, Worker
// variables/secrets on Cloudflare) < values saved from the in-app Settings panel.

export const SETTINGS_FIELDS = [
  'mode', 'baseUrl', 'chatPath', 'apiKey', 'authHeader', 'authScheme', 'model', 'timeoutMs', 'upstreamUrl', 'upstreamProvider', 'pace',
  'directUrl', 'directApiKey', 'directAuthHeader', 'directAuthScheme', 'directModel',
  'showPlay', 'showCustomize',
];

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
    // Direct AI model, used only when LayerOne is switched OFF in the sample apps (Live mode).
    // Must be OpenAI-compatible, e.g. https://api.openai.com/v1/chat/completions.
    directUrl: env.DIRECT_MODEL_URL || '',
    directApiKey: env.DIRECT_MODEL_API_KEY || '',
    directAuthHeader: env.DIRECT_MODEL_AUTH_HEADER || 'Authorization',
    directAuthScheme: env.DIRECT_MODEL_AUTH_SCHEME ?? 'Bearer',
    directModel: env.DIRECT_MODEL || '',
    // Optional sample-app features, hidden unless turned on in Settings.
    showPlay: /^(1|true|yes)$/i.test(env.DEMO_SHOW_PLAY || ''),
    showCustomize: /^(1|true|yes)$/i.test(env.DEMO_SHOW_CUSTOMIZE || ''),
    // How fast steps play on screen (and, in Dry run, how long the stand-ins take).
    pace: ['fast', 'normal', 'slow'].includes(env.DEMO_PACE) ? env.DEMO_PACE : 'normal',
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
export const mockJudgeUrl = (origin) => `${origin}/mock/judge/v1/evaluate`;

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
    pace: cfg.pace,
    authHeader: cfg.authHeader,
    authConfigured: cfg.mode === 'mock' || Boolean(cfg.apiKey),
    configured: cfg.mode === 'mock' || Boolean(cfg.baseUrl),
    settingsLocked: cfg.settingsLocked,
    directConfigured: Boolean(cfg.directUrl),
    features: { play: Boolean(cfg.showPlay), customize: Boolean(cfg.showCustomize) },
  };
}
