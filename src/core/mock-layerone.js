// SIMULATED LayerOne gateway for rehearsals and offline demos ("Dry run").
// It is NOT Booz Allen's product: it imitates the shape of a governance
// gateway (request checks, response checks, tamper-evident evidence chain)
// so the demo can be exercised end to end without preview credentials.
import { mockJudgeUrl, mockModelUrl } from './config.js';
import { json, jitter, paceFactor, randomHex, sha256, sleep } from './util.js';

const POLICY_VERSION = 'sim-2026.10';

// Request limits this simulated gateway enforces (a real LayerOne sets these per app/policy).
const INPUT_TOKEN_LIMIT = 8000;
const OUTPUT_TOKEN_LIMIT = 4000;
const MODEL_DENYLIST = ['deepseek-r1', 'deepseek-chat', 'qwen-max', 'public-free-llm'];
const estimateTokens = (text) => Math.ceil(text.length / 4);

const PII_PATTERNS = [
  { kind: 'CARD', label: 'card number', re: /\b(?:\d{4}[ -]){3}\d{4}\b/g },
  { kind: 'ACCOUNT', label: 'account number', re: /(?<=\b(?:account|acct)(?:\s*(?:number|no\.?|#))?(?:\s+is)?\s*[:#]?\s*)\d{8,12}\b/gi },
  { kind: 'SSN', label: 'Social Security number', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'DOB', label: 'date of birth', re: /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(19|20)\d{2}\b/g },
  { kind: 'PHONE', label: 'phone number', re: /(?:\(\d{3}\)\s?|\b\d{3}[-.])\d{3}[-.]\d{4}\b/g },
  { kind: 'EMAIL', label: 'email address', re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
];
const INJECTION = /\b(ignore|disregard|forget)\b.{0,40}\b(previous|prior|above|all)\b.{0,40}\b(instructions?|rules?|prompts?)\b|reveal (your|the) system prompt/i;
const MARKING = /\b(TOP SECRET|SECRET|CONFIDENTIAL)\s*\/\/|\b(NOFORN|TS\/\/SCI|ORCON)\b/;
const BULK_PII = /\b(all|every|each|list|export|dump|download)\b.{0,60}\b(ssns?|social security( numbers?)?)\b/i;

// Replace every PII match with a [REDACTED-KIND] token and describe what was removed.
function redactPii(text) {
  const found = [];
  let out = text;
  for (const { kind, label, re } of PII_PATTERNS) {
    out = out.replace(re, () => {
      found.push(label);
      return `[REDACTED-${kind}]`;
    });
  }
  const counts = {};
  for (const l of found) counts[l] = (counts[l] || 0) + 1;
  const summary = Object.entries(counts)
    .map(([l, n]) => (n > 1 ? `${n} ${l}s` : `1 ${l}`))
    .join(', ');
  return { text: out, count: found.length, summary };
}

function requestPolicies(text, body) {
  const policies = [];

  const model = String(body.model || '').toLowerCase();
  const denied = MODEL_DENYLIST.includes(model);
  policies.push({
    id: 'L1-IN-005',
    name: 'Approved AI models only',
    stage: 'input',
    result: denied ? 'block' : 'pass',
    detail: denied ? `"${body.model}" is on the model denylist; it is not approved for this organization's data` : `"${body.model}" is an approved model`,
  });

  const tokens = estimateTokens(JSON.stringify(body.messages || []));
  const maxOut = Number(body.max_tokens) || 0;
  const tooBig = tokens > INPUT_TOKEN_LIMIT || maxOut > OUTPUT_TOKEN_LIMIT;
  policies.push({
    id: 'L1-IN-006',
    name: 'Token limit',
    stage: 'input',
    result: tooBig ? 'block' : 'pass',
    detail: tooBig
      ? tokens > INPUT_TOKEN_LIMIT
        ? `Request is about ${tokens.toLocaleString('en-US')} tokens; the limit for this app is ${INPUT_TOKEN_LIMIT.toLocaleString('en-US')}`
        : `Asked for up to ${maxOut.toLocaleString('en-US')} output tokens; the limit is ${OUTPUT_TOKEN_LIMIT.toLocaleString('en-US')}`
      : `About ${tokens.toLocaleString('en-US')} tokens, within the ${INPUT_TOKEN_LIMIT.toLocaleString('en-US')}-token limit`,
    tokens,
  });

  const bulk = BULK_PII.test(text);
  policies.push({
    id: 'L1-IN-004',
    name: 'Bulk personal-data requests',
    stage: 'input',
    result: bulk ? 'block' : 'pass',
    detail: bulk ? 'Asked for Social Security numbers in bulk' : 'No bulk data requests',
  });

  const pii = redactPii(text);
  policies.push({
    id: 'L1-IN-003',
    name: 'Personal information in the request',
    stage: 'input',
    result: pii.count ? 'redact' : 'pass',
    detail: pii.count ? `Removed ${pii.summary}` : 'No personal information found',
  });

  const injected = INJECTION.test(text);
  policies.push({
    id: 'L1-IN-001',
    name: 'Attempts to trick the AI',
    stage: 'input',
    result: injected ? 'block' : 'pass',
    detail: injected ? 'Tried to override the AI’s instructions' : 'No trick attempts found',
  });

  const marked = MARKING.test(text);
  policies.push({
    id: 'L1-IN-002',
    name: 'Classified information',
    stage: 'input',
    result: marked ? 'block' : 'pass',
    detail: marked ? 'Classification marking found; this AI model is not approved for classified data' : 'No classification markings',
  });

  return { policies, sanitized: pii.text };
}

function responsePolicies(rawOutput) {
  const pii = redactPii(rawOutput);
  return {
    output: pii.text,
    policies: [
      {
        id: 'L1-OUT-001',
        name: 'Personal information in the answer',
        stage: 'output',
        result: pii.count ? 'redact' : 'pass',
        detail: pii.count ? `Removed ${pii.summary} from the AI’s answer` : 'No personal information in the answer',
      },
      {
        id: 'L1-OUT-002',
        name: 'Answer is safe and well-formed',
        stage: 'output',
        result: 'pass',
        detail: 'The answer passed format and safety checks',
      },
    ],
  };
}

// Each record includes the hash of the previous one, so tampering breaks the chain.
async function sealRecord(fields, storage) {
  const prev = (await storage.getChainHead()) || '0'.repeat(64);
  const record = { ...fields, prev_record_hash: prev };
  record.record_hash = await sha256(JSON.stringify(record));
  await storage.setChainHead(record.record_hash);
  return record;
}

export async function handleMockChat(request, { origin, fetchFn, storage }) {
  const started = Date.now();
  const pace = request.headers.get('x-demo-pace') || 'normal';
  const wait = (min, max) => sleep(jitter(min, max) * paceFactor(pace));
  const requestId = `l1req_${randomHex(6)}`;
  const evidenceId = `ev_${randomHex(8)}`;

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: { type: 'invalid_request', message: 'Body must be JSON' } });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const userText = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
  const { policies, sanitized } = requestPolicies(userText, body);
  await wait(700, 1000); // request checks

  const blocked = policies.find((p) => p.result === 'block');
  const baseRecord = {
    evidence_id: evidenceId,
    request_id: requestId,
    client_request_id: request.headers.get('x-request-id'),
    timestamp: new Date().toISOString(),
    client_app: request.headers.get('x-demo-client') || 'unknown-app',
    model: body.model,
    provider: 'simulated-provider',
    policy_version: POLICY_VERSION,
    prompt_sha256: await sha256(userText),
  };
  const upstreamUrl = mockModelUrl(origin);

  if (blocked) {
    const record = await sealRecord({ ...baseRecord, decision: 'blocked', upstream_url: null, output_sha256: null, policies }, storage);
    return json(
      403,
      {
        error: {
          type: 'policy_violation',
          code: blocked.id,
          message: `Blocked by LayerOne rule ${blocked.id} (${blocked.name}): ${blocked.detail}. The AI model was not called.`,
        },
        layerone: {
          simulated: true,
          decision: 'blocked',
          evidence_id: evidenceId,
          request_id: requestId,
          upstream: { method: 'POST', url: upstreamUrl, provider: 'Simulated AI model', model: body.model, called: false },
          policies,
          record,
        },
      },
      {
        'X-LayerOne-Request-Id': requestId,
        'X-LayerOne-Evidence-Id': evidenceId,
        'X-LayerOne-Decision': 'blocked',
        'X-LayerOne-Policy-Version': POLICY_VERSION,
        'X-LayerOne-Gateway-Ms': String(Date.now() - started),
      },
    );
  }

  // Forward the cleaned request to the AI model, exactly as a gateway would.
  const upstreamStarted = Date.now();
  let upstreamRes, upstreamBody;
  try {
    upstreamRes = await fetchFn(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Demo-Pace': pace },
      body: JSON.stringify({ ...body, messages: messages.map((m) => (m.role === 'user' ? { ...m, content: sanitized } : m)) }),
    });
    upstreamBody = await upstreamRes.json();
  } catch (err) {
    return json(502, { error: { type: 'upstream_error', message: `AI model unreachable: ${err.message}` } });
  }
  const upstream = {
    method: 'POST',
    url: upstreamUrl,
    provider: 'Simulated AI model',
    model: body.model,
    status: upstreamRes.status,
    latency_ms: Date.now() - upstreamStarted,
  };
  const checked = responsePolicies(upstreamBody.choices?.[0]?.message?.content ?? '');
  await wait(500, 800); // response checks

  // LLM judge: a second model grades the answer before it is released.
  const judgeUrl = mockJudgeUrl(origin);
  const judgeStarted = Date.now();
  let judge;
  try {
    const jr = await fetchFn(judgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Demo-Pace': pace },
      body: JSON.stringify({ model: 'judge-model', question: sanitized, answer: checked.output }),
    });
    judge = { method: 'POST', url: judgeUrl, ...(await jr.json()), status: jr.status, latency_ms: Date.now() - judgeStarted };
  } catch (err) {
    judge = { method: 'POST', url: judgeUrl, verdict: 'error', rationale: `Judge unavailable: ${err.message}` };
  }
  const held = judge.verdict === 'fail';
  checked.policies.push({
    id: 'L1-OUT-003',
    name: 'LLM judge: accurate and compliant',
    stage: 'output',
    result: held ? 'hold' : 'pass',
    detail: judge.score != null ? `Judge score ${judge.score}/10: ${judge.rationale}` : judge.rationale,
  });

  const output = held ? `This answer was held for review by LayerOne before it reached you. ${judge.rationale}` : checked.output;
  const allPolicies = [...policies, ...checked.policies];
  const decision = held ? 'held' : allPolicies.some((p) => p.result === 'redact') ? 'redacted' : 'allowed';
  const record = await sealRecord(
    { ...baseRecord, decision, upstream_url: upstream.url, output_sha256: await sha256(output), policies: allPolicies },
    storage,
  );

  const promptTokens = Math.ceil(JSON.stringify(messages).length / 4);
  const completionTokens = upstreamBody.usage?.completion_tokens ?? Math.ceil(output.length / 4);
  return json(
    200,
    {
      id: `chatcmpl-${randomHex(6)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model,
      choices: [{ index: 0, message: { role: 'assistant', content: output }, finish_reason: 'stop' }],
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
      layerone: {
        simulated: true,
        decision,
        evidence_id: evidenceId,
        request_id: requestId,
        sanitized_prompt: sanitized !== userText ? sanitized : undefined,
        upstream,
        judge,
        withheld_preview: held ? checked.output.slice(0, 600) : undefined,
        policies: allPolicies,
        record,
      },
    },
    {
      'X-LayerOne-Request-Id': requestId,
      'X-LayerOne-Evidence-Id': evidenceId,
      'X-LayerOne-Decision': decision,
      'X-LayerOne-Policy-Version': POLICY_VERSION,
      'X-LayerOne-Upstream-Url': upstream.url,
      'X-LayerOne-Upstream-Provider': upstream.provider,
      'X-LayerOne-Judge-Url': judgeUrl,
      'X-LayerOne-Gateway-Ms': String(Date.now() - started),
    },
  );
}
