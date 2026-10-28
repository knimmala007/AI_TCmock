// Ticket 064: the refusal bodies of GET /api/events and GET /api/inbox hold no question text.
// events_page.test.js and inbox.test.js already cover the 403 status; this adds that, after a real ask_broker turn
// (handler seam, scripted fake model, memory storage, no network), what the refused roles are told carries none of it.
import test from 'node:test';
import assert from 'node:assert';
import { memoryKv } from '../kv.js';
import { createDailyCap, createRateLimiter } from '../limits.js';
import { createEventLog, memoryEventStore } from '../events.js';
import { createSeenFieldStore, createThreadStore } from '../threads.js';
import { createRepository, memoryStorage } from '../repository.js';
import { cookieName, sessionFromRequest, signSession } from '../session.js';
import { createAgentHandler } from '../agent_handler.js';
import { createInboxHandler, createInboxStore } from '../inbox.js';
import { createEventsPageHandler } from '../events_page.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const env = {};
const DEAL = 'TX-CG118';
const MARKER = 'ZEBRA-7731';
const QUESTION = `Can I waive the inspection contingency? ${MARKER}`;
const usage = { input_tokens: 1, output_tokens: 1 };
const cookieFor = role => `${cookieName}=${signSession({ role, sessionId: 's-1', dealId: DEAL }, env)}`;

// The buyer hands QUESTION to the broker through the real agent handler; then both endpoints are built on the same stores.
async function askedWorld() {
  const kv = memoryKv();
  const store = memoryEventStore();
  const eventLog = createEventLog(store);
  const inbox = createInboxStore(kv, { newTicketId: () => 'T-1' });
  const getSession = r => sessionFromRequest(r, env);
  const replies = [
    { content: [{ type: 'tool_use', id: 'a1', name: 'ask_broker', input: { question: QUESTION } }], stop_reason: 'tool_use', usage },
    { content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn', usage },
  ];
  let n = 0;
  const agent = createAgentHandler({
    getSession, limiter: createRateLimiter(kv), dailyCap: createDailyCap(kv, { cap: 100 }), eventLog,
    threads: createThreadStore(kv), repository: createRepository(memoryStorage()), seenFields: createSeenFieldStore(kv), inbox,
    callModel: async () => replies[Math.min(n++, replies.length - 1)],
  });
  const res = await agent(new Request('http://x/api/agent', {
    method: 'POST', body: JSON.stringify({ message: 'hi' }), headers: { 'content-type': 'application/json', cookie: cookieFor('buyer') },
  }));
  assert.strictEqual(res.status, 200);
  const { turnId } = await res.json();
  assert.ok(JSON.stringify(store.rows).includes(MARKER), 'the question is logged, so the leak checks can see it');
  return { turnId, events: createEventsPageHandler({ eventLog, getSession }), inbox: createInboxHandler({ inbox, getSession }) };
}

const get = (path, role) => new Request(`http://x${path}`, { headers: role ? { cookie: cookieFor(role) } : {} });

for (const role of ['seller', 'buyer', 'lender']) {
  test(`${role}: the 403 bodies of /api/events and /api/inbox hold no question text`, async () => {
    const w = await askedWorld();
    for (const [name, res] of [
      ['events with the real turn id', await w.events(get(`/api/events?turn=${w.turnId}`, role))],
      ['events without a turn id', await w.events(get('/api/events', role))],
      ['inbox', await w.inbox(get('/api/inbox', role))],
    ]) {
      assert.strictEqual(res.status, 403, name);
      const text = await res.text();
      assert.strictEqual(JSON.parse(text).error, 'ROLE_FORBIDDEN', name);
      assert.ok(!text.includes(MARKER) && !text.includes('waive') && !text.includes('inspection'), name);
      assert.ok(!text.includes('T-1') && !text.includes(w.turnId) && !text.includes('model_call'), name);
    }
  });
}

test('the broker reads the question through both endpoints, so the refusals above are not empty by accident', async () => {
  const w = await askedWorld();
  assert.ok((await (await w.events(get(`/api/events?turn=${w.turnId}`, 'broker'))).text()).includes(MARKER));
  assert.ok((await (await w.inbox(get('/api/inbox', 'broker'))).text()).includes(MARKER));
});

test('no session gets a 401 body with no question text from either endpoint', async () => {
  const w = await askedWorld();
  for (const res of [await w.events(get(`/api/events?turn=${w.turnId}`)), await w.inbox(get('/api/inbox'))]) {
    assert.strictEqual(res.status, 401);
    assert.ok(!(await res.text()).includes(MARKER));
  }
});
