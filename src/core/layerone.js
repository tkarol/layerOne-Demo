// LayerOne adapter. Everything that depends on the gateway's wire format lives
// here, so if your LayerOne deployment exposes a different request/response
// schema, this is the only file to change.
import { endpointUrl, DRY_RUN_KEY } from './config.js';

const OPENAI_FIELDS = new Set(['id', 'object', 'created', 'model', 'choices', 'usage', 'system_fingerprint', 'service_tier']);
const GOVERNANCE_HEADER = /^x-(layerone|vellox|l1|governance|policy|evidence|guardrail)/i;
const SENSITIVE_HEADER = /(authorization|api[-_]?key|token|secret|cookie)/i;

export function buildRequest({ prompt, traceId, origin }, cfg) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Request-Id': traceId,
    'X-Demo-Client': 'claims-assistant-web-app',
    ...cfg.extraHeaders,
  };
  // Dry run only: tell the built-in stand-ins how slowly to work. Never sent to LayerOne.
  if (cfg.mode === 'mock') headers['X-Demo-Pace'] = cfg.pace || 'normal';
  const key = cfg.mode === 'mock' ? DRY_RUN_KEY : cfg.apiKey;
  if (key) headers[cfg.authHeader] = cfg.authScheme ? `${cfg.authScheme} ${key}` : key;
  return {
    method: 'POST',
    url: endpointUrl(cfg, origin),
    headers,
    body: {
      model: cfg.model,
      messages: [
        { role: 'system', content: cfg.systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
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

  return {
    decision: String(decision).toLowerCase(),
    upstream,
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
