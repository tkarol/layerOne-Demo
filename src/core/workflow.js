// Runs one demo request end to end and records each hop as a trace step.
import { endpointUrl, configuredUpstream } from './config.js';
import { byteLength, now, randomHex } from './util.js';
import { buildRequest, buildDirectRequest, redactHeaders, send, parseBody, extractGovernance, extractOutput, describeFetchError } from './layerone.js';

const STEPS = [
  { key: 'client', label: 'User submits the request', actor: 'User → Web Application' },
  { key: 'prepare', label: 'Web application builds the AI request', actor: 'Web Application' },
  { key: 'outbound', label: 'Request sent to LayerOne', actor: 'Web Application → LayerOne' },
  { key: 'gateway', label: 'LayerOne checks the request, calls the AI model, checks the answer', actor: 'LayerOne ⇄ AI Model' },
  { key: 'inbound', label: 'Response received from LayerOne', actor: 'LayerOne → Web Application' },
  { key: 'validate', label: 'Audit record captured', actor: 'Web Application' },
  { key: 'deliver', label: 'Answer shown to the user', actor: 'Web Application → User' },
];

// Step labels when LayerOne is switched off (sample apps): the app calls the model directly.
const BYPASS_STEPS = {
  outbound: { label: 'Request sent directly to the AI model (LayerOne switched off)', actor: 'Web Application → AI Model' },
  gateway: { label: 'AI model answers. Nothing is checked or removed', actor: 'AI Model' },
  inbound: { label: 'Response received from the AI model', actor: 'AI Model → Web Application' },
  validate: { label: 'No audit record (LayerOne switched off)', actor: 'Web Application' },
};

// Very long inputs (e.g. a 120-page file) are kept in full for the request but
// shortened in the stored trace.
const CLIP = 6000;
const clip = (s) => (typeof s === 'string' && s.length > CLIP ? `${s.slice(0, CLIP)}\n\n… [${(s.length - CLIP).toLocaleString('en-US')} more characters not shown]` : s);
const clipBody = (body) => ({ ...body, messages: body.messages?.map((m) => ({ ...m, content: clip(m.content) })) });

/**
 * input: { prompt, scenario, app?, workflow?, protected?, system?, model?, maxTokens? }
 * `protected: false` sends the request straight to the AI model, skipping LayerOne.
 */
export function createTrace(input, cfg, origin) {
  const bypass = input.protected === false;
  const direct = bypass ? buildDirectRequest({ ...input, traceId: '', origin }, cfg) : null;
  return {
    id: `trc_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}_${randomHex(3)}`,
    createdAt: new Date().toISOString(),
    status: 'running',
    mode: cfg.mode,
    scenario: input.scenario || 'custom',
    app: input.app || null,
    workflow: input.workflow || null,
    protected: !bypass,
    bypass,
    prompt: clip(input.prompt),
    promptChars: input.prompt.length,
    endpoint: { method: 'POST', url: bypass ? direct.url : endpointUrl(cfg, origin) },
    upstream: bypass ? null : configuredUpstream(cfg, origin),
    steps: STEPS.map((s) => ({ ...s, ...(bypass ? BYPASS_STEPS[s.key] : {}), status: 'pending', startedAt: null, durationMs: null, detail: null })),
    request: null,
    response: null,
    governance: null,
    output: null,
    error: null,
    totalMs: null,
  };
}

// `emit(snapshot, final)` receives a copy of the trace after every change.
// `input` is the same object given to createTrace (holds the full prompt).
export async function runWorkflow(trace, { cfg, origin, fetchFn, emit: onUpdate, input = { prompt: trace.prompt } }) {
  const t0 = now();
  const timers = new Map();
  const emit = (final = false) => onUpdate(structuredClone(trace), final);
  const step = (key) => trace.steps.find((s) => s.key === key);

  const start = (key, detail) => {
    const s = step(key);
    Object.assign(s, { status: 'running', startedAt: new Date().toISOString(), detail: detail ?? s.detail });
    timers.set(key, now());
    emit();
  };
  const finish = (key, status = 'done', detail) => {
    const s = step(key);
    s.status = status;
    s.durationMs = Math.round((now() - timers.get(key)) * 10) / 10;
    if (detail !== undefined) s.detail = detail;
    emit();
  };
  const fail = (key, message) => {
    finish(key, 'error', message);
    for (const s of trace.steps) if (s.status === 'pending') s.status = 'skipped';
    Object.assign(trace, { status: 'error', error: message, totalMs: Math.round(now() - t0) });
    emit(true);
  };

  start('client');
  const chars = `${trace.promptChars.toLocaleString('en-US')} chars`;
  finish('client', 'done', trace.app ? `Sample app: ${trace.app} · ${trace.workflow}${trace.bypass ? ' · LayerOne OFF' : ''} · ${chars}` : `Scenario: ${trace.scenario} · ${chars}`);

  start('prepare');
  if (!trace.bypass && cfg.mode !== 'mock' && !cfg.baseUrl) {
    return fail('prepare', 'No LayerOne URL is set for Live mode. Add it in Settings, or switch to Dry run.');
  }
  const reqInput = { ...input, traceId: trace.id, origin };
  const req = trace.bypass ? buildDirectRequest(reqInput, cfg) : buildRequest(reqInput, cfg);
  trace.request = { method: req.method, url: req.url, headers: redactHeaders(req.headers, req.authHeader || cfg.authHeader), body: clipBody(req.body) };
  trace.promptTokens = Math.ceil(JSON.stringify(req.body.messages).length / 4);
  if (trace.bypass) Object.assign(trace, { simulatedModel: req.simulated, bypassNote: req.note });
  finish('prepare', 'done', `OpenAI-compatible chat payload · model "${req.body.model}" · about ${trace.promptTokens.toLocaleString('en-US')} tokens`);

  start('outbound', `${req.method} ${req.url}`);
  const pending = send(req, cfg.timeoutMs, fetchFn);
  finish('outbound');

  const target = trace.bypass ? 'the AI model' : 'LayerOne';
  start('gateway', `Waiting for ${target}…`);
  let res;
  try {
    res = await pending;
  } catch (err) {
    const reason = describeFetchError(err, cfg.timeoutMs);
    return fail('gateway', `Could not reach ${target}: ${reason}`);
  }
  finish('gateway', res.ok ? 'done' : 'warn', `HTTP ${res.status} ${res.statusText}`);
  const gatewayStep = step('gateway');

  start('inbound');
  let text;
  try {
    text = await res.text();
  } catch (err) {
    return fail('inbound', `Failed reading response body: ${err.message}`);
  }
  const headers = Object.fromEntries(res.headers.entries());
  const body = parseBody(text);
  trace.response = {
    status: res.status,
    statusText: res.statusText,
    latencyMs: Math.round(step('gateway').durationMs), // time to response headers from LayerOne
    headers,
    body,
    bytes: byteLength(text),
  };
  finish('inbound', 'done', `${trace.response.bytes} bytes · ${headers['content-type'] || 'unknown type'}`);

  start('validate');
  if (trace.bypass) {
    trace.governance = { decision: 'unprotected', inferred: false, evidenceId: null, gatewayRequestId: null, policies: [], record: null, headers: {}, extensions: {}, upstream: null };
    finish('validate', 'warn', 'LayerOne was switched off: nothing was checked, removed or recorded');
    start('deliver');
    trace.output = extractOutput(body);
    trace.usage = body?.usage || null;
    trace.totalMs = Math.round(now() - t0);
    trace.status = res.ok ? 'completed' : 'error';
    if (!res.ok) trace.error = `The AI model returned HTTP ${res.status}`;
    finish('deliver', 'done', `End-to-end ${trace.totalMs} ms`);
    return emit(true);
  }
  const gov = extractGovernance({ status: res.status, headers, body });
  trace.governance = gov;
  if (gov.upstream) {
    trace.upstream = { ...gov.upstream, source: 'reported' };
    if (gov.upstream.called) gatewayStep.detail += ` · LayerOne forwarded to ${gov.upstream.method} ${gov.upstream.url}`;
  } else if (trace.upstream) {
    trace.upstream = { ...trace.upstream, called: gov.decision !== 'blocked' };
  }
  const evidence = gov.evidenceId ? ` · evidence ${gov.evidenceId}` : '';
  if (gov.decision === 'blocked') {
    // The gateway is where the request stopped; mark that hop, not the app.
    gatewayStep.status = 'blocked';
    gatewayStep.detail = `HTTP ${res.status} · blocked by gateway policy`;
  }
  finish(
    'validate',
    gov.decision === 'error' ? 'warn' : 'done',
    `Decision: ${gov.decision}${gov.inferred ? ' (inferred from HTTP status)' : ''}${evidence}`,
  );

  start('deliver');
  trace.output = extractOutput(body);
  trace.totalMs = Math.round(now() - t0);
  trace.usage = body?.usage || null;
  trace.status = gov.decision === 'blocked' ? 'blocked' : res.ok ? 'completed' : 'error';
  if (!res.ok && gov.decision !== 'blocked') trace.error = `LayerOne returned HTTP ${res.status}`;
  finish('deliver', 'done', `End-to-end ${trace.totalMs} ms`);
  emit(true);
}
