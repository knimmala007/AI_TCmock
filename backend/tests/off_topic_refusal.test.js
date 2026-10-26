// Polite off-topic refusal (030a) at the handler seam: a scripted fake model, memory storage, no network.
// The fake model returns whatever is scripted, so these tests prove plumbing only: a decline passes through
// unchanged, no tool runs on it, and the thread stores it. Whether a real model declines is the prompt's job
// and is checked by the manual run (028a). Tests never assert on prompt wording.
import test from 'node:test';
import assert from 'node:assert';
import { memoryKv } from '../kv.js';
import { createDailyCap, createRateLimiter } from '../limits.js';
import { createEventLog, memoryEventStore } from '../events.js';
import { createThreadStore } from '../threads.js';
import { cookieName, sessionFromRequest, signSession } from '../session.js';
import { createAgentHandler } from '../agent_handler.js';
import { looksLikeLegalAdvice } from '../legal_guard.js';
import { STUB_TEXT, stubRegistry } from './stub_tool.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const env = {};
const DEAL = 'TX-CG118';
const ROLES = ['broker', 'seller', 'buyer', 'lender'];
const usage = { input_tokens: 1, output_tokens: 1 };
const ok = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage });
const toolUse = { content: [{ type: 'tool_use', id: 't1', name: 'stub_ping', input: {} }], stop_reason: 'tool_use', usage };

const DECLINE = 'I can only help with this deal. Would you like to continue with the disclosures?';

function setup(...replies) {
  const kv = memoryKv();
  const threads = createThreadStore(kv);
  const requests = [];
  const callModel = async req => {
    requests.push(structuredClone(req));
    return replies[Math.min(requests.length - 1, replies.length - 1)];
  };
  const registry = stubRegistry();
  let toolRuns = 0;
  const run = registry.stub_ping.run;
  registry.stub_ping.run = args => { toolRuns += 1; return run(args); };
  const handler = createAgentHandler({
    callModel,
    getSession: r => sessionFromRequest(r, env),
    limiter: createRateLimiter(kv),
    dailyCap: createDailyCap(kv, { cap: 100 }),
    eventLog: createEventLog(memoryEventStore()),
    threads,
    registry,
  });
  return { handler, threads, requests, toolRuns: () => toolRuns };
}

const post = (role, message) => new Request('http://x/api/agent', {
  method: 'POST', body: JSON.stringify({ message }),
  headers: { 'content-type': 'application/json', cookie: `${cookieName}=${signSession({ role, sessionId: 's-1', dealId: DEAL }, env)}` },
});

for (const role of ROLES) {
  test(`${role}: an off-topic turn returns the decline unchanged, with no status, calls no tool, and the thread stores it`, async () => {
    const { handler, threads, requests, toolRuns } = setup(ok(DECLINE));
    const res = await handler(post(role, 'What is a good lasagna recipe?'));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.reply, DECLINE);
    assert.ok(!('status' in body));
    assert.deepStrictEqual(Object.keys(body).sort(), ['reply', 'turnId']);
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(toolRuns(), 0);
    assert.deepStrictEqual(await threads.recent({ dealId: DEAL, sessionId: 's-1', role }), [
      { role: 'user', content: 'What is a good lasagna recipe?' },
      { role: 'assistant', content: DECLINE },
    ]);
  });
}

test('a typical decline sentence does not trip the legal-advice guard', () => {
  assert.strictEqual(looksLikeLegalAdvice(DECLINE), false);
});

test('an ordinary deal question is unaffected: the tool runs, the answer is returned and stored', async () => {
  const { handler, threads, requests, toolRuns } = setup(toolUse, ok('The disclosures are still open.'));
  const res = await handler(post('broker', 'What is still open on the disclosures?'));
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.reply, 'The disclosures are still open.');
  assert.ok(!('status' in body));
  assert.strictEqual(requests.length, 2);
  assert.strictEqual(toolRuns(), 1);
  assert.ok(JSON.stringify(requests[1].messages).includes(STUB_TEXT));
  assert.deepStrictEqual(await threads.recent({ dealId: DEAL, sessionId: 's-1', role: 'broker' }), [
    { role: 'user', content: 'What is still open on the disclosures?' },
    { role: 'assistant', content: 'The disclosures are still open.' },
  ]);
});
