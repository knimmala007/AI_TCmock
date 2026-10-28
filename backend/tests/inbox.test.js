// ask_broker and the broker's inbox (ticket 050) at the handler seam: a scripted fake model, memory storage, no network.
// The role and the deal come from the signed cookie only; the question text reaches no model but the asker's own turn.
import test from 'node:test';
import assert from 'node:assert';
import { memoryKv } from '../kv.js';
import { createDailyCap, createRateLimiter } from '../limits.js';
import { createEventLog, memoryEventStore } from '../events.js';
import { createSeenFieldStore, createThreadStore } from '../threads.js';
import { createRepository, memoryStorage } from '../repository.js';
import { cookieName, sessionFromRequest, signSession } from '../session.js';
import { createAgentHandler } from '../agent_handler.js';
import { TOOL_NOT_ALLOWED } from '../agent_loop.js';
import { createInboxHandler, createInboxStore } from '../inbox.js';
import { createEventsPageHandler } from '../events_page.js';
import { toolsFor } from '../roles.js';
import { INBOX_ITEMS_PER_DEAL_MAX, INBOX_QUESTION_MAX_CHARS } from '../config.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const env = {};
const DEAL = 'TX-CG118';
const OTHER = 'tx_unknown_city';
const QUESTION = 'Can I waive the inspection contingency? ZEBRA-7731';
const usage = { input_tokens: 1, output_tokens: 1 };
const ok = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const uses = (...blocks) => ({ content: blocks, stop_reason: 'tool_use', usage });
const dealTool = role => (role === 'broker' ? 'get_deal' : 'get_deal_status');

const cookieFor = (role, dealId = DEAL, sessionId = 's-1') =>
  `${cookieName}=${signSession({ role, sessionId, dealId }, env)}`;
const post = cookie => new Request('http://x/api/agent', {
  method: 'POST', body: JSON.stringify({ message: 'hi' }), headers: { 'content-type': 'application/json', cookie },
});

// One shared kv, repository and inbox; each call to `turn` builds a handler with its own scripted model.
function world() {
  const kv = memoryKv();
  const repository = createRepository(memoryStorage());
  const inbox = createInboxStore(kv, { newTicketId: (() => { let n = 0; return () => `T-${++n}`; })() });
  const store = memoryEventStore();
  const common = {
    getSession: r => sessionFromRequest(r, env), limiter: createRateLimiter(kv), dailyCap: createDailyCap(kv, { cap: 100 }),
    eventLog: createEventLog(store), threads: createThreadStore(kv), repository, seenFields: createSeenFieldStore(kv), inbox,
  };
  const requests = [];
  async function turn(role, replies, dealId = DEAL) {
    let n = 0;
    const handler = createAgentHandler({ ...common, callModel: async req => {
      requests.push(structuredClone(req));
      return replies[Math.min(n++, replies.length - 1)];
    } });
    const before = requests.length;
    const res = await handler(post(cookieFor(role, dealId)));
    assert.strictEqual(res.status, 200);
    const mine = requests.slice(before);
    const [result] = mine.at(-1).messages.at(-1).content;
    return { result, envelope: result.is_error ? null : JSON.parse(result.content), requests: mine };
  }
  const ask = (role, input = { question: QUESTION }, dealId = DEAL) =>
    turn(role, [uses(use('a1', 'ask_broker', input)), ok('done')], dealId);
  const look = (role, dealId = DEAL) => turn(role, [uses(use('g1', dealTool(role), {})), ok('done')], dealId);
  return { inbox, store, requests, ask, look, turn };
}

test('ask_broker stores the question with the asking role and the deal id from the turn', async () => {
  for (const role of ['seller', 'buyer', 'lender']) {
    const w = world();
    // The arguments name a different role and deal: they are not read.
    await w.ask(role, { question: QUESTION, role: 'broker', deal_id: OTHER, dealId: OTHER });
    assert.deepStrictEqual(await w.inbox.list(OTHER), []);
    const items = await w.inbox.list(DEAL);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].role, role);
    assert.strictEqual(items[0].deal_id, DEAL);
    assert.strictEqual(items[0].question, QUESTION);
    assert.ok(!Number.isNaN(Date.parse(items[0].created_at)));
  }
});

test('the ticket belongs to the cookie deal when the session is on the other seeded deal', async () => {
  const w = world();
  await w.ask('buyer', { question: QUESTION }, OTHER);
  assert.strictEqual((await w.inbox.list(OTHER)).length, 1);
  assert.deepStrictEqual(await w.inbox.list(DEAL), []);
});

test('ask_broker returns exactly {ticket_id, status: "queued"} and nothing else', async () => {
  const w = world();
  const { envelope, result } = await w.ask('buyer');
  assert.ok(!result.is_error);
  assert.deepStrictEqual(envelope, { ok: true, data: { ticket_id: 'T-1', status: 'queued' }, field_names: [] });
  assert.ok(!result.content.includes('ZEBRA-7731'));
});

test('a bad or empty question stores nothing and returns a fixed error', async () => {
  const w = world();
  for (const input of [{}, { question: '' }, { question: '   ' }, { question: 5 }]) {
    const { result } = await w.ask('seller', input);
    assert.strictEqual(result.is_error, true);
  }
  assert.deepStrictEqual(await w.inbox.list(DEAL), []);
});

test('the broker get_deal shows count, ticket ids, roles and times but never the text', async () => {
  const w = await world();
  await w.ask('buyer');
  await w.ask('seller', { question: 'Second question KIWI-2209' });
  const { envelope, result } = await w.look('broker');
  const { inbox } = envelope.data;
  assert.strictEqual(inbox.count, 2);
  assert.deepStrictEqual(inbox.items.map(i => i.ticket_id), ['T-1', 'T-2']);
  assert.deepStrictEqual(inbox.items.map(i => i.role), ['buyer', 'seller']);
  for (const i of inbox.items) assert.deepStrictEqual(Object.keys(i).sort(), ['created_at', 'role', 'ticket_id']);
  assert.ok(!result.content.includes('ZEBRA-7731') && !result.content.includes('KIWI-2209'));
});

test('no model request in the broker turn contains the question text', async () => {
  const w = world();
  await w.ask('buyer');
  const { requests } = await w.look('broker');
  assert.ok(requests.length >= 2);
  assert.ok(!JSON.stringify(requests).includes('ZEBRA-7731'));
});

test('the broker get_deal has an empty inbox when nothing was asked, and only for the cookie deal', async () => {
  const w = world();
  await w.ask('buyer', { question: QUESTION }, OTHER);
  const { envelope } = await w.look('broker', DEAL);
  assert.deepStrictEqual(envelope.data.inbox, { count: 0, items: [] });
});

test('seller, buyer and lender get_deal_status have no inbox key', async () => {
  const w = world();
  await w.ask('buyer');
  for (const role of ['seller', 'buyer', 'lender']) {
    const { envelope, result } = await w.look(role);
    assert.ok(!('inbox' in envelope.data), role);
    assert.ok(!result.content.includes('ZEBRA-7731'), role);
  }
});

test('the broker cannot call ask_broker, and nothing is stored', async () => {
  assert.ok(!toolsFor('broker').includes('ask_broker'));
  const w = world();
  const { result, requests } = await w.ask('broker');
  assert.strictEqual(result.is_error, true);
  assert.strictEqual(result.content, TOOL_NOT_ALLOWED);
  assert.ok(!requests[0].tools.some(t => t.name === 'ask_broker'));
  assert.deepStrictEqual(await w.inbox.list(DEAL), []);
});

test('seller, buyer and lender are offered ask_broker', async () => {
  for (const role of ['seller', 'buyer', 'lender']) {
    const w = world();
    const { requests } = await w.ask(role);
    assert.ok(requests[0].tools.some(t => t.name === 'ask_broker'), role);
  }
});

// What is logged is unchanged (model_call events still hold the asker's own tool_use input, ticket 062). The property is that
// only the broker can read it: no other role reaches the text through an endpoint or a tool result (ticket 064).
test('after a buyer\'s ask_broker, no non-broker role can read the question through an endpoint or a tool result', async () => {
  const w = world();
  const { result: askResult } = await w.ask('buyer');
  assert.ok(!askResult.content.includes('ZEBRA-7731'));
  // Positive control: the text is stored and logged, so a leak would be visible to the checks below.
  assert.ok(JSON.stringify(w.store.rows).includes('ZEBRA-7731'));
  const turnIds = [...new Set(w.store.rows.map(r => r.turn_id))];
  assert.ok(turnIds.length > 0);

  const getSession = r => sessionFromRequest(r, env);
  const inboxGet = endpoint(w.inbox);
  const eventsGet = createEventsPageHandler({ eventLog: createEventLog(w.store), getSession });
  const asRole = (role, url) => new Request(url, { headers: { cookie: cookieFor(role) } });

  const brokerEvents = await (await eventsGet(asRole('broker', `http://x/api/events?turn=${turnIds[0]}`))).text();
  assert.ok(brokerEvents.includes('ZEBRA-7731'), 'the broker can read the events');
  assert.ok((await (await inboxGet(cookieFor('broker'))).text()).includes('ZEBRA-7731'), 'the broker can read the inbox');

  for (const role of ['seller', 'buyer', 'lender']) {
    for (const res of [
      await inboxGet(cookieFor(role)),
      await eventsGet(asRole(role, 'http://x/api/events')),
      ...await Promise.all(turnIds.map(t => eventsGet(asRole(role, `http://x/api/events?turn=${encodeURIComponent(t)}`)))),
    ]) {
      assert.strictEqual(res.status, 403, role);
      assert.ok(!(await res.text()).includes('ZEBRA-7731'), role);
    }
    // The tool results this role can receive: the deal status and its own ask_broker reply.
    const { result: status } = await w.look(role);
    assert.ok(!status.content.includes('ZEBRA-7731'), role);
    const { result: asked } = await w.ask(role, { question: 'KIWI-2209' });
    assert.ok(!asked.content.includes('ZEBRA-7731'), role);
  }

  // Seller and lender never asked ZEBRA-7731; no model request of their turns carries it either (the buyer's own
  // later turns replay the buyer's own thread, so they are not checked here).
  for (const role of ['seller', 'lender']) {
    const { requests } = await w.look(role);
    assert.ok(!JSON.stringify(requests).includes('ZEBRA-7731'), role);
  }
});

test('a question over the limit is refused with fixed text that does not echo it, and stores nothing', async () => {
  const w = world();
  const long = `ZEBRA-7731 ${'x'.repeat(INBOX_QUESTION_MAX_CHARS)}`;
  const { result } = await w.ask('buyer', { question: long });
  assert.strictEqual(result.is_error, true);
  assert.strictEqual(JSON.parse(result.content).error.code, 'QUESTION_TOO_LONG');
  assert.ok(!result.content.includes('ZEBRA-7731'));
  assert.deepStrictEqual(await w.inbox.list(DEAL), []);
  // Exactly at the limit is accepted.
  const edge = await w.ask('buyer', { question: 'y'.repeat(INBOX_QUESTION_MAX_CHARS) });
  assert.strictEqual(edge.envelope.data.status, 'queued');
});

test('a full inbox refuses with fixed text that does not echo the question; another deal is unaffected', async () => {
  const w = world();
  for (let i = 0; i < INBOX_ITEMS_PER_DEAL_MAX; i++) await w.inbox.add({ dealId: DEAL, role: 'seller', question: `filler ${i}` });
  const { result } = await w.ask('buyer');
  assert.strictEqual(result.is_error, true);
  assert.strictEqual(JSON.parse(result.content).error.code, 'INBOX_FULL');
  assert.ok(!result.content.includes('ZEBRA-7731'));
  assert.strictEqual((await w.inbox.list(DEAL)).length, INBOX_ITEMS_PER_DEAL_MAX);
  assert.strictEqual((await w.ask('buyer', { question: QUESTION }, OTHER)).envelope.data.status, 'queued');
});

// ---- GET /api/inbox ----
function endpoint(inbox, extra = {}) {
  const GET = createInboxHandler({ inbox, getSession: r => sessionFromRequest(r, env), ...extra });
  const get = (cookie, { query = '', method = 'GET', body } = {}) => GET(new Request(`http://x/api/inbox${query}`, {
    method, ...(body ? { body: JSON.stringify(body) } : {}), headers: { ...(cookie ? { cookie } : {}), 'content-type': 'application/json' },
  }));
  return get;
}

test('api/inbox: the broker gets the items with the text', async () => {
  const w = world();
  await w.ask('buyer');
  const res = await endpoint(w.inbox)(cookieFor('broker'));
  assert.strictEqual(res.status, 200);
  const { items } = await res.json();
  assert.strictEqual(items.length, 1);
  assert.deepStrictEqual({ ticket_id: items[0].ticket_id, role: items[0].role, question: items[0].question },
    { ticket_id: 'T-1', role: 'buyer', question: QUESTION });
});

test('api/inbox: every other role gets 403 with fixed text and no question', async () => {
  const w = world();
  await w.ask('buyer');
  for (const role of ['seller', 'buyer', 'lender']) {
    const res = await endpoint(w.inbox)(cookieFor(role));
    assert.strictEqual(res.status, 403, role);
    const text = await res.text();
    assert.ok(!text.includes('ZEBRA-7731') && !text.includes('T-1'), role);
    assert.strictEqual(JSON.parse(text).error, 'ROLE_FORBIDDEN');
  }
});

test('api/inbox: no cookie or a tampered cookie gets 401', async () => {
  const w = world();
  await w.ask('buyer');
  const get = endpoint(w.inbox);
  assert.strictEqual((await get(null)).status, 401);
  const good = cookieFor('seller');
  const forged = `${cookieName}=${signSession({ role: 'broker', dealId: DEAL, sessionId: 's-1' }, env).split('.')[0]}.${good.split('.')[1]}`;
  const res = await get(forged);
  assert.strictEqual(res.status, 401);
  assert.ok(!(await res.text()).includes('ZEBRA-7731'));
});

test('api/inbox: a role or deal id in the query or body changes nothing', async () => {
  const w = world();
  await w.ask('buyer');
  await w.ask('buyer', { question: 'other deal question' }, OTHER);
  const get = endpoint(w.inbox);
  // A non-broker cannot claim the broker role.
  assert.strictEqual((await get(cookieFor('buyer'), { query: '?role=broker&deal=TX-CG118&deal_id=TX-CG118' })).status, 403);
  // The broker cannot reach another deal.
  const res = await get(cookieFor('broker'), { query: `?deal=${OTHER}&deal_id=${OTHER}&dealId=${OTHER}&role=buyer` });
  const { items } = await res.json();
  assert.deepStrictEqual(items.map(i => i.deal_id), [DEAL]);
  // GET only: a body is never read.
  const posted = await get(cookieFor('broker'), { method: 'POST', body: { role: 'broker', deal_id: DEAL } });
  assert.strictEqual(posted.status, 405);
  assert.ok(!(await posted.text()).includes('ZEBRA-7731'));
});

test('api/inbox: over the per-client rate limit returns 429 with fixed text and no items', async () => {
  const w = world();
  await w.ask('buyer');
  const get = endpoint(w.inbox, { limiter: createRateLimiter(memoryKv()), perMinute: 2 });
  assert.strictEqual((await get(cookieFor('broker'))).status, 200);
  assert.strictEqual((await get(cookieFor('broker'))).status, 200);
  const res = await get(cookieFor('broker'));
  assert.strictEqual(res.status, 429);
  const text = await res.text();
  assert.strictEqual(JSON.parse(text).error, 'RATE_LIMITED');
  assert.ok(!text.includes('ZEBRA-7731'));
});
