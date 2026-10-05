// SIMULATED LayerOne gateway for rehearsals and offline demos.
// It is NOT Booz Allen's product: it imitates the shape of a governance
// gateway (input policies, output validation, tamper-evident evidence chain)
// so the console can be exercised end to end without preview credentials.
import crypto from 'node:crypto';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (min, max) => Math.round(min + Math.random() * (max - min));

const POLICY_VERSION = 'sim-2026.10';
let prevRecordHash = '0'.repeat(64);

const PII_PATTERNS = [
  { kind: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'EMAIL', re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { kind: 'CARD', re: /\b(?:\d[ -]?){15,16}\b/g },
];
const INJECTION = /\b(ignore|disregard|forget)\b.{0,40}\b(previous|prior|above|all)\b.{0,40}\b(instructions?|rules?|prompts?)\b|reveal (your|the) system prompt/i;
const MARKING = /\b(TOP SECRET|SECRET|CONFIDENTIAL)\s*\/\/|\b(NOFORN|TS\/\/SCI|ORCON)\b/;

function inputPolicies(text) {
  const policies = [];
  let sanitized = text;

  const injected = INJECTION.test(text);
  policies.push({
    id: 'L1-IN-001',
    name: 'Prompt injection defense',
    stage: 'input',
    result: injected ? 'block' : 'pass',
    detail: injected ? 'Instruction-override pattern detected in user content' : 'No override patterns found',
  });

  const marked = MARKING.test(text);
  policies.push({
    id: 'L1-IN-002',
    name: 'Classification marking / spillage control',
    stage: 'input',
    result: marked ? 'block' : 'pass',
    detail: marked ? 'Classification marking present; destination model not accredited for this level' : 'No markings found',
  });

  const found = [];
  for (const { kind, re } of PII_PATTERNS) {
    sanitized = sanitized.replace(re, () => {
      found.push(kind);
      return `[REDACTED-${kind}]`;
    });
  }
  policies.push({
    id: 'L1-IN-003',
    name: 'PII detection & redaction',
    stage: 'input',
    result: found.length ? 'redact' : 'pass',
    detail: found.length ? `Redacted ${found.length} item(s): ${[...new Set(found)].join(', ')}` : 'No PII found',
  });

  return { policies, sanitized };
}

function simulatedModel(prompt) {
  if (/logistic|port|supply|supplies/i.test(prompt)) {
    return [
      '- **Storm-surge closures:** port operations may halt 24–72 hours, creating vessel queues and berth backlogs.',
      '- **Inland transport disruption:** flooded roads and rail cut the onward link from quay to distribution sites.',
      '- **Fuel & power shortages:** cranes, reefers and trucks compete for limited fuel and generator capacity.',
      '- **Labor & safety constraints:** evacuations reduce available crews; pre-positioning stock is the main mitigation.',
    ].join('\n');
  }
  if (/email/i.test(prompt)) {
    return [
      'Subject: Case 4471 – Status Update',
      '',
      'Team,',
      '',
      'Quick update on case 4471: the review is on track and the next milestone is scheduled for this week.',
      'Please direct questions to the point of contact ([REDACTED-EMAIL]). Identifying details have been withheld per data-handling policy.',
      '',
      'Thanks,',
      'Program Office',
    ].join('\n');
  }
  return `Simulated model response to: "${prompt.slice(0, 120)}"`;
}

function outputPolicies(output) {
  const leaked = PII_PATTERNS.some(({ re }) => new RegExp(re.source).test(output));
  return [
    {
      id: 'L1-OUT-001',
      name: 'Output PII leakage check',
      stage: 'output',
      result: leaked ? 'block' : 'pass',
      detail: leaked ? 'Model output contains PII' : 'No PII in model output',
    },
    {
      id: 'L1-OUT-002',
      name: 'Response schema & safety validation',
      stage: 'output',
      result: 'pass',
      detail: 'Output conforms to expected format',
    },
  ];
}

function sealRecord(fields) {
  const record = { ...fields, prev_record_hash: prevRecordHash };
  record.record_hash = sha256(JSON.stringify(record));
  prevRecordHash = record.record_hash;
  return record;
}

export async function handleMockChat(req, res, rawBody) {
  const started = Date.now();
  const requestId = `l1req_${crypto.randomBytes(6).toString('hex')}`;
  const evidenceId = `ev_${crypto.randomBytes(8).toString('hex')}`;

  let body;
  try {
    body = JSON.parse(rawBody || '{}');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: { type: 'invalid_request', message: 'Body must be JSON' } }));
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const userText = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
  const { policies, sanitized } = inputPolicies(userText);
  await sleep(jitter(120, 300)); // policy evaluation

  const blocked = policies.find((p) => p.result === 'block');
  const baseRecord = {
    evidence_id: evidenceId,
    request_id: requestId,
    client_request_id: req.headers['x-request-id'] || null,
    timestamp: new Date().toISOString(),
    agent: req.headers['x-demo-client'] || 'unknown-agent',
    model: body.model,
    provider: 'simulated-provider',
    policy_version: POLICY_VERSION,
    prompt_sha256: sha256(userText),
  };

  if (blocked) {
    const record = sealRecord({ ...baseRecord, decision: 'blocked', output_sha256: null, policies });
    res.writeHead(403, {
      'Content-Type': 'application/json',
      'X-LayerOne-Request-Id': requestId,
      'X-LayerOne-Evidence-Id': evidenceId,
      'X-LayerOne-Decision': 'blocked',
      'X-LayerOne-Policy-Version': POLICY_VERSION,
      'X-LayerOne-Gateway-Ms': String(Date.now() - started),
    });
    return res.end(
      JSON.stringify({
        error: {
          type: 'policy_violation',
          code: blocked.id,
          message: `Request blocked by LayerOne policy ${blocked.id} (${blocked.name}). The model was not called.`,
        },
        layerone: { simulated: true, decision: 'blocked', evidence_id: evidenceId, request_id: requestId, policies, record },
      }),
    );
  }

  await sleep(jitter(450, 1100)); // upstream model latency
  const output = simulatedModel(sanitized);
  const allPolicies = [...policies, ...outputPolicies(output)];
  const decision = allPolicies.some((p) => p.result === 'redact') ? 'redacted' : 'allowed';
  const record = sealRecord({ ...baseRecord, decision, output_sha256: sha256(output), policies: allPolicies });

  const promptTokens = Math.ceil(JSON.stringify(messages).length / 4);
  const completionTokens = Math.ceil(output.length / 4);
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'X-LayerOne-Request-Id': requestId,
    'X-LayerOne-Evidence-Id': evidenceId,
    'X-LayerOne-Decision': decision,
    'X-LayerOne-Policy-Version': POLICY_VERSION,
    'X-LayerOne-Gateway-Ms': String(Date.now() - started),
  });
  res.end(
    JSON.stringify({
      id: `chatcmpl-${crypto.randomBytes(6).toString('hex')}`,
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
        policies: allPolicies,
        record,
      },
    }),
  );
}
