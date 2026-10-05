// SIMULATED LayerOne gateway for rehearsals and offline demos.
// It is NOT Booz Allen's product: it imitates the shape of a governance
// gateway (request checks, response checks, tamper-evident evidence chain)
// so the demo can be exercised end to end without preview credentials.
import crypto from 'node:crypto';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (min, max) => Math.round(min + Math.random() * (max - min));

const POLICY_VERSION = 'sim-2026.10';
let prevRecordHash = '0'.repeat(64);

const PII_PATTERNS = [
  { kind: 'SSN', label: 'Social Security number', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'DOB', label: 'date of birth', re: /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(19|20)\d{2}\b/g },
  { kind: 'PHONE', label: 'phone number', re: /(?:\(\d{3}\)\s?|\b\d{3}[-.])\d{3}[-.]\d{4}\b/g },
  { kind: 'EMAIL', label: 'email address', re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { kind: 'CARD', label: 'card number', re: /\b(?:\d{4}[ -]){3}\d{4}\b/g },
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

function requestPolicies(text) {
  const policies = [];

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

// Canned answers standing in for a real model. The "record lookup" answer
// deliberately includes PII, as a model with access to a records system might.
function simulatedModel(prompt) {
  if (/look ?up|on file|record for|identity/i.test(prompt)) {
    return [
      'Record found for claimant Robert Chen (claim #VA-20419):',
      '',
      '- SSN: 987-65-4321',
      '- Date of birth: 09/30/1975',
      '- Phone on file: (555) 867-5309',
      '- Status: Under review, awaiting medical records',
      '',
      'You can confirm his identity by asking him to verify the details above.',
    ].join('\n');
  }
  if (/status update|approved|claimant/i.test(prompt)) {
    const who = prompt.match(/claimant ([A-Z][a-z]+ [A-Z][a-z]+)/)?.[1] || 'the claimant';
    return [
      `Status update — ${who}`,
      '',
      'The claim has been approved pending one remaining signature on the release form.',
      'Once the signed form is received, payment processing typically begins within 5–7 business days.',
      'Identity details were withheld from this update.',
    ].join('\n');
  }
  if (/claim|benefit|medical|form/i.test(prompt)) {
    return [
      'Next steps for a claim missing a medical records release form:',
      '',
      '1. Send the claimant the release form (VA Form 21-4142) with a 30-day response deadline.',
      '2. Mark the claim as "pending evidence" so the processing clock is paused, not closed.',
      '3. Follow up by phone after 10 business days if no response is received.',
      '4. Once returned, request records from the listed providers and resume review.',
    ].join('\n');
  }
  return `Simulated AI model response to: "${prompt.slice(0, 120)}"`;
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
  const { policies, sanitized } = requestPolicies(userText);
  await sleep(jitter(120, 300)); // policy evaluation

  const blocked = policies.find((p) => p.result === 'block');
  const baseRecord = {
    evidence_id: evidenceId,
    request_id: requestId,
    client_request_id: req.headers['x-request-id'] || null,
    timestamp: new Date().toISOString(),
    client_app: req.headers['x-demo-client'] || 'unknown-app',
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
          message: `Blocked by LayerOne rule ${blocked.id} (${blocked.name}): ${blocked.detail}. The AI model was not called.`,
        },
        layerone: { simulated: true, decision: 'blocked', evidence_id: evidenceId, request_id: requestId, policies, record },
      }),
    );
  }

  await sleep(jitter(450, 1100)); // upstream model latency
  const checked = responsePolicies(simulatedModel(sanitized));
  await sleep(jitter(60, 160)); // response checks
  const output = checked.output;
  const allPolicies = [...policies, ...checked.policies];
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
