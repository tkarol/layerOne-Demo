// LayerOne adapter. Everything that depends on the gateway's wire format lives
// here, so if your LayerOne deployment exposes a different request/response
// schema, this is the only file to change.
import { endpointUrl, mockModelUrl, DRY_RUN_KEY } from './config.js';

const OPENAI_FIELDS = new Set(['id', 'object', 'created', 'model', 'choices', 'usage', 'system_fingerprint', 'service_tier']);
const GOVERNANCE_HEADER = /^x-(layerone|vellox|l1|governance|policy|evidence|guardrail)/i;
const SENSITIVE_HEADER = /(authorization|api[-_]?key|token|secret|cookie)/i;

// `system`, `model` and `maxTokens` let the sample apps send their own request shape.
export function buildRequest({ prompt, traceId, origin, system, model, maxTokens, demoWorkflow }, cfg) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Request-Id': traceId,
    'X-Demo-Client': 'claims-assistant-web-app',
    ...cfg.extraHeaders,
  };
  // Dry run only: tell the built-in stand-ins how slowly to work. Never sent to LayerOne.
  if (cfg.mode === 'mock') {
    headers['X-Demo-Pace'] = cfg.pace || 'normal';
    if (demoWorkflow) headers['X-Demo-Workflow'] = demoWorkflow;
  }
  const key = cfg.mode === 'mock' ? DRY_RUN_KEY : cfg.apiKey;
  if (key) headers[cfg.authHeader] = cfg.authScheme ? `${cfg.authScheme} ${key}` : key;
  return {
    method: 'POST',
    url: endpointUrl(cfg, origin),
    headers,
    body: {
      model: model || cfg.model,
      messages: [
        { role: 'system', content: system || cfg.systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    },
  };
}

// The same request sent straight to an AI model, skipping LayerOne (sample apps,
// LayerOne switched OFF). Uses the direct model from Settings in Live mode when it
// can serve the requested model; otherwise the built-in stand-in model.
export function buildDirectRequest({ prompt, traceId, origin, system, model, maxTokens, demoWorkflow }, cfg) {
  const approved = !model || model === cfg.model;
  const real = cfg.mode === 'live' && cfg.directUrl && approved;
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Request-Id': traceId };
  let note = null;
  if (real) {
    if (cfg.directApiKey) headers[cfg.directAuthHeader] = cfg.directAuthScheme ? `${cfg.directAuthScheme} ${cfg.directApiKey}` : cfg.directApiKey;
  } else {
    headers['X-Demo-Pace'] = cfg.pace || 'normal';
    if (demoWorkflow) headers['X-Demo-Workflow'] = demoWorkflow;
    if (cfg.mode === 'live') {
      note = !cfg.directUrl
        ? 'Simulated: no direct AI model is set in Settings, so the built-in stand-in model answered.'
        : `Simulated: "${model}" is not available at the direct model endpoint, so the built-in stand-in model answered.`;
    }
  }
  return {
    method: 'POST',
    url: real ? cfg.directUrl : mockModelUrl(origin),
    headers,
    simulated: !real,
    note,
    authHeader: real ? cfg.directAuthHeader : 'Authorization',
    body: {
      model: real ? cfg.directModel || model || cfg.model : model || cfg.model,
      messages: [
        { role: 'system', content: system || cfg.systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    },
  };
}

function mask(value) {
  const s = String(value);
  const [scheme, secret] = s.includes(' ') ? [s.slice(0, s.indexOf(' ') + 1), s.slice(s.indexOf(' ') + 1)] : ['', s];
  if (secret.length <= 8) return `${scheme}••••••••`;
  return `${scheme}${secret.slice(0, 4)}••••••••${secret.slice(-4)}`;
}

export function redactHeaders(headers, authHeader = 'Authorization') {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) =>
      SENSITIVE_HEADER.test(k) || k.toLowerCase() === authHeader.toLowerCase() ? [k, mask(v)] : [k, v],
    ),
  );
}

// `fetchFn` routes dry-run calls to the built-in stand-ins and everything else to the network.
export async function send(req, timeoutMs, fetchFn = fetch) {
  return fetchFn(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

// Plain-English reason for a failed fetch (Node and Cloudflare word these differently).
export function describeFetchError(err, timeoutMs) {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return `No response within ${timeoutMs} ms`;
  const msg = String(err?.cause?.message || err?.message || err);
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo|internal error|DNS/i.test(msg)) return `The host could not be reached (DNS lookup or connection failed)`;
  if (/ECONNREFUSED/i.test(msg)) return 'The connection was refused (nothing is listening at that address)';
  if (/certificate|SSL|TLS/i.test(msg)) return `TLS/certificate problem: ${msg}`;
  return msg;
}

export function parseBody(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Pull out whatever governance evidence the gateway returned: dedicated
// headers, a `layerone`/`governance` object in the body, or any non-standard
// top-level fields. Falls back to inferring the decision from the HTTP status.
export function extractGovernance({ status, headers, body }) {
  const obj = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const l1 = obj.layerone || obj.governance || obj.vellox || obj.error?.layerone || {};
  const govHeaders = Object.fromEntries(Object.entries(headers).filter(([k]) => GOVERNANCE_HEADER.test(k)));
  const extensions = Object.fromEntries(Object.entries(obj).filter(([k]) => !OPENAI_FIELDS.has(k)));

  const reported = headers['x-layerone-decision'] || l1.decision;
  let decision = reported;
  if (!decision) {
    if (status >= 200 && status < 300) decision = 'allowed';
    else if ([403, 422, 451].includes(status)) decision = 'blocked';
    else decision = 'error';
  }

  // Where LayerOne sent the request: from a body object or headers, if reported.
  const up = l1.upstream || l1.route || l1.target || {};
  const upstreamUrl = up.url || up.endpoint || headers['x-layerone-upstream-url'] || headers['x-layerone-upstream'] || null;
  const upstream = upstreamUrl
    ? {
        method: up.method || 'POST',
        url: upstreamUrl,
        provider: up.provider || headers['x-layerone-upstream-provider'] || headers['x-layerone-provider'] || null,
        model: up.model || headers['x-layerone-upstream-model'] || null,
        status: up.status ?? null,
        latencyMs: up.latency_ms ?? up.latencyMs ?? null,
        called: up.called !== false,
      }
    : null;

  // LLM judge result, if the gateway reports one.
  const j = l1.judge || l1.evaluation || null;
  const judge = j
    ? { url: j.url || headers['x-layerone-judge-url'] || null, model: j.model || null, score: j.score ?? null, verdict: j.verdict || null, rationale: j.rationale || j.reason || null, latencyMs: j.latency_ms ?? null }
    : null;

  return {
    decision: String(decision).toLowerCase(),
    upstream,
    judge,
    withheldPreview: l1.withheld_preview || null,
    inferred: !reported,
    evidenceId: headers['x-layerone-evidence-id'] || l1.evidence_id || l1.evidenceId || null,
    gatewayRequestId: headers['x-layerone-request-id'] || l1.request_id || null,
    policies: Array.isArray(l1.policies) ? l1.policies : [],
    record: l1.record || null,
    headers: govHeaders,
    extensions,
  };
}

export function extractOutput(body) {
  if (typeof body === 'string') return body;
  return (
    body?.choices?.[0]?.message?.content ??
    body?.output_text ??
    body?.content?.[0]?.text ??
    body?.error?.message ??
    body?.message ??
    null
  );
}
