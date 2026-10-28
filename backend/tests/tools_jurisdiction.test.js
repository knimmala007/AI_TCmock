// Ticket 038: a deal outside the tested jurisdictions gets a fixed decline and no rules from every tool that uses the
// rules; ask_broker still works. Through the handler with a scripted fake model, memory storage, no network.
import test from 'node:test';
import assert from 'node:assert';
import { memoryKv } from '../kv.js';
import { createDailyCap, createRateLimiter } from '../limits.js';
import { createEventLog, memoryEventStore } from '../events.js';
import { createSeenFieldStore, createThreadStore } from '../threads.js';
import { createRepository, memoryStorage } from '../repository.js';
import { cookieName, sessionFromRequest, signSession } from '../session.js';
import { createAgentHandler } from '../agent_handler.js';
import { createInboxStore } from '../inbox.js';
import { DOCS, SEED_DEALS } from '../fixtures.js';
import { UNTESTED_JURISDICTION } from '../tools.js';
import { toolsFor } from '../roles.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const env = {};
const TESTED = 'TX-CG118'; // 118 Cottage Grove Ave, San Jose, Santa Clara
const AUSTIN = 'tx_unknown_city'; // Austin, Travis: synthetic, not on the tested list
const usage = { input_tokens: 1, output_tokens: 1 };
const ok = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const uses = (...blocks) => ({ content: blocks, stop_reason: 'tool_use', usage });
const post = cookie => new Request('http://x/api/agent', {
  method: 'POST', body: JSON.stringify({ message: 'hi' }), headers: { 'content-type': 'application/json', cookie },
});

const save = (field_name, value = 'x') => ['save_answers', { answers: [{ field_name, value }] }];
const askNext = ['ask_next_question', {}];
const dealTool = role => [role === 'broker' ? 'get_deal' : 'get_deal_status', {}];
const SELLER_FORMS = ['SPQ'];

// One storage and one kv for the whole test, so several chat messages share the deals, the seen set and the inbox.
function world() {
  const kv = memoryKv();
  const real = createRepository(memoryStorage());
  const counts = { saves: 0 };
  const repository = { get: id => real.get(id), save: d => { counts.saves++; return real.save(d); } };
  const inbox = createInboxStore(kv, { newTicketId: () => 'T-1' });
  const seenFields = createSeenFieldStore(kv);
  const common = {
    getSession: r => sessionFromRequest(r, env), limiter: createRateLimiter(kv), dailyCap: createDailyCap(kv, { cap: 1000 }),
    eventLog: createEventLog(memoryEventStore()), threads: createThreadStore(kv), repository, seenFields, inbox,
  };
  // One chat message in which the model makes `calls` ([name, input]) in order. Returns the parsed envelopes.
  async function say(role, dealId, calls) {
    const requests = [];
    const replies = [uses(...calls.map(([name, input], i) => use(`c${i}`, name, input))), ok('done')];
    const handler = createAgentHandler({ ...common, callModel: async req => {
      requests.push(structuredClone(req));
      return replies[Math.min(requests.length - 1, 1)];
    } });
    const cookie = `${cookieName}=${signSession({ role, sessionId: 's-1', dealId }, env)}`;
    assert.strictEqual((await handler(post(cookie))).status, 200);
    const raw = requests.at(-1).messages.at(-1).content.map(r => r.content);
    return { raw, es: raw.map(text => { try { return JSON.parse(text); } catch { return null; } }) };
  }
  return {
    say, counts, inbox, seenFields, repository: real,
    seen: (role, dealId) => seenFields.list({ dealId, sessionId: 's-1', role }),
    // The seeded deals are written first, so a later write cannot be overwritten by the store's first-load seeding.
    ready: Promise.all(Object.values(SEED_DEALS).map(d => real.save(structuredClone(d)))).then(() => { counts.saves = 0; }),
  };
}

const ROLES = ['broker', 'seller', 'buyer', 'lender'];
const noData = (text, deal) => {
  for (const s of [deal.city, deal.county, deal.address, deal.seller, 'forms', 'missing_fields', 'question']) {
    assert.ok(!text.includes(s), `the decline does not carry ${s}`);
  }
  for (const d of DOCS) assert.ok(!text.includes(`"${d.code}"`), `the decline names no form ${d.code}`);
};

test('Cottage Grove (San Jose) proceeds: get_deal, ask_next_question and save_answers all work', async () => {
  const w = world();
  await w.ready;
  const t = await w.say('broker', TESTED, [['get_deal', {}], askNext]);
  const [view, next] = t.es;
  assert.strictEqual(view.ok, true);
  assert.strictEqual(view.data.address, SEED_DEALS[TESTED].address);
  assert.ok(view.data.forms.length > 0 && view.field_names.length > 0);
  assert.strictEqual(next.ok, true);
  const name = next.data.question.field_name;
  const saved = await w.say('broker', TESTED, [save(name, 'x')]);
  assert.strictEqual(saved.es[0].ok, true, saved.raw[0]);
  assert.strictEqual((await w.repository.get(TESTED)).answers[name].v, 'x');
});

test('Austin returns the decline payload, and the payload holds no rules, no deal data and no city or county', async () => {
  for (const role of ROLES) {
    const w = world();
    await w.ready;
    // Only the tools this role is offered: a tool outside its list is refused before it runs.
    const calls = [dealTool(role), askNext, save('city', 'Austin')].filter(([name]) => toolsFor(role).includes(name));
    assert.ok(calls.length > 0, role);
    const t = await w.say(role, AUSTIN, calls);
    for (const [i, e] of t.es.entries()) {
      assert.deepStrictEqual(e, UNTESTED_JURISDICTION, `${role} call ${i}`);
      assert.strictEqual(e.ok, false);
      assert.strictEqual(e.error.code, 'UNTESTED_JURISDICTION');
      noData(t.raw[i], SEED_DEALS[AUSTIN]);
    }
    assert.deepStrictEqual(Object.keys(t.es[0]).sort(), ['error', 'ok']);
  }
});

test('the decline tells the model to have a transaction coordinator handle the deal and to stop', async () => {
  const w = world();
  await w.ready;
  const { es } = await w.say('broker', AUSTIN, [['get_deal', {}]]);
  assert.match(es[0].error.next_step, /transaction coordinator/i);
  assert.match(es[0].error.next_step, /stop/i);
});

test('a decline reads nothing into the seen set and saves nothing', async () => {
  const w = world();
  await w.ready;
  const before = await w.repository.get(AUSTIN);
  await w.say('broker', AUSTIN, [['get_deal', {}], askNext]);
  await w.say('seller', AUSTIN, [save('city', 'Austin')]);
  assert.deepStrictEqual(await w.seen('broker', AUSTIN), []);
  assert.deepStrictEqual(await w.seen('seller', AUSTIN), []);
  assert.strictEqual(w.counts.saves, 0);
  assert.deepStrictEqual(await w.repository.get(AUSTIN), before);
});

test('save_answers on Austin declines before the seen-name check: an unseen or invented name is not UNKNOWN_FIELD', async () => {
  const w = world();
  await w.ready;
  const t = await w.say('broker', AUSTIN, [save('school_district_disclosure', 'Yes')]);
  assert.strictEqual(t.es[0].error.code, 'UNTESTED_JURISDICTION');
  assert.ok(!t.raw[0].includes('school_district_disclosure'));
});

test('request_approval and hand_off decline for Austin and record nothing', async () => {
  const w = world();
  await w.ready;
  const t = await w.say('broker', AUSTIN, [
    ['request_approval', { to: 'seller', forms: SELLER_FORMS }],
    ['hand_off', { to: 'seller', forms: SELLER_FORMS }],
  ]);
  for (const e of t.es) assert.deepStrictEqual(e, UNTESTED_JURISDICTION);
  const stored = await w.repository.get(AUSTIN);
  assert.strictEqual(stored.approval_requests, undefined);
  assert.strictEqual(stored.handoffs, undefined);
  assert.strictEqual(w.counts.saves, 0);
});

test('request_approval still works for Cottage Grove', async () => {
  const w = world();
  await w.ready;
  const t = await w.say('broker', TESTED, [['request_approval', { to: 'seller', forms: SELLER_FORMS }]]);
  assert.strictEqual(t.es[0].ok, true, t.raw[0]);
  assert.strictEqual(t.es[0].data.status, 'requested');
});

test('ask_broker still works for an untested deal and stores the question under that deal', async () => {
  for (const role of ['seller', 'buyer', 'lender']) {
    const w = world();
    await w.ready;
    const t = await w.say(role, AUSTIN, [['ask_broker', { question: 'Who should handle this?' }]]);
    assert.deepStrictEqual(t.es[0], { ok: true, data: { ticket_id: 'T-1', status: 'queued' }, field_names: [] }, role);
    assert.strictEqual((await w.inbox.list(AUSTIN)).length, 1);
    assert.strictEqual((await w.inbox.list(TESTED)).length, 0);
  }
});

test('the deal comes from the session: a deal id in the arguments changes neither outcome', async () => {
  const w = world();
  await w.ready;
  const declined = await w.say('broker', AUSTIN, [['get_deal', { deal_id: TESTED, dealId: TESTED, transaction_id: TESTED, city: 'San Jose', county: 'Santa Clara' }]]);
  assert.deepStrictEqual(declined.es[0], UNTESTED_JURISDICTION);
  const proceeds = await w.say('broker', TESTED, [['get_deal', { deal_id: AUSTIN, dealId: AUSTIN, transaction_id: AUSTIN, city: 'Austin', county: 'Travis' }]]);
  assert.strictEqual(proceeds.es[0].ok, true);
  assert.strictEqual(proceeds.es[0].data.transaction_id, TESTED);
});

test('accent, case and spacing in the city do not matter; the county must match too', async () => {
  const cases = [
    ['San José', 'Santa Clara', true],
    ['  SAN JOSE ', 'santa clara', true],
    ['San Jose', 'Travis', false], // a tested city with the wrong county
    ['Austin', 'Santa Clara', false], // a tested county with the wrong city
    ['Berkeley', 'Alameda', false], // in the rules, in no CASE
  ];
  for (const [city, county, proceeds] of cases) {
    const w = world();
    await w.ready;
    await w.repository.save({ ...structuredClone(SEED_DEALS[TESTED]), city, county });
    const { es } = await w.say('broker', TESTED, [['get_deal', {}]]);
    if (proceeds) assert.strictEqual(es[0].ok, true, `${city}, ${county}`);
    else assert.deepStrictEqual(es[0], UNTESTED_JURISDICTION, `${city}, ${county}`);
  }
});

test('San Francisco and Los Angeles, the other tested cities, proceed', async () => {
  for (const [city, county] of [['San Francisco', 'San Francisco'], ['Los Angeles', 'Los Angeles']]) {
    const w = world();
    await w.ready;
    await w.repository.save({ ...structuredClone(SEED_DEALS[TESTED]), city, county });
    const { es } = await w.say('broker', TESTED, [['get_deal', {}]]);
    assert.strictEqual(es[0].ok, true, city);
  }
});
