// GET /api/history (ticket 029b) at the handler seam: memory storage, no network, no model call.
// The thread is read with the scope {dealId, sessionId, role} from the signed cookie only. Threads are seeded
// through the real chat handler, so the test reads what the real write path stored.
import test from 'node:test';
import assert from 'node:assert';
import { memoryKv } from '../kv.js';
import { createDailyCap, createRateLimiter } from '../limits.js';
import { createEventLog, memoryEventStore } from '../events.js';
import { createSeenFieldStore, createThreadStore } from '../threads.js';
import { createRepository, memoryStorage } from '../repository.js';
import { cookieName, sessionFromRequest, signSession } from '../session.js';
import { createAgentHandler } from '../agent_handler.js';
import { createDemoSessionHandler } from '../demo_session.js';
import { createHistoryHandler } from '../history.js';
import * as endpoint from '../../api/history.js';
import { AUDIT_PAGE_PER_MINUTE, THREAD_MESSAGES_KEPT } from '../config.js';
import { SEED_DEALS } from '../fixtures.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const env = {};
const DEAL = 'TX-CG118';
const usage = { input_tokens: 1, output_tokens: 1 };
const ok = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage });

const tokenFor = (role, sessionId, dealId = DEAL, e = env) => signSession({ role, sessionId, dealId }, e);
const cookieFor = (role, sessionId = 's-1', dealId = DEAL) => `${cookieName}=${tokenFor(role, sessionId, dealId)}`;
const get = (cookie, { url = 'http://x/api/history', headers = {}, method = 'GET', body } = {}) => new Request(url, {
  method, headers: { ...(cookie ? { cookie } : {}), ...headers }, ...(body === undefined ? {} : { body }),
});
const chat = (cookie, message) => new Request('http://x/api/agent', {
  method: 'POST', body: JSON.stringify({ message }), headers: { 'content-type': 'application/json', cookie },
});

// One shared kv. `modelCalls` counts calls to the scripted model; history must never add to it.
function world({ perMinute } = {}) {
  const kv = memoryKv();
  const threads = createThreadStore(kv);
  const limiter = createRateLimiter(kv);
  const state = { modelCalls: 0, reads: 0 };
  const callModel = async () => { state.modelCalls++; return ok('reply'); };
  const chatHandler = createAgentHandler({
    callModel, getSession: r => sessionFromRequest(r, env), limiter, dailyCap: createDailyCap(kv, { cap: 1000 }),
    eventLog: createEventLog(memoryEventStore()), threads,
    repository: createRepository(memoryStorage()), seenFields: createSeenFieldStore(kv),
  });
  // `reads` counts the calls that reach the thread store, so a refusal can prove it read nothing.
  const spied = { recent: scope => { state.reads++; return threads.recent(scope); } };
  const history = createHistoryHandler({ threads: spied, getSession: r => sessionFromRequest(r, env), limiter, ...(perMinute ? { perMinute } : {}) });
  const say = async (cookie, message) => { const r = await chatHandler(chat(cookie, message)); assert.strictEqual(r.status, 200); };
  return { kv, state, history, say, limiter, demo: createDemoSessionHandler(env, { limiter: createRateLimiter(kv) }) };
}

const read = async res => ({ status: res.status, body: await res.json() });

test('AC1: a valid session gets its own messages, oldest first, with no model call', async () => {
  const w = world();
  await w.say(cookieFor('buyer'), 'first question');
  await w.say(cookieFor('buyer'), 'second question');
  const callsBefore = w.state.modelCalls;
  const { status, body } = await read(await w.history(get(cookieFor('buyer'))));
  assert.strictEqual(status, 200);
  assert.deepStrictEqual(body, { messages: [
    { role: 'user', content: 'first question' }, { role: 'assistant', content: 'reply' },
    { role: 'user', content: 'second question' }, { role: 'assistant', content: 'reply' },
  ] });
  assert.ok(body.messages.every(m => Object.keys(m).sort().join() === 'content,role'));
  assert.strictEqual(w.state.modelCalls, callsBefore, 'the history read called the model');
});

test('AC1: an empty thread is an empty list, and the response is never cached', async () => {
  const w = world();
  const res = await w.history(get(cookieFor('seller')));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('cache-control'), 'no-store');
  assert.deepStrictEqual(await res.json(), { messages: [] });
});

test('AC1: at most THREAD_MESSAGES_KEPT messages come back, the newest', async () => {
  const w = world();
  for (let i = 0; i < THREAD_MESSAGES_KEPT; i++) await w.say(cookieFor('buyer'), `q${i}`);
  const { body } = await read(await w.history(get(cookieFor('buyer'))));
  assert.strictEqual(body.messages.length, THREAD_MESSAGES_KEPT);
  assert.deepStrictEqual(body.messages.at(-2), { role: 'user', content: `q${THREAD_MESSAGES_KEPT - 1}` });
  assert.ok(!body.messages.some(m => m.content === 'q0'));
});

test('AC2/3: a role, session id or deal id in the query, body or headers changes nothing', async () => {
  const w = world();
  await w.say(cookieFor('buyer', 's-1'), 'mine MARK-OWN');
  await w.say(cookieFor('broker', 's-2'), 'broker secret MARK-BROKER');
  await w.say(cookieFor('buyer', 's-3'), 'other session MARK-OTHER');
  const plain = await read(await w.history(get(cookieFor('buyer', 's-1'))));
  const attacks = [
    get(cookieFor('buyer', 's-1'), { url: 'http://x/api/history?role=broker&sessionId=s-2&session=s-2&deal=tx_unknown_city&dealId=tx_unknown_city' }),
    get(cookieFor('buyer', 's-1'), { method: 'GET', headers: { 'content-type': 'application/json' } }),
    get(cookieFor('buyer', 's-1'), { headers: {
      'x-role': 'broker', 'x-session-id': 's-2', 'x-deal-id': 'tx_unknown_city', 'x-forwarded-for': '9.9.9.9',
      authorization: 'Bearer broker', 'x-session': tokenFor('broker', 's-2'),
    } }),
  ];
  for (const req of attacks) {
    const got = await read(await w.history(req));
    assert.deepStrictEqual(got, plain);
    assert.ok(!JSON.stringify(got).includes('MARK-BROKER') && !JSON.stringify(got).includes('MARK-OTHER'));
  }
  assert.ok(JSON.stringify(plain).includes('MARK-OWN'));
});

test('AC2: the thread is read under the cookie\'s deal; another deal\'s thread for the same session id stays unread', async () => {
  const w = world();
  const other = Object.keys(SEED_DEALS).find(d => d !== DEAL);
  await w.say(cookieFor('buyer', 's-1', DEAL), 'in the first deal MARK-DEAL-A');
  await w.say(cookieFor('buyer', 's-1', other), 'in the other deal MARK-DEAL-B');
  const a = JSON.stringify(await (await w.history(get(cookieFor('buyer', 's-1', DEAL)))).json());
  const b = JSON.stringify(await (await w.history(get(cookieFor('buyer', 's-1', other)))).json());
  assert.ok(a.includes('MARK-DEAL-A') && !a.includes('MARK-DEAL-B'));
  assert.ok(b.includes('MARK-DEAL-B') && !b.includes('MARK-DEAL-A'));
});

test('AC4: a missing, garbage, tampered or forged cookie gets 401 with fixed text and no thread', async () => {
  const w = world();
  await w.say(cookieFor('broker', 's-1'), 'broker secret MARK-BROKER');
  const good = tokenFor('buyer', 's-1');
  const [body, sig] = good.split('.');
  const forgedBody = Buffer.from(JSON.stringify({ role: 'broker', sessionId: 's-1', dealId: DEAL })).toString('base64url');
  const cookies = [
    undefined,
    `${cookieName}=garbage`,
    `${cookieName}=`,
    `${cookieName}=${body}.${sig.slice(0, -2)}xx`,
    `${cookieName}=${forgedBody}.${sig}`,
    `${cookieName}=${tokenFor('broker', 's-1', DEAL, { AGENT_SESSION_SECRET: 'some-other-secret' })}`,
    `other=${good}`,
  ];
  for (const cookie of cookies) {
    w.state.reads = 0;
    const res = await w.history(get(cookie));
    assert.strictEqual(res.status, 401, String(cookie));
    const text = await res.text();
    assert.deepStrictEqual(JSON.parse(text), { error: 'UNAUTHENTICATED', message: 'Pick a role first.' });
    assert.ok(!text.includes('MARK-BROKER'));
    assert.strictEqual(w.state.reads, 0, 'the thread store was read without a valid session');
  }
});

test('AC5: a buyer session cannot read the broker\'s thread', async () => {
  const w = world();
  await w.say(cookieFor('broker', 's-1'), 'broker only MARK-BROKER');
  // Same deal, same session id, different role: the role is part of the key.
  const { body } = await read(await w.history(get(cookieFor('buyer', 's-1'))));
  assert.deepStrictEqual(body, { messages: [] });
  const broker = JSON.stringify(await (await w.history(get(cookieFor('broker', 's-1')))).json());
  assert.ok(broker.includes('MARK-BROKER'));
});

test('AC5: a role switch through the switcher starts empty, even when switching back', async () => {
  const w = world();
  const cookieOf = res => res.headers.get('set-cookie').split(';')[0];
  const start = async role => cookieOf(await w.demo(new Request('http://x/api/demo-session', {
    method: 'POST', body: JSON.stringify({ role }), headers: { 'content-type': 'application/json' },
  })));
  const buyer1 = await start('buyer');
  await w.say(buyer1, 'first buyer turn MARK-B1');
  assert.ok(JSON.stringify(await (await w.history(get(buyer1))).json()).includes('MARK-B1'));
  const seller = await start('seller');
  assert.deepStrictEqual(await (await w.history(get(seller))).json(), { messages: [] });
  const buyer2 = await start('buyer');
  assert.notStrictEqual(buyer2, buyer1);
  assert.deepStrictEqual(await (await w.history(get(buyer2))).json(), { messages: [] });
});

test('AC6: the response holds only the thread\'s messages, no token, session id, secret, key or deal data', async () => {
  const w = world();
  const cookie = cookieFor('buyer', 'session-id-ABC');
  await w.say(cookie, 'hello there');
  // A stored row with an extra field must not reach the client.
  await w.kv.exec(['RPUSH', `thread:${DEAL}:session-id-ABC:buyer`, JSON.stringify({ role: 'assistant', content: 'extra', internal: 'LEAK-FIELD', token: 'LEAK-TOKEN' })]);
  const res = await w.history(get(cookie));
  const text = await res.text();
  assert.ok(!res.headers.has('set-cookie'));
  assert.deepStrictEqual(Object.keys(JSON.parse(text)), ['messages']);
  for (const bad of [cookie.split('=')[1], 'session-id-ABC', 'local-dev-only-secret', 'ANTHROPIC', 'sk-', 'LEAK-FIELD', 'LEAK-TOKEN', 'transaction_id', 'missing_fields', 'dealId']) {
    assert.ok(!text.includes(bad), `response contains ${bad}`);
  }
  assert.deepStrictEqual(JSON.parse(text).messages.map(m => Object.keys(m).sort().join()), ['content,role', 'content,role', 'content,role']);
});

test('the read does not redact again: what the chat saved redacted is what comes back', async () => {
  const w = world();
  const FAKE_KEY = 'sk-' + 'ant-abc123_XYZ'; // split so the commit hook's key scan does not match
  await w.say(cookieFor('buyer'), `my key is ${FAKE_KEY}`);
  const { body } = await read(await w.history(get(cookieFor('buyer'))));
  assert.strictEqual(body.messages[0].content, 'my key is [REDACTED]');
});

test('AC7: the read is rate limited per client, with fixed text, and a refused call reads nothing', async () => {
  const w = world({ perMinute: 3 });
  for (let i = 0; i < 3; i++) assert.strictEqual((await w.history(get(cookieFor('buyer')))).status, 200);
  w.state.reads = 0;
  const res = await w.history(get(cookieFor('buyer')));
  assert.strictEqual(res.status, 429);
  assert.strictEqual(res.headers.get('retry-after'), '60');
  assert.deepStrictEqual(await res.json(), { error: 'RATE_LIMITED', message: 'Too many requests. Please wait a minute.' });
  assert.strictEqual(w.state.reads, 0);
  // Another client has its own bucket; the limit also covers calls with no session.
  assert.strictEqual((await w.history(get(cookieFor('buyer'), { headers: { 'x-forwarded-for': '2.2.2.2' } }))).status, 200);
  assert.strictEqual((await w.history(get(undefined))).status, 429);
});

test('AC7: the default limit is the config.js number, in its own bucket', async () => {
  const w = world();
  for (let i = 0; i < AUDIT_PAGE_PER_MINUTE; i++) assert.strictEqual((await w.history(get(cookieFor('buyer')))).status, 200);
  assert.strictEqual((await w.history(get(cookieFor('buyer')))).status, 429);
  // The audit page's bucket is separate: history traffic does not use it up.
  const audit = await w.limiter.hit('inbox:unknown', { limit: AUDIT_PAGE_PER_MINUTE, windowSeconds: 60 });
  assert.strictEqual(audit.allowed, true);
});

test('AC7: methods other than GET are refused and read nothing', async () => {
  const w = world();
  await w.say(cookieFor('buyer'), 'MARK-THREAD');
  w.state.reads = 0;
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const res = await w.history(get(cookieFor('buyer'), { method, body: JSON.stringify({ role: 'broker' }) }));
    assert.strictEqual(res.status, 405, method);
    assert.strictEqual(res.headers.get('allow'), 'GET');
    assert.deepStrictEqual(await res.json(), { error: 'METHOD_NOT_ALLOWED' });
  }
  assert.strictEqual(w.state.reads, 0);
});

test('the endpoint file is wiring: it exports GET and no other method', () => {
  assert.strictEqual(typeof endpoint.GET, 'function');
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.strictEqual(endpoint[m], undefined);
});

test('the history handler takes no model: it cannot call one', async () => {
  const w = world();
  await w.say(cookieFor('buyer'), 'hi');
  const callsBefore = w.state.modelCalls;
  for (let i = 0; i < 5; i++) await w.history(get(cookieFor('buyer')));
  await w.history(get(undefined));
  assert.strictEqual(w.state.modelCalls, callsBefore);
});
