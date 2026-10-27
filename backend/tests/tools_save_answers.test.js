// save_answers at the handler seam: a scripted fake model, memory storage, no network.
// One fact is saved through the shared rules and the repository; the role and the deal come from the cookie.
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
import { NO_DEAL, createTools } from '../tools.js';
import { DOCS, SEED_DEALS } from '../fixtures.js';
import { createEngine } from '../../rules.js';
import { canAccessForm } from '../roles.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const env = {};
const DEAL = 'TX-CG118';
const OTHER = 'tx_unknown_city';
const usage = { input_tokens: 1, output_tokens: 1 };
const ok = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const uses = (...blocks) => ({ content: blocks, stop_reason: 'tool_use', usage });

const cookieFor = (role, dealId = OTHER, sessionId = 's-1') =>
  `${cookieName}=${signSession({ role, sessionId, dealId }, env)}`;
const post = cookie => new Request('http://x/api/agent', {
  method: 'POST', body: JSON.stringify({ message: 'hi' }), headers: { 'content-type': 'application/json', cookie },
});

// A copy of a seeded deal with the given answers; a session can only name a seeded deal id.
const variant = (answers = {}, extra = {}) => ({
  ...structuredClone(SEED_DEALS[OTHER]), ...extra,
  answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, { v, src: 'test' }])),
});

const one = (field_name, value, extra = {}) => ({ answers: [{ field_name, value }], ...extra });

// Runs one chat message in which the model makes `calls` (tool inputs) in order. Returns the parsed
// results and the repository, so a test can look at what was stored.
async function run(role, calls, { deal = variant(), dealId = OTHER, name = 'save_answers', stub } = {}) {
  const storage = memoryStorage();
  const real = createRepository(storage);
  const repository = stub ?? real;
  if (deal) await real.save(deal);
  const kv = memoryKv();
  const seenFields = createSeenFieldStore(kv);
  const requests = [];
  const replies = [uses(...calls.map((input, i) => use(`c${i}`, name, input))), ok('done')];
  const handler = createAgentHandler({
    callModel: async req => { requests.push(structuredClone(req)); return replies[Math.min(requests.length - 1, 1)]; },
    getSession: r => sessionFromRequest(r, env),
    limiter: createRateLimiter(kv),
    dailyCap: createDailyCap(kv, { cap: 100 }),
    eventLog: createEventLog(memoryEventStore()),
    threads: createThreadStore(kv),
    repository,
    seenFields,
  });
  const res = await handler(post(cookieFor(role, dealId)));
  assert.strictEqual(res.status, 200);
  const results = requests.at(-1).messages.at(-1).content.map(r => ({ is_error: !!r.is_error, text: r.content }));
  const parse = r => { try { return JSON.parse(r.text); } catch { return null; } };
  return {
    results, envelopes: results.map(parse), e: parse(results[0]), repository, storage, seenFields,
    // A reload: a new repository on the same storage.
    reload: id => createRepository(storage).get(id),
  };
}

// What the shared rules do for the same answers on the same deal, computed directly.
function viaRules(deal, steps, src) {
  const d = structuredClone(deal);
  const engine = createEngine({ getAnswers: () => d.answers, getDeal: () => d, getDocs: () => DOCS });
  return { deal: d, results: steps.map(([k, v]) => engine.answer(k, v, src)) };
}

test('a valid answer is saved, survives a reload, and matches what the shared rules do', async () => {
  const before = variant();
  const t = await run('broker', [one('city', 'San José')], { deal: before });
  assert.strictEqual(t.e.ok, true);
  const expected = viaRules(before, [['city', 'San José']], 'Broker chat answer');
  const stored = await t.reload(OTHER);
  assert.strictEqual(stored.answers.city.v, 'San José');
  assert.deepStrictEqual(stored, expected.deal);
  const [r] = expected.results;
  assert.deepStrictEqual(t.e.data.forms_added, r.added);
  assert.deepStrictEqual(t.e.data.forms_removed, r.removed);
  assert.deepStrictEqual(t.e.data.forms_filled, r.filled);
  assert.deepStrictEqual(t.e.data.saved, { field_name: 'city', value: 'San José' });
});

test('derived values update: the county follows the city', async () => {
  const t = await run('broker', [one('city', 'San José')]);
  const stored = await t.reload(OTHER);
  assert.strictEqual(stored.answers.county.v, 'Santa Clara');
  assert.match(stored.answers.county.src, /^Derived/);
  assert.strictEqual(stored.county, 'Santa Clara');
});

test('answering twice replaces the earlier answer and the county follows', async () => {
  const before = variant();
  const t = await run('broker', [one('city', 'San José'), one('city', 'Los Angeles')], { deal: before });
  assert.deepStrictEqual(t.envelopes.map(e => e.ok), [true, true]);
  const stored = await t.reload(OTHER);
  assert.strictEqual(stored.answers.city.v, 'Los Angeles');
  assert.strictEqual(stored.answers.county.v, 'Los Angeles');
  assert.strictEqual(stored.county, 'Los Angeles');
  const expected = viaRules(before, [['city', 'San José'], ['city', 'Los Angeles']], 'Broker chat answer');
  assert.deepStrictEqual(stored, expected.deal);
  assert.deepStrictEqual(t.envelopes[1].data.forms_added, expected.results[1].added);
  assert.deepStrictEqual(t.envelopes[1].data.forms_removed, expected.results[1].removed);
  assert.ok(t.envelopes[1].data.forms_removed.length > 0, 'moving cities removes the first city\'s local forms');
});

test('the response lists forms added, removed and filled, and what is still missing', async () => {
  const t = await run('broker', [one('sellerType', 'Trust'), one('sellerType', 'Individual(s)')]);
  const [trust, individual] = t.envelopes;
  assert.ok(trust.data.forms_added.includes('RCSD-S') && trust.data.forms_added.includes('QS'));
  assert.ok(trust.data.forms_filled.includes('TDS'));
  assert.ok(individual.data.forms_removed.includes('RCSD-S') && individual.data.forms_removed.includes('QS'));
  assert.ok(Array.isArray(trust.data.missing_fields));
  // The missing list is the same one get_deal gives after the save.
  const tools = createTools({ repository: t.repository, seenFields: t.seenFields });
  const view = await tools.registry.get_deal.run({ turn: { dealId: OTHER, role: 'broker', sessionId: 's-1' }, args: {} });
  assert.deepStrictEqual(individual.data.missing_fields, view.data.missing_fields);
  assert.deepStrictEqual(individual.field_names.slice(0, 1), ['sellerType']);
});

test('what the seller is told is limited to the seller view', async () => {
  const t = await run('seller', [one('escrow', 'Chicago Title'), one('sellerType', 'Trust')]);
  for (const e of t.envelopes) {
    assert.strictEqual(e.ok, true);
    for (const code of [...e.data.forms_added, ...e.data.forms_removed, ...e.data.forms_filled]) {
      assert.ok(canAccessForm('seller', code), `${code} is outside the seller view`);
    }
  }
  assert.ok(!JSON.stringify(t.envelopes).includes('APPR'));
});

test('the seller cannot reach the lender\'s form through a fact: ROLE_FORBIDDEN, nothing saved', async () => {
  const before = variant();
  const t = await run('seller', [one('buyerFinancing', 'Yes, with a lender loan')], { deal: before });
  assert.strictEqual(t.e.ok, false);
  assert.strictEqual(t.e.error.code, 'ROLE_FORBIDDEN');
  assert.deepStrictEqual(await t.reload(OTHER), before);
  // The broker can: it sees APPR, and the answer adds it.
  const b = await run('broker', [one('buyerFinancing', 'Yes, with a lender loan')]);
  assert.strictEqual(b.e.ok, true);
  assert.deepStrictEqual(b.e.data.forms_added, ['APPR']);
});

test('role and deal come only from the session, never from the arguments', async () => {
  const dealB = await createRepository(memoryStorage()).get(DEAL);
  const t = await run('seller', [one('city', 'San José', { role: 'broker', deal_id: DEAL, transaction_id: DEAL })]);
  assert.strictEqual(t.e.ok, true);
  const a = await t.reload(OTHER);
  assert.strictEqual(a.answers.city.src, 'Seller chat answer', 'saved as the session\'s role, not the role in the args');
  assert.deepStrictEqual(await t.reload(DEAL), dealB, 'the deal named in the args was not touched');
});

test('the source is recorded for each role that saves', async () => {
  const seller = await run('seller', [one('claims', 'None')]);
  assert.strictEqual((await seller.reload(OTHER)).answers.claims.src, 'Seller chat answer');
  const broker = await run('broker', [one('claims', 'None')]);
  assert.strictEqual((await broker.reload(OTHER)).answers.claims.src, 'Broker chat answer');
});

test('only broker and seller are offered save_answers; a buyer or lender who calls it is refused', async () => {
  const tools = createTools({ repository: createRepository(memoryStorage()), seenFields: createSeenFieldStore(memoryKv()) });
  assert.ok(tools.forRole('broker').includes('save_answers'));
  assert.ok(tools.forRole('seller').includes('save_answers'));
  assert.ok(!tools.forRole('buyer').includes('save_answers'));
  assert.ok(!tools.forRole('lender').includes('save_answers'));
  for (const role of ['buyer', 'lender']) {
    const before = variant();
    const t = await run(role, [one('city', 'San José')], { deal: before });
    assert.strictEqual(t.results[0].is_error, true);
    assert.strictEqual(t.results[0].text, TOOL_NOT_ALLOWED);
    assert.deepStrictEqual(await t.reload(OTHER), before);
  }
});

test('bad arguments get one fixed line and save nothing', async () => {
  const bad = [
    {}, { answers: [] }, { answers: 'city' }, { answers: [{ field_name: 'city' }] },
    { answers: [{ field_name: 'city', value: '   ' }] }, { answers: [{ field_name: 7, value: 'x' }] },
    { answers: [{ field_name: 'city', value: 'San José' }, { field_name: 'seller', value: 'A' }] },
  ];
  const before = variant();
  const t = await run('broker', bad, { deal: before });
  assert.strictEqual(new Set(t.results.map(r => r.text)).size, 1, 'the same fixed text each time');
  assert.ok(t.results.every(r => r.is_error));
  assert.ok(!t.results[0].text.includes('city'), 'no argument is echoed back');
  assert.deepStrictEqual(await t.reload(OTHER), before);
});

test('a field name that is not a question is refused with fixed text and saves nothing', async () => {
  const before = variant();
  const t = await run('broker', [one('school_district_disclosure', 'Yes')], { deal: before });
  assert.strictEqual(t.results[0].is_error, true);
  assert.ok(!t.results[0].text.includes('school_district_disclosure'));
  assert.deepStrictEqual(await t.reload(OTHER), before);
});

test('a session whose deal has no file gets the fixed NOT_FOUND envelope and nothing is written', async () => {
  const saved = [];
  const stub = { get: async () => null, save: async d => { saved.push(d); } };
  const t = await run('broker', [one('city', 'San José')], { deal: null, stub });
  assert.deepStrictEqual(t.e, NO_DEAL);
  assert.deepStrictEqual(saved, []);
});

test('guard seam: a form in the approved snapshot refuses the write and the stored deal is unchanged', async () => {
  const before = variant({}, { approval: { snapshot: { forms: ['TDS'], approved_by: 'broker', approved_at: 'then' } } });
  const t = await run('broker', [one('defects', 'None known')], { deal: before });
  assert.strictEqual(t.e.ok, false);
  assert.strictEqual(t.e.error.code, 'POST_APPROVAL_CHANGE');
  assert.deepStrictEqual(await t.reload(OTHER), before);
});
