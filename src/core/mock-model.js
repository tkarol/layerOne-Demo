// SIMULATED AI model endpoint (OpenAI-compatible) that the dry-run LayerOne
// stand-in forwards to. It is also reachable directly at /mock/model/v1/chat/completions.
import { json, jitter, paceFactor, randomHex, sleep } from './util.js';

// Canned answers standing in for a real model. The "record lookup" answer
// deliberately includes PII, as a model with access to a records system might.
export function simulatedModel(prompt) {
  if (/connection test/i.test(prompt)) return 'OK';
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

export async function handleMockModel(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: { message: 'Body must be JSON' } });
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const prompt = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
  await sleep(jitter(1500, 2200) * paceFactor(request.headers.get('x-demo-pace'))); // model "thinking" time
  const content = simulatedModel(prompt);
  const promptTokens = Math.ceil(JSON.stringify(messages).length / 4);
  const completionTokens = Math.ceil(content.length / 4);
  return json(200, {
    id: `chatcmpl-${randomHex(6)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: body.model,
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
  });
}
