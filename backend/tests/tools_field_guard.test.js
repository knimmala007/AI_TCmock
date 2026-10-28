// Ticket 036: save_answers takes only field names this session was shown, and at most MAX_FACTS_PER_SAVE facts a call.
// Through the handler with a scripted fake model, memory storage, no network.
import test from 'node:test';
import assert from 'node:assert';
import { memoryKv } from '../kv.js';
import { createDailyCap, createRateLimiter } from '../limits.js';
import { createEventLog, memoryEventStore } from '../events.js';
import { createSeenFieldStore, createThreadStore } from '../threads.js';
import { createRepository, memoryStorage } from '../repository.js';
import { cookieName, sessionFromRequest, signSession } from '../session.js';
import { createAgentHandler } from '../agent_handler.js';
import { MAX_FACTS_PER_SAVE } from '../config.js';
import { SEED_DEALS, DOCS } from '../fixtures.js';
import { createEngine } from '../../rules.js';
import { createTools } from '../tools.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

// Ticket 038: the seeded Austin deal is an untested jurisdiction, so these tests keep its data and set a tested city.
const TESTED_CITY = { city: 'San Jose', county: 'Santa Clara' };
const env = {};
const DEAL = 'tx_unknown_city';
const usage = { input_tokens: 1, output_tokens: 1 };
const ok = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const uses = (...blocks) => ({ content: blocks, stop_reason: 'tool_use', usage });
const one = (field_name, value) => ({ field_name, value });
const batch = (...answers) => ({ answers });
const post = cookie => new Request('http://x/api/agent', {
  method: 'POST', body: JSON.stringify({ message: 'hi' }), headers: { 'content-type': 'application/json', cookie },
});

// A session: one storage and one kv, so several chat messages share the deal and the seen set.
function session({ role = 'broker', sessionId = 's-1', answers = {}, ctx } = {}) {
  const c = ctx ?? (() => {
    const storage = memoryStorage();
    const real = createRepository(storage);
    const kv = memoryKv();
    const counts = { gets: 0, saves: 0 };
    const repository = { get: id => { counts.gets++; return real.get(id); }, save: d => { counts.saves++; return real.save(d); } };
    return { storage, real, kv, counts, repository, seenFields: createSeenFieldStore(kv), ready: null };
  })();
  const deal = { ...structuredClone(SEED_DEALS[DEAL]), ...TESTED_CITY, answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, { v, src: 'test' }])) };
  c.ready ??= c.real.save(deal);
  const scope = { dealId: DEAL, sessionId, role };
  // One chat message in which the model makes `calls` ([name, input]) in order; returns the parsed results.
  async function say(calls) {
    await c.ready;
    const requests = [];
    const replies = [uses(...calls.map(([name, input], i) => use(`c${i}`, name, input))), ok('done')];
    const handler = createAgentHandler({
      callModel: async req => { requests.push(structuredClone(req)); return replies[Math.min(requests.length - 1, 1)]; },
      getSession: r => sessionFromRequest(r, env),
      limiter: createRateLimiter(c.kv),
      dailyCap: createDailyCap(c.kv, { cap: 100 }),
      eventLog: createEventLog(memoryEventStore()),
      threads: createThreadStore(c.kv),
      repository: c.repository,
      seenFields: c.seenFields,
    });
    const cookie = `${cookieName}=${signSession({ role, sessionId, dealId: DEAL }, env)}`;
    const res = await handler(post(cookie));
    assert.strictEqual(res.status, 200);
    const results = requests.at(-1).messages.at(-1).content.map(r => ({ is_error: !!r.is_error, text: r.content }));
    const parse = r => { try { return JSON.parse(r.text); } catch { return null; } };
    return { results, es: results.map(parse), e: parse(results[0]) };
  }
  return { ...c, scope, say, stored: async () => { await c.ready; return c.real.get(DEAL); }, seen: () => c.seenFields.list(scope) };
}

const save = input => ['save_answers', input];
const askNext = ['ask_next_question', {}];
const getDeal = ['get_deal', {}];

test('a valid question name the session was never shown is refused with UNKNOWN_FIELD, and nothing is stored', async () => {
  const s = session();
  const before = await s.stored();
  const t = await s.say([save(batch(one('city', 'San José')))]);
  assert.strictEqual(t.results[0].is_error, true);
  assert.strictEqual(t.e.error.code, 'UNKNOWN_FIELD');
  assert.match(t.e.error.message, /get_deal or ask_next_question first/, 'nothing seen yet: no list, just where to start');
  assert.ok(!t.results[0].text.includes('city'), 'the name that was tried is not echoed');
  assert.deepStrictEqual(await s.stored(), before);
  assert.strictEqual(s.counts.saves, 0);
});

test('the same name is accepted once ask_next_question has returned it', async () => {
  const s = session();
  const asked = await s.say([askNext]);
  const name = asked.e.data.question.field_name;
  assert.deepStrictEqual(await s.seen(), [name]);
  const t = await s.say([save(batch(one(name, 'x')))]);
  assert.notStrictEqual(t.e.error && t.e.error.code, 'UNKNOWN_FIELD', JSON.stringify(t.e));
  assert.strictEqual(t.e.ok, true, JSON.stringify(t.e));
  assert.strictEqual((await s.stored()).answers[name].v, 'x');
});

test('the invented name school_district_disclosure is refused and the list holds only names already given', async () => {
  const s = session();
  const dealView = await s.say([getDeal]);
  const given = dealView.e.field_names;
  assert.ok(given.length > 0);
  const t = await s.say([save(batch(one('school_district_disclosure', 'Yes')))]);
  assert.strictEqual(t.e.error.code, 'UNKNOWN_FIELD');
  const text = t.results[0].text;
  assert.ok(!text.includes('school_district_disclosure'), 'the invented name is not echoed');
  for (const n of given) assert.ok(text.includes(n), `${n} was given, so it is listed`);
  // A real question the session never received is not listed either: the list is the seen set, not the question list.
  const never = createEngine({ getAnswers: () => ({}), getDeal: () => SEED_DEALS[DEAL], getDocs: () => DOCS })
    .QUESTIONS.map(q => q.k).filter(k => !given.includes(k));
  assert.ok(never.length > 5);
  for (const n of never) assert.ok(!text.includes(`${n},`) && !text.includes(`${n}.`) && !text.includes(`, ${n}`), `${n} was never given`);
});

test('a name that is never received never appears in any error', async () => {
  const s = session();
  const names = ['school_district_disclosure', 'city', 'claims', 'hoaName'];
  const t = await s.say([getDeal, ...names.map(n => save(batch(one(n, 'x')))), save(batch(...names.map(n => one(n, 'x'))))]);
  for (const r of t.results.slice(1)) for (const n of ['school_district_disclosure', 'claims', 'hoaName']) {
    assert.ok(!r.text.includes(n), `${n} leaked into an error`);
  }
});

test('the seen set is per session and per role: another session\'s names do not count', async () => {
  const s = session({ sessionId: 's-1' });
  await s.say([askNext]);
  const name = (await s.seen())[0];
  const other = session({ ctx: s, sessionId: 's-2' });
  const t = await other.say([save(batch(one(name, 'x')))]);
  assert.strictEqual(t.e.error.code, 'UNKNOWN_FIELD');
  const seller = session({ ctx: s, role: 'seller', sessionId: 's-1' });
  const u = await seller.say([save(batch(one(name, 'x')))]);
  assert.strictEqual(u.e.error.code, 'UNKNOWN_FIELD');
});

test('hoaName is never shown to anyone: not by get_deal, not by ask_next_question', async () => {
  for (const role of ['broker', 'seller']) {
    const repository = createRepository(memoryStorage());
    const deal = { ...structuredClone(SEED_DEALS[DEAL]), ...TESTED_CITY, answers: { propertyType: { v: 'Condominium', src: 'test' } } };
    await repository.save(deal);
    const tools = createTools({ repository, seenFields: createSeenFieldStore(memoryKv()) });
    const turn = { dealId: DEAL, role, sessionId: 's-1' };
    assert.ok(createEngine({ getAnswers: () => ({}), getDeal: () => deal, getDocs: () => DOCS }).QUESTIONS.some(x => x.k === 'hoaName'));
    assert.ok(!(await tools.registry.get_deal.run({ turn, args: {} })).field_names.includes('hoaName'), role);
    for (let i = 0; i < 60; i++) {
      const n = await tools.registry.ask_next_question.run({ turn, args: {} });
      const f = n.data.question && n.data.question.field_name;
      if (!f) break;
      assert.notStrictEqual(f, 'hoaName', role);
      const d = await repository.get(DEAL);
      d.answers[f] = { v: 'x', src: 'test' };
      await repository.save(d);
    }
  }
});

// ---- the batch cap and the argument checks: refused before anything is read or written ----

test('more than the cap, an empty batch, and the same name twice are refused with one fixed line, before any read or write', async () => {
  const s = session();
  await s.say([askNext]); // seeds the ready deal and one seen name
  const name = (await s.seen())[0];
  const over = Array.from({ length: MAX_FACTS_PER_SAVE + 1 }, (_, i) => one(`field_${i}`, 'x'));
  const reads = s.counts.gets;
  const t = await s.say([save({ answers: over }), save({ answers: [] }), save(batch(one(name, 'x'), one(name, 'y')))]);
  assert.ok(t.results.every(r => r.is_error));
  assert.strictEqual(new Set(t.results.map(r => r.text)).size, 1);
  assert.ok(!t.results[0].text.includes('field_0') && !t.results[0].text.includes(name));
  assert.strictEqual(s.counts.gets, reads, 'the deal was not read');
  assert.strictEqual(s.counts.saves, 0);
});

test('exactly the cap is accepted: one result per fact and one save', async () => {
  const s = session({ role: 'broker' });
  const keys = createEngine({ getAnswers: () => ({}), getDeal: () => SEED_DEALS[DEAL], getDocs: () => DOCS })
    .QUESTIONS.map(q => q.k).slice(0, MAX_FACTS_PER_SAVE);
  assert.strictEqual(keys.length, MAX_FACTS_PER_SAVE);
  await s.seenFields.add(s.scope, keys);
  const t = await s.say([save(batch(...keys.map(k => one(k, 'x'))))]);
  assert.strictEqual(t.e.ok, true, JSON.stringify(t.e));
  assert.strictEqual(t.e.data.results.length, MAX_FACTS_PER_SAVE);
  assert.strictEqual(s.counts.saves, 1);
  const refused = t.e.data.results.filter(r => !r.ok);
  assert.ok(t.e.data.results.some(r => r.ok));
  for (const r of refused) assert.ok(r.error.code && r.error.message && r.error.next_step);
});

test('a batch stores the facts that pass, reports each fact by position, and saves once', async () => {
  const s = session();
  await s.seenFields.add(s.scope, ['city', 'claims']);
  const t = await s.say([save(batch(one('city', 'San José'), one('school_district_disclosure', 'Yes'), one('claims', 'None')))]);
  assert.strictEqual(t.e.ok, true);
  assert.deepStrictEqual(t.e.data.results.map(r => r.ok), [true, false, true]);
  assert.deepStrictEqual(t.e.data.results.map(r => r.index), [0, 1, 2]);
  assert.strictEqual(t.e.data.results[1].error.code, 'UNKNOWN_FIELD');
  assert.ok(!t.results[0].text.includes('school_district_disclosure'));
  const stored = await s.stored();
  assert.strictEqual(stored.answers.city.v, 'San José');
  assert.strictEqual(stored.answers.county.v, 'Santa Clara', 'derived values follow, as in a single save');
  assert.strictEqual(stored.answers.claims.v, 'None');
  assert.strictEqual(s.counts.saves, 1);
});

test('each fact is checked against the deal as the earlier facts left it: a batch equals the same saves one by one', async () => {
  const facts = [one('city', 'Los Angeles'), one('sellerType', 'Trust')];
  const together = session();
  await together.seenFields.add(together.scope, ['city', 'sellerType']);
  const t = await together.say([save(batch(...facts))]);
  const apart = session();
  await apart.seenFields.add(apart.scope, ['city', 'sellerType']);
  const u = await apart.say(facts.map(f => save(batch(f))));
  const pick = ({ forms_added, forms_removed, forms_filled, flagged_forms }) => ({ forms_added, forms_removed, forms_filled, flagged_forms });
  assert.deepStrictEqual(t.e.data.results.map(r => pick(r)), u.es.map(e => pick(e.data)));
  assert.deepStrictEqual(await together.stored(), await apart.stored());
  assert.strictEqual(together.counts.saves, 1);
  assert.strictEqual(apart.counts.saves, 2);
});

test('nothing stored: ok false with the first refusal\'s error, and nothing is written', async () => {
  const s = session({ answers: { propertyType: 'Condominium' } });
  await s.seenFields.add(s.scope, ['city', 'hoaName']); // hoaName is refused with NO_TEMPLATE, a different error from the first
  const before = await s.stored();
  const t = await s.say([save(batch(one('nope_a', 'x'), one('hoaName', 'x')))]);
  assert.strictEqual(t.results[0].is_error, true);
  assert.strictEqual(t.e.ok, false);
  assert.strictEqual(t.e.error.code, 'UNKNOWN_FIELD');
  assert.ok(t.e.error.message.includes('city'));
  assert.ok(!t.results[0].text.includes('nope_'));
  assert.deepStrictEqual(await s.stored(), before);
  assert.strictEqual(s.counts.saves, 0);
});

test('a fact in a batch cannot make another fact seen', async () => {
  const s = session();
  await s.seenFields.add(s.scope, ['city']);
  const t = await s.say([save(batch(one('city', 'San José'), one('claims', 'None')))]);
  assert.deepStrictEqual(t.e.data.results.map(r => r.ok), [true, false]);
  assert.strictEqual(t.e.data.results[1].error.code, 'UNKNOWN_FIELD');
  assert.strictEqual((await s.stored()).answers.claims, undefined);
});

test('a single-fact call still returns the one-fact shape', async () => {
  const s = session();
  await s.seenFields.add(s.scope, ['city']);
  const t = await s.say([save(batch(one('city', 'San José')))]);
  assert.deepStrictEqual(t.e.data.saved, { field_name: 'city', value: 'San José' });
  assert.ok(!('results' in t.e.data));
});
