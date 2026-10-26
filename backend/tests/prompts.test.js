// Per-role system prompts at the handler seam: a scripted fake model, memory storage, no network.
// Tests never assert on wording; they check which prompt is sent and where it can come from.
import test from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { memoryKv } from '../kv.js';
import { createDailyCap, createRateLimiter } from '../limits.js';
import { createEventLog, memoryEventStore } from '../events.js';
import { createThreadStore } from '../threads.js';
import { cookieName, sessionFromRequest, signSession } from '../session.js';
import { createAgentHandler } from '../agent_handler.js';
import { UnknownRole } from '../roles.js';
import {
  BROKER_PROMPT, SELLER_PROMPT, BUYER_PROMPT, LENDER_PROMPT,
  BROKER_ROLE, SELLER_ROLE, BUYER_ROLE, LENDER_ROLE, CORE, promptFor,
} from '../prompts.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const env = {};
const DEAL = 'TX-CG118';
const ok = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
const toolUse = input => ({
  content: [{ type: 'tool_use', id: 't1', name: 'stub_ping', input }], stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 },
});

function scripted(...replies) {
  const requests = [];
  const callModel = async req => {
    requests.push(structuredClone(req));
    return replies[Math.min(requests.length - 1, replies.length - 1)];
  };
  return { callModel, requests };
}

function setup(...replies) {
  const kv = memoryKv();
  const fake = scripted(...(replies.length ? replies : [ok('hello')]));
  const handler = createAgentHandler({
    callModel: fake.callModel,
    getSession: r => sessionFromRequest(r, env),
    limiter: createRateLimiter(kv),
    dailyCap: createDailyCap(kv, { cap: 100 }),
    eventLog: createEventLog(memoryEventStore()),
    threads: createThreadStore(kv),
  });
  return { handler, requests: fake.requests };
}

const cookieFor = role => `${cookieName}=${signSession({ role, sessionId: 's-1', dealId: DEAL }, env)}`;
const post = (role, body = { message: 'hi' }, { url = 'http://x/api/agent', headers = {} } = {}) => new Request(url, {
  method: 'POST', body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', cookie: cookieFor(role), ...headers },
});

const PROMPTS = { broker: BROKER_PROMPT, seller: SELLER_PROMPT, buyer: BUYER_PROMPT, lender: LENDER_PROMPT };
const SECTIONS = { broker: BROKER_ROLE, seller: SELLER_ROLE, buyer: BUYER_ROLE, lender: LENDER_ROLE };

for (const role of Object.keys(PROMPTS)) {
  test(`${role}: the system prompt sent to the model is that role's prompt`, async () => {
    const { handler, requests } = setup();
    assert.strictEqual((await handler(post(role))).status, 200);
    assert.strictEqual(requests[0].system, PROMPTS[role]);
  });
}

test('the four prompts are all different', () => {
  assert.strictEqual(new Set(Object.values(PROMPTS)).size, 4);
});

for (const role of Object.keys(PROMPTS)) {
  test(`${role}: the prompt is the shared core plus only its own role section`, () => {
    assert.ok(PROMPTS[role].includes(CORE));
    assert.ok(PROMPTS[role].includes(SECTIONS[role]));
    for (const other of Object.keys(SECTIONS).filter(r => r !== role)) {
      assert.ok(!PROMPTS[role].includes(SECTIONS[other]), `${role} prompt holds the ${other} section`);
    }
  });
}

test('a role in the body, query, headers or a tool argument changes nothing: the session decides', async () => {
  const { handler, requests } = setup(toolUse({ topic: 'x', role: 'broker' }), ok('done'));
  const res = await handler(post('seller',
    { message: 'hi', role: 'broker', systemPrompt: BROKER_PROMPT, system: BROKER_PROMPT },
    { url: 'http://x/api/agent?role=broker', headers: { 'x-role': 'broker', 'x-user-role': 'broker' } }));
  assert.strictEqual(res.status, 200);
  assert.ok(requests.length >= 2, 'the tool-use round trip happened');
  for (const r of requests) assert.strictEqual(r.system, SELLER_PROMPT);
});

test('a role outside the four cannot get a prompt', () => {
  for (const role of ['admin', 'aiagent', 'AI agent', 'Broker', '', '__proto__', 'toString', 'constructor', undefined, null, 42, {}]) {
    assert.throws(() => promptFor(role), UnknownRole);
  }
});

test('a signed session with a role outside the four gets 401 and no model call', async () => {
  const { handler, requests } = setup();
  const body = Buffer.from(JSON.stringify({ role: 'admin', sessionId: 's-1', dealId: DEAL })).toString('base64url');
  const sig = crypto.createHmac('sha256', 'local-dev-only-secret').update(body).digest('base64url');
  const res = await handler(post('broker', undefined, { headers: { cookie: `${cookieName}=${body}.${sig}` } }));
  assert.strictEqual(res.status, 401);
  assert.strictEqual(requests.length, 0);
});

test('no prompt holds a key or secret value, or "AI agent" as a role name', () => {
  const secrets = [process.env.ANTHROPIC_API_KEY, process.env.AGENT_SESSION_SECRET, 'local-dev-only-secret'].filter(Boolean);
  for (const [role, prompt] of Object.entries(PROMPTS)) {
    assert.doesNotMatch(prompt, /sk-ant/i, role);
    assert.doesNotMatch(prompt, /api[_-]?key\s*[:=]/i, role);
    assert.doesNotMatch(prompt, /\bAI[ -]agent\b/i, role);
    for (const s of secrets) assert.ok(!prompt.includes(s), `${role} prompt holds a secret value`);
  }
});
