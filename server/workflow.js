// Runs one demo request end to end and records each hop as a trace step.
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { config, endpointUrl } from './config.js';
import { buildRequest, redactHeaders, send, parseBody, extractGovernance, extractOutput } from './layerone.js';

const STEPS = [
  { key: 'client', label: 'User submits the request', actor: 'User → Web Application' },
  { key: 'prepare', label: 'Web application builds the AI request', actor: 'Web Application' },
  { key: 'outbound', label: 'Request sent to LayerOne', actor: 'Web Application → LayerOne' },
  { key: 'gateway', label: 'LayerOne checks the request, calls the AI model, checks the answer', actor: 'LayerOne ⇄ AI Model' },
  { key: 'inbound', label: 'Response received from LayerOne', actor: 'LayerOne → Web Application' },
  { key: 'validate', label: 'Audit record captured', actor: 'Web Application' },
  { key: 'deliver', label: 'Answer shown to the user', actor: 'Web Application → User' },
];

export function createTrace({ prompt, scenario }) {
  return {
    id: `trc_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}_${crypto.randomBytes(3).toString('hex')}`,
    createdAt: new Date().toISOString(),
    status: 'running',
    mode: config.mode,
    scenario: scenario || 'custom',
    prompt,
    endpoint: { method: 'POST', url: endpointUrl() },
    steps: STEPS.map((s) => ({ ...s, status: 'pending', startedAt: null, durationMs: null, detail: null })),
    request: null,
    response: null,
    governance: null,
    output: null,
    error: null,
    totalMs: null,
  };
}

export async function runWorkflow(trace, store) {
  const t0 = performance.now();
  const timers = new Map();
  const emit = (persist = false) => store.update(structuredClone(trace), { persist });
  const step = (key) => trace.steps.find((s) => s.key === key);

  const start = (key, detail) => {
    const s = step(key);
    Object.assign(s, { status: 'running', startedAt: new Date().toISOString(), detail: detail ?? s.detail });
    timers.set(key, performance.now());
    emit();
  };
  const finish = (key, status = 'done', detail) => {
    const s = step(key);
    s.status = status;
    s.durationMs = Math.round((performance.now() - timers.get(key)) * 10) / 10;
    if (detail !== undefined) s.detail = detail;
    emit();
  };
  const fail = (key, message) => {
    finish(key, 'error', message);
    for (const s of trace.steps) if (s.status === 'pending') s.status = 'skipped';
    Object.assign(trace, { status: 'error', error: message, totalMs: Math.round(performance.now() - t0) });
    emit(true);
  };

  start('client');
  finish('client', 'done', `Scenario: ${trace.scenario} · ${trace.prompt.length} chars`);

  start('prepare');
  if (config.mode !== 'mock' && !config.baseUrl) {
    return fail('prepare', 'LAYERONE_BASE_URL is not set. Configure .env or run with LAYERONE_MODE=mock.');
  }
  const req = buildRequest({ prompt: trace.prompt, traceId: trace.id });
  trace.request = { method: req.method, url: req.url, headers: redactHeaders(req.headers), body: req.body };
  finish('prepare', 'done', `OpenAI-compatible chat payload · model "${req.body.model}"`);

  start('outbound', `${req.method} ${req.url}`);
  const pending = send(req);
  finish('outbound');

  start('gateway', 'Waiting for LayerOne…');
  let res;
  try {
    res = await pending;
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? `Timed out after ${config.timeoutMs} ms` : err.cause?.message || err.message;
    return fail('gateway', `Could not reach LayerOne: ${reason}`);
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
    bytes: Buffer.byteLength(text),
  };
  finish('inbound', 'done', `${trace.response.bytes} bytes · ${headers['content-type'] || 'unknown type'}`);

  start('validate');
  const gov = extractGovernance({ status: res.status, headers, body });
  trace.governance = gov;
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
  trace.totalMs = Math.round(performance.now() - t0);
  trace.status = gov.decision === 'blocked' ? 'blocked' : res.ok ? 'completed' : 'error';
  if (!res.ok && gov.decision !== 'blocked') trace.error = `LayerOne returned HTTP ${res.status}`;
  finish('deliver', 'done', `End-to-end ${trace.totalMs} ms`);
  emit(true);
}
