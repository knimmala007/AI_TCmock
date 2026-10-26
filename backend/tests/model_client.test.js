// The real model client and its wiring into the endpoint: a fake fetch only, never the real API.
import test from 'node:test';
import assert from 'node:assert';
import { createModelClient, modelClientFromEnv, MESSAGES_URL, API_VERSION, API_KEY_HEADER, API_VERSION_HEADER, ModelCallError } from '../model_client.js';
import { MODEL } from '../config.js';
import { createAgentEndpoint } from '../../api/agent.js';
import { cookieName, signSession } from '../session.js';
import { createModelGate, createTurn } from '../model_gate.js';
import { createEventLog, memoryEventStore } from '../events.js';
import { memoryKv } from '../kv.js';
import { createDailyCap } from '../limits.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const KEY = 'sk-ant-test-secret-key-123';
const good = { content: [{ type: 'text', text: 'hi there' }], stop_reason: 'end_turn', usage: { input_tokens: 3, output_tokens: 2 } };
const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const fakeFetch = res => {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url, init }); return typeof res === 'function' ? res() : res; };
  return { fn, calls };
};
const input = { system: 'be brief', tools: [], messages: [{ role: 'user', content: 'hello' }] };

test('a successful reply returns {content, stop_reason, usage} and sends the documented request', async () => {
  const f = fakeFetch(reply({ ...good, id: 'msg_1', model: 'x', role: 'assistant' }));
  const result = await createModelClient({ apiKey: KEY, fetchImpl: f.fn })(input);
  assert.deepStrictEqual(result, good);
  const { url, init } = f.calls[0];
  assert.strictEqual(url, MESSAGES_URL);
  assert.strictEqual(init.method, 'POST');
  assert.strictEqual(init.headers['x-api-key'], KEY);
  assert.strictEqual(init.headers['anthropic-version'], API_VERSION);
  const body = JSON.parse(init.body);
  assert.strictEqual(body.model, MODEL);
  assert.strictEqual(body.system, 'be brief');
  assert.deepStrictEqual(body.messages, input.messages);
  assert.ok(body.max_tokens > 0);
  assert.ok(!('tools' in body), 'empty tools are omitted');
});

test('tools are sent when there are some', async () => {
  const f = fakeFetch(reply(good));
  const tools = [{ name: 't', description: 'd', input_schema: { type: 'object', properties: {} } }];
  await createModelClient({ apiKey: KEY, fetchImpl: f.fn })({ ...input, tools });
  assert.deepStrictEqual(JSON.parse(f.calls[0].init.body).tools, tools);
});

test('the model name is a parameter, not hard-coded in the client', async () => {
  const f = fakeFetch(reply(good));
  await createModelClient({ apiKey: KEY, model: 'other-model', fetchImpl: f.fn })(input);
  assert.strictEqual(JSON.parse(f.calls[0].init.body).model, 'other-model');
});

async function failure(client) {
  try { await client(input); } catch (e) { return e; }
  assert.fail('expected a failure');
}
const leaky = 'UPSTREAM-DETAIL ' + KEY;

test('an HTTP error becomes a plain ModelCallError with no upstream text or key', async () => {
  const f = fakeFetch(() => ({ ok: false, status: 401, json: async () => ({ error: { message: leaky } }), text: async () => leaky }));
  const e = await failure(createModelClient({ apiKey: KEY, fetchImpl: f.fn }));
  assert.ok(e instanceof ModelCallError);
  assert.ok(!e.message.includes(KEY) && !e.message.includes('UPSTREAM'));
  assert.ok(!String(e.stack).includes(KEY));
});

test('a network failure or timeout becomes a plain ModelCallError', async () => {
  const e = await failure(createModelClient({ apiKey: KEY, fetchImpl: async () => { throw new Error(leaky); } }));
  assert.ok(e instanceof ModelCallError);
  assert.ok(!e.message.includes(KEY));
  const slow = (url, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error(leaky))));
  const t = await failure(createModelClient({ apiKey: KEY, fetchImpl: slow, timeoutMs: 5 }));
  assert.ok(t instanceof ModelCallError);
  assert.ok(!t.message.includes(KEY));
});

test('a malformed body becomes a plain ModelCallError', async () => {
  for (const res of [
    { ok: true, status: 200, json: async () => { throw new Error(leaky); } },
    reply({ nope: leaky }),
    reply(null),
    reply({ ...good, content: 'not an array' }),
  ]) {
    const e = await failure(createModelClient({ apiKey: KEY, fetchImpl: fakeFetch(res).fn }));
    assert.ok(e instanceof ModelCallError);
    assert.ok(!e.message.includes(KEY) && !e.message.includes('UPSTREAM'));
  }
});

test('no key: no client is built', () => {
  assert.strictEqual(modelClientFromEnv({}), undefined);
  assert.strictEqual(modelClientFromEnv({ ANTHROPIC_API_KEY: '' }), undefined);
  assert.strictEqual(typeof modelClientFromEnv({ ANTHROPIC_API_KEY: KEY }), 'function');
  assert.throws(() => createModelClient({}), /apiKey/);
});

// Endpoint wiring. The client reaches the network only through global fetch, which is faked here.
const env = { ANTHROPIC_API_KEY: KEY };
const post = () => new Request('http://x/api/agent', {
  method: 'POST', body: JSON.stringify({ message: 'hi' }),
  headers: { 'content-type': 'application/json', cookie: `${cookieName}=${signSession({ role: 'broker', sessionId: 's-1', dealId: 'TX-CG118' }, env)}` },
});

test('endpoint: with a key set it calls the model through fetch and answers 200', async () => {
  const f = fakeFetch(reply(good));
  globalThis.fetch = f.fn;
  const res = await createAgentEndpoint(env)(post());
  assert.strictEqual(res.status, 200);
  const text = await res.text();
  assert.strictEqual(JSON.parse(text).reply, 'hi there');
  assert.ok(!text.includes(KEY));
  assert.strictEqual(f.calls.length, 1);
});

test('endpoint: with no key it still answers 503 MODEL_NOT_CONFIGURED and never calls fetch', async () => {
  const res = await createAgentEndpoint({})(post());
  assert.strictEqual(res.status, 503);
  assert.strictEqual((await res.json()).error, 'MODEL_NOT_CONFIGURED');
});

test('endpoint: an injected callModel takes precedence over the key', async () => {
  const res = await createAgentEndpoint(env, { callModel: async () => ({ ...good, content: [{ type: 'text', text: 'injected' }] }) })(post());
  assert.strictEqual((await res.json()).reply, 'injected');
});

test('endpoint: a failed model call is a plain 502 with no key, stack or upstream text', async () => {
  globalThis.fetch = fakeFetch({ ok: false, status: 500, json: async () => ({ error: leaky }) }).fn;
  const res = await createAgentEndpoint(env)(post());
  assert.strictEqual(res.status, 502);
  const text = await res.text();
  assert.deepStrictEqual(Object.keys(JSON.parse(text)).sort(), ['error', 'message']);
  assert.ok(!text.includes(KEY) && !text.includes('UPSTREAM') && !text.includes(' at '));
});

test('the auth header names and version come from the named constants', async () => {
  const f = fakeFetch(reply(good));
  await createModelClient({ apiKey: KEY, fetchImpl: f.fn })(input);
  assert.strictEqual(f.calls[0].init.headers[API_KEY_HEADER], KEY);
  assert.strictEqual(f.calls[0].init.headers[API_VERSION_HEADER], API_VERSION);
});

test('an HTTP error carries its status code on the error', async () => {
  const e = await failure(createModelClient({ apiKey: KEY, fetchImpl: fakeFetch(reply({ error: leaky }, 429)).fn }));
  assert.strictEqual(e.status, 429);
  assert.match(e.message, /429/);
});

test('endpoint: any other error is a generic 500, not shown as a model problem', async () => {
  const seen = [];
  const realError = console.error;
  console.error = (...a) => seen.push(a.join(' '));
  try {
    const boom = async () => { throw new TypeError(`broke with ${KEY} and UPSTREAM-BODY`); };
    const res = await createAgentEndpoint(env, { callModel: boom })(post());
    assert.strictEqual(res.status, 500);
    const text = await res.text();
    assert.deepStrictEqual(JSON.parse(text), { error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
    assert.ok(!text.includes(KEY) && !text.includes('MODEL'));
  } finally { console.error = realError; }
  assert.strictEqual(seen.length, 1);
  assert.match(seen[0], /TypeError/);
  assert.ok(!seen[0].includes(KEY), 'the key is redacted from the console');
  assert.ok(!seen[0].includes(' at '), 'no stack');
});

test('a failed model call is logged through the gate with its status and without the key or body', async () => {
  const store = memoryEventStore();
  const gate = createModelGate({
    callModel: createModelClient({ apiKey: KEY, fetchImpl: fakeFetch(reply({ error: leaky }, 503)).fn }),
    dailyCap: createDailyCap(memoryKv(), { cap: 10 }), eventLog: createEventLog(store),
  });
  const turn = createTurn({ sessionId: 's', turnId: 't', role: 'broker', dealId: 'TX-CG118' });
  await assert.rejects(gate(turn, input), ModelCallError);
  const end = (await store.list('t')).find(e => e.event_type === 'model_call_end');
  assert.match(end.payload.error, /503/);
  const all = JSON.stringify(await store.list('t'));
  assert.ok(!all.includes(KEY) && !all.includes('UPSTREAM'));
});
