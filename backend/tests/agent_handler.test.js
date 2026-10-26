// The chat endpoint at the handler seam: a scripted fake model, memory storage, no network.
import test from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { memoryKv } from '../kv.js';
import { createDailyCap, createRateLimiter } from '../limits.js';
import { createEventLog, memoryEventStore } from '../events.js';
import { createThreadStore } from '../threads.js';
import { cookieName, sessionFromRequest, signSession } from '../session.js';
import { createAgentHandler } from '../agent_handler.js';
import { promptFor } from '../prompts.js';
import { STUB_TOOL, stubRegistry } from './stub_tool.js';
import { createAgentEndpoint } from '../../api/agent.js';
import { THREAD_MESSAGES_KEPT } from '../config.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const env = {};
const DEAL = 'TX-CG118';
const ok = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });

// A scripted fake model: answers in order from `replies` (the last one repeats) and records each request.
function scripted(...replies) {
  const requests = [];
  const callModel = async req => {
    requests.push(structuredClone(req));
    return replies[Math.min(requests.length - 1, replies.length - 1)];
  };
  return { callModel, requests };
}

function setup({ replies = [ok('hello')], perMinute = 100, cap = 100, model = true } = {}) {
  const kv = memoryKv();
  const store = memoryEventStore();
  const threads = createThreadStore(kv);
  const fake = scripted(...replies);
  const handler = createAgentHandler({
    callModel: model ? fake.callModel : undefined,
    getSession: r => sessionFromRequest(r, env),
    limiter: createRateLimiter(kv),
    dailyCap: createDailyCap(kv, { cap }),
    eventLog: createEventLog(store),
    threads,
    perMinute,
    registry: stubRegistry(),
  });
  return { handler, store, threads, requests: fake.requests };
}

const cookieFor = (role, sessionId = 's-1', dealId = DEAL) => `${cookieName}=${signSession({ role, sessionId, dealId }, env)}`;
const post = (cookie, body = { message: 'hi' }, { url = 'http://x/api/agent', headers = {} } = {}) => new Request(url, {
  method: 'POST', body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
});

test('a message gets a plain reply as {reply, turnId}, with the broker prompt and the injected test tool', async () => {
  const { handler, requests } = setup({ replies: [ok('Hello there.')] });
  const res = await handler(post(cookieFor('broker')));
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.deepStrictEqual(Object.keys(body).sort(), ['reply', 'turnId']);
  assert.strictEqual(body.reply, 'Hello there.');
  assert.ok(body.turnId);
  assert.strictEqual(requests.length, 1);
  assert.strictEqual(requests[0].system, promptFor('broker'));
  assert.deepStrictEqual(requests[0].tools, [STUB_TOOL]);
  assert.deepStrictEqual(requests[0].messages, [{ role: 'user', content: 'hi' }]);
});

test('a role (or deal) in the body, query or headers is ignored: the session decides', async () => {
  const { handler, store, threads } = setup();
  const res = await handler(post(cookieFor('seller'),
    { message: 'hi', role: 'broker', dealId: 'tx_unknown_city', transactionId: 'tx_unknown_city', sessionId: 'evil' },
    { url: 'http://x/api/agent?role=broker&deal=tx_unknown_city', headers: { 'x-role': 'broker', 'x-user-role': 'broker' } }));
  assert.strictEqual(res.status, 200);
  for (const row of store.rows) {
    assert.strictEqual(row.role, 'seller');
    assert.strictEqual(row.transaction_id, DEAL);
    assert.strictEqual(row.session_id, 's-1');
  }
  assert.strictEqual((await threads.recent({ dealId: DEAL, sessionId: 's-1', role: 'seller' })).length, 2);
  assert.strictEqual((await threads.recent({ dealId: DEAL, sessionId: 's-1', role: 'broker' })).length, 0);
  assert.strictEqual((await threads.recent({ dealId: 'tx_unknown_city', sessionId: 'evil', role: 'broker' })).length, 0);
});

test('no session returns 401 and the model is not called', async () => {
  const { handler, requests } = setup();
  const res = await handler(post(null, { message: 'hi', role: 'broker' }));
  assert.strictEqual(res.status, 401);
  assert.strictEqual(requests.length, 0);
});

test('a correctly signed cookie with a role outside the four returns 401', async () => {
  const { handler, requests } = setup();
  const body = Buffer.from(JSON.stringify({ role: 'admin', sessionId: 's-1', dealId: DEAL })).toString('base64url');
  const sig = crypto.createHmac('sha256', 'local-dev-only-secret').update(body).digest('base64url');
  const res = await handler(post(`${cookieName}=${body}.${sig}`));
  assert.strictEqual(res.status, 401);
  assert.strictEqual(requests.length, 0);
});

for (const role of ['broker', 'seller', 'buyer', 'lender']) {
  test(`one role, the session's (${role}), is recorded on every event of a turn`, async () => {
    const { handler, store } = setup();
    const { turnId } = await (await handler(post(cookieFor(role), { message: 'hi', role: 'broker' }))).json();
    const rows = store.rows.filter(r => r.turn_id === turnId);
    assert.deepStrictEqual(rows.map(r => r.event_type), ['model_call_start', 'model_call_end']);
    assert.deepStrictEqual([...new Set(rows.map(r => r.role))], [role]);
  });
}

test('the chat rate limit returns 429 with a plain message, before any model call', async () => {
  const { handler, requests } = setup({ perMinute: 2 });
  for (let i = 0; i < 2; i++) assert.strictEqual((await handler(post(cookieFor('buyer')))).status, 200);
  const res = await handler(post(cookieFor('buyer')));
  assert.strictEqual(res.status, 429);
  const body = await res.json();
  assert.deepStrictEqual(Object.keys(body).sort(), ['reply', 'turnId']);
  assert.match(body.reply, /too quickly/i);
  assert.strictEqual(requests.length, 2);
});

test('the daily cap returns 429 with a plain message, the model is not called and nothing is saved', async () => {
  const { handler, requests, threads } = setup({ cap: 1 });
  assert.strictEqual((await handler(post(cookieFor('lender')))).status, 200);
  const res = await handler(post(cookieFor('lender'), { message: 'again' }));
  assert.strictEqual(res.status, 429);
  const body = await res.json();
  assert.deepStrictEqual(Object.keys(body).sort(), ['reply', 'turnId']);
  assert.match(body.reply, /daily/i);
  assert.strictEqual(requests.length, 1);
  assert.strictEqual((await threads.recent({ dealId: DEAL, sessionId: 's-1', role: 'lender' })).length, 2);
});

test('earlier turns are sent as context, and threads are isolated by role', async () => {
  const { handler, requests } = setup({ replies: [ok('r1'), ok('r2'), ok('r3')] });
  await handler(post(cookieFor('broker'), { message: 'broker secret' }));
  await handler(post(cookieFor('broker'), { message: 'second' }));
  assert.deepStrictEqual(requests[1].messages, [
    { role: 'user', content: 'broker secret' }, { role: 'assistant', content: 'r1' }, { role: 'user', content: 'second' }]);
  // Same session id, other role: none of the broker's thread reaches the seller.
  await handler(post(cookieFor('seller'), { message: 'seller here' }));
  assert.deepStrictEqual(requests[2].messages, [{ role: 'user', content: 'seller here' }]);
});

test(`a thread keeps the last ${THREAD_MESSAGES_KEPT} messages`, async () => {
  const { handler, threads, requests } = setup();
  const turns = THREAD_MESSAGES_KEPT / 2 + 2;
  for (let i = 0; i < turns; i++) await handler(post(cookieFor('buyer'), { message: `m${i}` }));
  const kept = await threads.recent({ dealId: DEAL, sessionId: 's-1', role: 'buyer' });
  assert.strictEqual(kept.length, THREAD_MESSAGES_KEPT);
  assert.deepStrictEqual(kept.at(-2), { role: 'user', content: `m${turns - 1}` });
  assert.strictEqual(requests.at(-1).messages.length, THREAD_MESSAGES_KEPT + 1);
});

test('no key appears in stored events, the thread or the response', async () => {
  const { handler, store, threads } = setup({ replies: [ok('here it is: sk-ant-api03-xyz789')] });
  const res = await handler(post(cookieFor('broker'), { message: 'my key is sk-ant-abc123' }));
  const text = await res.text();
  assert.ok(!text.includes('sk-ant-'));
  const stored = JSON.stringify(store.rows);
  assert.ok(!stored.includes('sk-ant-'));
  assert.ok(stored.includes('[REDACTED]'));
  assert.ok(!JSON.stringify(await threads.recent({ dealId: DEAL, sessionId: 's-1', role: 'broker' })).includes('sk-ant-'));
});

test('MODEL_NOT_CONFIGURED (503) is answered before the session check (401)', async () => {
  const { handler } = setup({ model: false });
  const res = await handler(post(null));
  assert.strictEqual(res.status, 503);
  assert.strictEqual((await res.json()).error, 'MODEL_NOT_CONFIGURED');
});

test('only POST is accepted', async () => {
  const { handler } = setup();
  const res = await handler(new Request('http://x/api/agent', { headers: { cookie: cookieFor('broker') } }));
  assert.strictEqual(res.status, 405);
});

test('a missing or empty message is a bad request', async () => {
  const { handler, requests } = setup();
  for (const body of [{}, { message: '' }, { message: 42 }]) {
    assert.strictEqual((await handler(post(cookieFor('broker'), body))).status, 400);
  }
  assert.strictEqual(requests.length, 0);
});

test('endpoint: hosted without Upstash returns 503', async () => {
  const res = await createAgentEndpoint({ VERCEL: '1', AGENT_SESSION_SECRET: 'owner-secret' })(post(cookieFor('broker')));
  assert.strictEqual(res.status, 503);
  assert.strictEqual((await res.json()).error, 'DEMO_NOT_CONFIGURED');
});

test('endpoint: with no model client wired it returns 503 MODEL_NOT_CONFIGURED', async () => {
  const res = await createAgentEndpoint({})(post(cookieFor('broker')));
  assert.strictEqual(res.status, 503);
  assert.strictEqual((await res.json()).error, 'MODEL_NOT_CONFIGURED');
});
