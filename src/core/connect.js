// "Connect" tab: help get connected to a LayerOne deployment.
//   connectInfo  what the demo will call, and how it authenticates (no secrets)
//   runChecks    a short series of checks, from "is the host reachable" to "is a policy enforced"
//   sendCustom   one request built in the page, sent from the server so the key stays here
// Requests only ever go to the configured LayerOne host (or the dry-run stand-in),
// never to an arbitrary URL.
import { DRY_RUN_KEY, joinUrl, layeroneHeaders, effectiveRunId } from './config.js';
import { redactHeaders, describeFetchError, parseBody, extractGovernance, extractOutput } from './layerone.js';
import { now } from './util.js';

const CHECK_TIMEOUT_MS = 20000;
const MAX_BODY = 100_000;
const MAX_RESPONSE = 200_000;

const baseOf = (cfg, origin) => (cfg.mode === 'mock' ? `${origin}/mock/layerone` : cfg.baseUrl);
// Layer One's proxy health endpoint sits at the root of its host.
const healthOf = (cfg, origin) => {
  if (cfg.mode === 'mock') return `${origin}/mock/layerone/health`;
  try {
    return `${new URL(cfg.baseUrl).origin}/health`;
  } catch {
    return '';
  }
};
const keyOf = (cfg) => (cfg.mode === 'mock' ? DRY_RUN_KEY : cfg.apiKey);
const authValue = (cfg, key) => (cfg.authScheme ? `${cfg.authScheme} ${key}` : key);

export function connectInfo(cfg, origin) {
  const key = keyOf(cfg);
  return {
    mode: cfg.mode,
    baseUrl: baseOf(cfg, origin) || '',
    chatPath: cfg.chatPath,
    endpoint: baseOf(cfg, origin) ? joinUrl(baseOf(cfg, origin), cfg.chatPath) : '',
    healthUrl: healthOf(cfg, origin),
    // The base_url an OpenAI client needs: the chat endpoint without "/chat/completions".
    sdkBaseUrl: baseOf(cfg, origin) ? joinUrl(baseOf(cfg, origin), cfg.chatPath).replace(/\/chat\/completions$/, '') : '',
    agentId: cfg.agentId || 'layerone-demo',
    projectId: cfg.projectId || '',
    runId: effectiveRunId(cfg),
    runIdAuto: !cfg.runId,
    tracesUrl: cfg.tracesUrl || '',
    authHeader: cfg.authHeader,
    authScheme: cfg.authScheme || '',
    keySet: Boolean(key),
    keyHint: cfg.mode === 'mock' ? DRY_RUN_KEY : key ? `…${key.slice(-4)}` : '',
    // The dry-run key is not a secret, so commands can include it as is.
    dryRunKey: cfg.mode === 'mock' ? DRY_RUN_KEY : null,
    model: cfg.model,
    timeoutMs: cfg.timeoutMs,
    extraHeaders: Object.keys(cfg.extraHeaders || {}),
  };
}

function headersFor(cfg, { withKey = true, json = true } = {}) {
  const h = { Accept: 'application/json', 'X-Demo-Client': 'layerone-demo-connect', ...layeroneHeaders(cfg), ...(cfg.extraHeaders || {}) };
  if (json) h['Content-Type'] = 'application/json';
  const key = keyOf(cfg);
  if (withKey && key) h[cfg.authHeader] = authValue(cfg, key);
  return h;
}

const chatBody = (cfg, content) => JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content }], max_tokens: 50, temperature: 0 });

async function call(fetchFn, url, init) {
  const t0 = now();
  try {
    const res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
    const text = await res.text();
    const headers = Object.fromEntries(res.headers.entries());
    return { ok: true, status: res.status, statusText: res.statusText, headers, text, body: parseBody(text), ms: Math.round(now() - t0) };
  } catch (err) {
    return { ok: false, error: describeFetchError(err, CHECK_TIMEOUT_MS), ms: Math.round(now() - t0) };
  }
}

// Each check: { id, name, status: pass | warn | fail | skip, detail, ms?, http? }
export async function runChecks(cfg, { origin, fetchFn }) {
  const checks = [];
  const add = (c) => (checks.push(c), c);
  const base = baseOf(cfg, origin);
  const endpoint = base ? joinUrl(base, cfg.chatPath) : '';
  const skipRest = (from, why) => {
    for (const [id, name] of STEPS.slice(STEPS.findIndex(([i]) => i === from))) add({ id, name, status: 'skip', detail: why });
    return { checks, info: connectInfo(cfg, origin) };
  };

  // 1. Settings
  if (cfg.mode === 'mock') add({ id: 'settings', name: STEP_NAME.settings, status: 'pass', detail: "Dry run: checking the demo's built-in LayerOne stand-in. Switch to Live in Settings to check your real deployment." });
  else if (!cfg.baseUrl) {
    add({ id: 'settings', name: STEP_NAME.settings, status: 'fail', detail: 'No LayerOne URL is set. Add it in Settings.' });
    return skipRest('reach', 'Needs a LayerOne URL first');
  } else add({ id: 'settings', name: STEP_NAME.settings, status: cfg.apiKey ? 'pass' : 'warn', detail: `${cfg.apiKey ? `Calling ${endpoint} with a saved key in the ${cfg.authHeader} header.` : `Calling ${endpoint}. No API key is saved, so requests go without one.`} Agent ID: ${cfg.agentId || 'layerone-demo'}${cfg.projectId ? `, project ID: ${cfg.projectId}` : ', no project ID (recommended)'}.` });

  // 2. Reach the host: Layer One's /health endpoint, else any HTTP answer from the base URL
  //    (that alone shows DNS, network and TLS work).
  const healthUrl = healthOf(cfg, origin);
  const health = await call(fetchFn, healthUrl, { method: 'GET', headers: { Accept: 'application/json' } });
  if (health.ok && health.status < 300) {
    add({ id: 'reach', name: STEP_NAME.reach, status: 'pass', detail: `Proxy health is OK (GET ${healthUrl} → HTTP ${health.status}).`, ms: health.ms, http: health.status });
  } else {
    const reach = await call(fetchFn, base, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!reach.ok) {
      add({ id: 'reach', name: STEP_NAME.reach, status: 'fail', detail: `${reach.error}. Check the URL, and that this server's network can reach it (VPN, firewall or allowlist).`, ms: reach.ms });
      return skipRest('auth', 'The host could not be reached');
    }
    add({ id: 'reach', name: STEP_NAME.reach, status: 'pass', detail: `The host answered (HTTP ${reach.status}), so DNS, network and TLS are working. ${healthUrl} did not report healthy.`, ms: reach.ms, http: reach.status });
  }

  // 3. Is the key accepted? Send a harmless chat request.
  const chat = await call(fetchFn, endpoint, { method: 'POST', headers: headersFor(cfg), body: chatBody(cfg, 'Connection test from the LayerOne demo. Reply with the single word OK.') });
  if (!chat.ok) {
    add({ id: 'auth', name: STEP_NAME.auth, status: 'fail', detail: `The chat endpoint did not answer: ${chat.error}.`, ms: chat.ms });
    return skipRest('chat', 'The chat endpoint did not answer');
  }
  // A 403 that LayerOne marks as a policy block is not an auth failure.
  const policyBlock = /policy/i.test(chat.body?.error?.type || '') || chat.body?.layerone?.decision === 'blocked' || chat.headers['x-layerone-decision'] === 'blocked';
  if (chat.status === 401 || (chat.status === 403 && !policyBlock)) {
    add({ id: 'auth', name: STEP_NAME.auth, status: 'fail', detail: `HTTP ${chat.status}: ${short(extractOutput(chat.body)) || 'rejected'}. Check the API key, the auth header (${cfg.authHeader}) and the scheme (${cfg.authScheme || 'none'}).`, ms: chat.ms, http: chat.status });
    return skipRest('chat', 'The key was not accepted');
  }
  if (chat.status === 404) {
    add({ id: 'auth', name: STEP_NAME.auth, status: 'fail', detail: `HTTP 404 at ${endpoint}. The host is up, but the chat path (${cfg.chatPath}) is wrong.`, ms: chat.ms, http: 404 });
    return skipRest('chat', 'The chat path was not found');
  }
  add({ id: 'auth', name: STEP_NAME.auth, status: 'pass', detail: `The request was accepted (HTTP ${chat.status}).`, ms: chat.ms, http: chat.status });

  // 4. A real chat completion comes back
  const reply = extractOutput(chat.body);
  const shaped = Array.isArray(chat.body?.choices);
  add({
    id: 'chat',
    name: STEP_NAME.chat,
    status: chat.status < 300 && shaped ? 'pass' : chat.status < 300 ? 'warn' : 'fail',
    detail:
      chat.status < 300 && shaped
        ? `The AI model answered through LayerOne: "${short(reply)}"`
        : chat.status < 300
          ? 'HTTP 200, but not an OpenAI-style chat completion (no "choices"). If your LayerOne uses another format, adjust src/core/layerone.js.'
          : `HTTP ${chat.status}: ${short(reply) || chat.statusText}`,
    ms: chat.ms,
    http: chat.status,
  });

  // 5. Governance signals the demo can show
  const gov = extractGovernance({ status: chat.status, headers: chat.headers, body: chat.body });
  const signals = [...Object.keys(gov.headers), gov.evidenceId && 'evidence id', gov.policies.length && `${gov.policies.length} policy results`].filter(Boolean);
  add({
    id: 'governance',
    name: STEP_NAME.governance,
    status: signals.length ? 'pass' : 'warn',
    detail: signals.length
      ? `LayerOne reported: ${signals.join(', ')}${gov.evidenceId ? ` (evidence ${gov.evidenceId})` : ''}.`
      : 'No LayerOne headers or policy details came back. The demo still works, but infers decisions from HTTP status codes.',
  });

  // 6. Is a policy enforced? Send a fake SSN.
  const pii = await call(fetchFn, endpoint, { method: 'POST', headers: headersFor(cfg), body: chatBody(cfg, 'Connection test: my SSN is 123-45-6789. Repeat it back to me.') });
  if (!pii.ok) add({ id: 'policy', name: STEP_NAME.policy, status: 'fail', detail: `No answer: ${pii.error}.`, ms: pii.ms });
  else {
    const g = extractGovernance({ status: pii.status, headers: pii.headers, body: pii.body });
    const out = String(extractOutput(pii.body) ?? '');
    const enforced = g.decision === 'blocked' || g.decision === 'redacted' || !/123-45-6789/.test(out);
    add({
      id: 'policy',
      name: STEP_NAME.policy,
      status: enforced ? 'pass' : 'warn',
      detail: enforced
        ? `A fake SSN was ${g.decision === 'blocked' ? 'blocked' : 'kept out of the answer'} (decision: ${g.decision}).`
        : 'A fake SSN came back in the answer. Check that the personal-data policy is turned on for this key or app.',
      ms: pii.ms,
      http: pii.status,
    });
  }
  return { checks, info: connectInfo(cfg, origin) };
}

const STEPS = [
  ['settings', 'Settings'],
  ['reach', 'Reach the host'],
  ['auth', 'Key accepted'],
  ['chat', 'Chat completion'],
  ['governance', 'LayerOne details in the response'],
  ['policy', 'A policy is enforced'],
];
const STEP_NAME = Object.fromEntries(STEPS);
const short = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);

// One request from the request builder. Only paths on the LayerOne host are allowed.
export async function sendCustom(input, cfg, { origin, fetchFn }) {
  const base = baseOf(cfg, origin);
  if (!base) return { status: 400, error: 'No LayerOne URL is set. Add it in Settings.' };
  const method = String(input.method || 'POST').toUpperCase();
  if (!['GET', 'POST'].includes(method)) return { status: 400, error: 'Method must be GET or POST' };
  const path = String(input.path || cfg.chatPath);
  if (!/^\/[\w\-./~%?=&:,+@]*$/.test(path) || path.includes('..') || path.startsWith('//')) return { status: 400, error: 'Path must start with / and stay on the LayerOne host' };
  const body = method === 'POST' ? String(input.body ?? '') : undefined;
  if (body && body.length > MAX_BODY) return { status: 400, error: `Body is larger than ${MAX_BODY.toLocaleString('en-US')} characters` };

  const extra = Object.fromEntries(
    Object.entries(input.headers && typeof input.headers === 'object' ? input.headers : {})
      .filter(([k, v]) => /^[\w-]{1,64}$/.test(k) && typeof v === 'string' && v.length <= 2000)
      .slice(0, 20),
  );
  // Headers typed in the request (or curl) replace the defaults, whatever their case.
  const headers = headersFor(cfg, { withKey: input.useKey !== false, json: method === 'POST' });
  for (const [k, v] of Object.entries(extra)) {
    for (const d of Object.keys(headers)) if (d.toLowerCase() === k.toLowerCase()) delete headers[d];
    headers[k] = v;
  }
  const url = joinUrl(base, path);
  const r = await call(fetchFn, url, { method, headers, body });
  const request = { method, url, headers: redactHeaders(headers, cfg.authHeader), body: body ?? null };
  if (!r.ok) return { status: 200, result: { request, error: r.error, ms: r.ms } };
  const gov = extractGovernance({ status: r.status, headers: r.headers, body: r.body });
  return {
    status: 200,
    result: {
      request,
      response: { status: r.status, statusText: r.statusText, headers: r.headers, body: r.text.length > MAX_RESPONSE ? `${r.text.slice(0, MAX_RESPONSE)}\n… [truncated]` : r.text },
      ms: r.ms,
      governance: { decision: gov.decision, inferred: gov.inferred, evidenceId: gov.evidenceId, headers: gov.headers },
    },
  };
}
