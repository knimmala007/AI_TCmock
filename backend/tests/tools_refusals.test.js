// Ticket 037: the write refusals of save_answers (ROLE_FORBIDDEN, FORM_NOT_REQUIRED, POST_APPROVAL_CHANGE, FORM_LOCKED),
// their order, and what a role learns. Through the handler with a scripted fake model, memory storage, no network.
//
// The order as built (owner decision, ticket 037): role, then "the question applies to this deal" (askable, the code
// FORM_NOT_REQUIRED), then, per form the fact feeds and the role may see, the approved snapshot and the lock. The per-form
// check is form-major: the first form (in the engine's required-form order) that is refused decides the code.
import test from 'node:test';
import assert from 'node:assert';
import { memoryKv } from '../kv.js';
import { createDailyCap, createRateLimiter } from '../limits.js';
import { createEventLog, memoryEventStore } from '../events.js';
import { createSeenFieldStore, createThreadStore } from '../threads.js';
import { createRepository, memoryStorage } from '../repository.js';
import { cookieName, sessionFromRequest, signSession } from '../session.js';
import { createAgentHandler } from '../agent_handler.js';
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
const DEAL = 'TX-CG118'; // San Jose, a tested jurisdiction
const usage = { input_tokens: 1, output_tokens: 1 };
const ok = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const uses = (...blocks) => ({ content: blocks, stop_reason: 'tool_use', usage });
const post = cookie => new Request('http://x/api/agent', {
  method: 'POST', body: JSON.stringify({ message: 'hi' }), headers: { 'content-type': 'application/json', cookie },
});

const hasTemplate = code => DOCS.some(d => d.code === code);
const AT = { approved_by: 'broker', approved_at: '2026-10-28T10:00:00.000Z' };
const snapshot = (...forms) => ({ snapshot: { forms, ...AT } });
const lock = (reason = 'awaiting_signature') => ({ reason, set_by: 'server', set_at: '2026-10-28T10:00:00.000Z' });
const answersOf = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { v, src: 'test' }]));
const one = (field_name, value = 'x') => ['save_answers', { answers: [{ field_name, value }] }];

// An engine over a deal, to read what the rules say (which forms are required, which question applies).
const engineOf = deal => createEngine({ getAnswers: () => deal.answers || {}, getDeal: () => deal, getDocs: () => DOCS });
const dealWith = ({ answers = {}, approval, locks } = {}) => ({
  ...structuredClone(SEED_DEALS[DEAL]), answers: answersOf(answers),
  ...(approval ? { approval } : {}), ...(locks ? { locks } : {}),
});

// One storage and kv per world. Every field name is already in the session's seen set, so these tests are about the
// write refusals and not the field-name guard (ticket 036).
async function world(deal = dealWith()) {
  const kv = memoryKv();
  const real = createRepository(memoryStorage());
  for (const d of Object.values(SEED_DEALS)) await real.save(structuredClone(d)); // seed first: a later save cannot be overwritten
  await real.save(deal);
  const counts = { saves: 0 };
  const repository = { get: id => real.get(id), save: d => { counts.saves++; return real.save(d); } };
  const seenFields = createSeenFieldStore(kv);
  const common = {
    getSession: r => sessionFromRequest(r, env), limiter: createRateLimiter(kv), dailyCap: createDailyCap(kv, { cap: 1000 }),
    eventLog: createEventLog(memoryEventStore()), threads: createThreadStore(kv), repository, seenFields,
  };
  const names = engineOf(deal).QUESTIONS.map(q => q.k);
  async function say(role, calls) {
    await seenFields.add({ dealId: DEAL, sessionId: 's-1', role }, names);
    const requests = [];
    const replies = [uses(...calls.map(([name, input], i) => use(`c${i}`, name, input))), ok('done')];
    const handler = createAgentHandler({ ...common, callModel: async req => {
      requests.push(structuredClone(req));
      return replies[Math.min(requests.length - 1, 1)];
    } });
    const cookie = `${cookieName}=${signSession({ role, sessionId: 's-1', dealId: DEAL }, env)}`;
    assert.strictEqual((await handler(post(cookie))).status, 200);
    const raw = requests.at(-1).messages.at(-1).content.map(r => r.content);
    return { raw, es: raw.map(text => { try { return JSON.parse(text); } catch { return null; } }) };
  }
  return { say, counts, stored: () => real.get(DEAL) };
}

// A refusal: ok false, the code, a next step, and nothing stored.
async function assertRefused(w, t, code, before, label = code) {
  const e = t.es[0];
  assert.strictEqual(e.ok, false, label);
  assert.strictEqual(e.error.code, code, `${label}: ${t.raw[0]}`);
  assert.ok(typeof e.error.next_step === 'string' && e.error.next_step.length > 0, `${label}: the reply carries a next step`);
  assert.deepStrictEqual(await w.stored(), before, `${label}: the stored deal is unchanged`);
  assert.strictEqual(w.counts.saves, 0, `${label}: nothing was saved`);
}

// Facts the tests use. Each is checked against the rules in the test that uses it.
const TWO_FORM_FACT = 'repairs'; // feeds TDS and SPQ on this deal, both required and templated
const ESCROW = 'escrow'; // feeds EMD, QS, CLOSE, PTR: none required yet
const FINANCING = 'buyerFinancing'; // feeds APPR only: not required until answered, and a lender-side form

test('FORM_NOT_REQUIRED does not fire for escrow or buyerFinancing: they can be saved first, though their forms are not required yet', async () => {
  const engine = engineOf(dealWith());
  for (const k of [ESCROW, FINANCING]) {
    const q = engine.QUESTIONS.find(x => x.k === k);
    assert.ok(engine.askable(q), `${k} applies to this deal`);
    assert.ok(!q.fills.some(c => engine.requiredForms().includes(c)), `${k}: none of its forms is required yet`);
  }
  for (const [role, k, value] of [['broker', ESCROW, 'Bay Escrow'], ['broker', FINANCING, 'No, all cash'], ['seller', ESCROW, 'Bay Escrow']]) {
    const w = await world();
    const t = await w.say(role, [one(k, value)]);
    assert.strictEqual(t.es[0].ok, true, `${role} ${k}: ${t.raw[0]}`);
    assert.strictEqual((await w.stored()).answers[k].v, value);
  }
});

test('FORM_NOT_REQUIRED fires for leaseEnd and permits: the question does not apply, even though a form it feeds is required', async () => {
  const engine = engineOf(dealWith());
  for (const k of ['leaseEnd', 'permits']) {
    const q = engine.QUESTIONS.find(x => x.k === k);
    assert.ok(!engine.askable(q), `${k} does not apply to this deal`);
    assert.ok(q.fills.some(c => engine.requiredForms().includes(c)), `${k} feeds a required form`);
    for (const role of ['broker', 'seller']) {
      const w = await world();
      const before = await w.stored();
      const t = await w.say(role, [one(k, 'ZEBRA-7731')]);
      await assertRefused(w, t, 'FORM_NOT_REQUIRED', before, `${role} ${k}`);
      assert.match(t.es[0].error.message, /does not apply/);
      assert.ok(!t.raw[0].includes('ZEBRA-7731') && !t.raw[0].includes(k), 'the value and the name tried are not echoed');
    }
  }
});

test('ROLE_FORBIDDEN fires when the role may see none of the forms the fact feeds; nothing is saved', async () => {
  const w = await world();
  const before = await w.stored();
  const t = await w.say('seller', [one(FINANCING, 'No, all cash')]);
  await assertRefused(w, t, 'ROLE_FORBIDDEN', before);
  assert.ok(!canAccessForm('seller', 'APPR'));
});

test('a role learns nothing about a form it may not touch: a lock and a snapshot on it change nothing in the reply', async () => {
  const plain = await world();
  const guarded = await world(dealWith({ approval: snapshot('APPR'), locks: { APPR: lock('pending_approval') } }));
  const a = await plain.say('seller', [one(FINANCING, 'No, all cash')]);
  const b = await guarded.say('seller', [one(FINANCING, 'No, all cash')]);
  assert.strictEqual(b.es[0].error.code, 'ROLE_FORBIDDEN');
  assert.deepStrictEqual(b.es[0], a.es[0], 'the same envelope with or without a lock and a snapshot on the form');
  for (const s of ['APPR', 'pending approval', 'pending_approval', 'snapshot', 'reopen', 'locked']) {
    assert.ok(!b.raw[0].toLowerCase().includes(s.toLowerCase()), `the reply does not mention ${s}`);
  }
});

test('ROLE_FORBIDDEN comes before everything else', async () => {
  // The seller cannot see APPR, and APPR is both approved and locked: the role check still answers first.
  const w = await world(dealWith({ approval: snapshot('APPR', 'SPQ'), locks: { APPR: lock(), SPQ: lock() } }));
  const t = await w.say('seller', [one(FINANCING)]);
  assert.strictEqual(t.es[0].error.code, 'ROLE_FORBIDDEN');
});

test('FORM_NOT_REQUIRED comes before the snapshot and the lock', async () => {
  const w = await world(dealWith({ approval: snapshot('SPQ'), locks: { SPQ: lock() } }));
  const before = await w.stored();
  const t = await w.say('broker', [one('leaseEnd')]); // feeds SPQ, which is both approved and locked
  await assertRefused(w, t, 'FORM_NOT_REQUIRED', before);
});

test('POST_APPROVAL_CHANGE fires for a fact that feeds an approved form; the next step is the broker reopening it', async () => {
  const engine = engineOf(dealWith());
  const fills = engine.QUESTIONS.find(x => x.k === TWO_FORM_FACT).fills;
  assert.ok(fills.includes('TDS') && fills.includes('SPQ'));
  for (const role of ['broker', 'seller']) {
    const w = await world(dealWith({ approval: snapshot('TDS') }));
    const before = await w.stored();
    const t = await w.say(role, [one(TWO_FORM_FACT)]);
    await assertRefused(w, t, 'POST_APPROVAL_CHANGE', before, role);
    assert.match(t.es[0].error.next_step, /reopen/i);
  }
});

test('POST_APPROVAL_CHANGE fires only in its situation: a fact that feeds no approved form is saved', async () => {
  const w = await world(dealWith({ approval: snapshot('EQ') }));
  const t = await w.say('broker', [one('pool', 'No')]); // feeds TDS and SPQ, neither approved
  assert.strictEqual(t.es[0].ok, true, t.raw[0]);
  assert.strictEqual((await w.stored()).answers.pool.v, 'No');
});

test('FORM_LOCKED fires for a fact that feeds a locked form, for either lock reason; the next step is to wait', async () => {
  for (const reason of ['awaiting_signature', 'pending_approval']) {
    const w = await world(dealWith({ locks: { SPQ: lock(reason) } }));
    const before = await w.stored();
    const t = await w.say('broker', [one(TWO_FORM_FACT)]);
    await assertRefused(w, t, 'FORM_LOCKED', before, reason);
    assert.match(t.es[0].error.next_step, /wait/i);
  }
});

test('FORM_LOCKED fires only in its situation: a lock on a form the fact does not feed changes nothing', async () => {
  const w = await world(dealWith({ locks: { EQ: lock() } }));
  const t = await w.say('broker', [one('pool', 'No')]);
  assert.strictEqual(t.es[0].ok, true, t.raw[0]);
});

test('the snapshot comes before the lock, on the same form', async () => {
  const w = await world(dealWith({ approval: snapshot('SPQ'), locks: { SPQ: lock() } }));
  const before = await w.stored();
  const t = await w.say('broker', [one(TWO_FORM_FACT)]);
  await assertRefused(w, t, 'POST_APPROVAL_CHANGE', before);
});

test('a fact feeding two forms, one locked and one approved, is refused either way; the first form in the required order decides the code', async () => {
  const deal = dealWith();
  const engine = engineOf(deal);
  const fills = engine.QUESTIONS.find(x => x.k === TWO_FORM_FACT).fills;
  const [first, second] = engine.requiredForms().filter(c => fills.includes(c) && hasTemplate(c));
  assert.ok(first && second, 'two required, templated forms');

  const lockedFirst = await world(dealWith({ approval: snapshot(second), locks: { [first]: lock() } }));
  const beforeA = await lockedFirst.stored();
  await assertRefused(lockedFirst, await lockedFirst.say('broker', [one(TWO_FORM_FACT)]), 'FORM_LOCKED', beforeA, 'lock on the first form');

  const approvedFirst = await world(dealWith({ approval: snapshot(first), locks: { [second]: lock() } }));
  const beforeB = await approvedFirst.stored();
  await assertRefused(approvedFirst, await approvedFirst.say('broker', [one(TWO_FORM_FACT)]), 'POST_APPROVAL_CHANGE', beforeB, 'snapshot on the first form');
});

test('every refusal has a next step, and none echoes the value, the field name or a form the model named', async () => {
  const cases = [
    ['broker', 'leaseEnd', dealWith(), 'FORM_NOT_REQUIRED'],
    ['seller', FINANCING, dealWith(), 'ROLE_FORBIDDEN'],
    ['broker', TWO_FORM_FACT, dealWith({ approval: snapshot('TDS') }), 'POST_APPROVAL_CHANGE'],
    ['broker', TWO_FORM_FACT, dealWith({ locks: { TDS: lock() } }), 'FORM_LOCKED'],
  ];
  for (const [role, k, deal, code] of cases) {
    const w = await world(deal);
    const before = await w.stored();
    // The arguments also name a role, a deal and a form: none of them is read.
    const t = await w.say(role, [['save_answers', {
      answers: [{ field_name: k, value: 'ZEBRA-7731' }], role: 'broker', deal_id: 'tx_unknown_city', dealId: 'tx_unknown_city', form: 'EQ',
    }]]);
    await assertRefused(w, t, code, before, `${role} ${k}`);
    assert.ok(!t.raw[0].includes('ZEBRA-7731'), 'the value is not echoed');
    assert.ok(!t.raw[0].includes(k), 'the field name is not echoed');
    assert.ok(!t.raw[0].includes('tx_unknown_city'), 'the deal named in the arguments is not echoed');
  }
});

test('in a batch, a refused fact is reported by position and the others are still saved (the 036 shape)', async () => {
  const w = await world(dealWith({ locks: { SPQ: lock() } }));
  const t = await w.say('broker', [['save_answers', { answers: [
    { field_name: TWO_FORM_FACT, value: 'ZEBRA-7731' }, // feeds the locked SPQ
    { field_name: 'listingAgent', value: 'Pat Lee' }, // feeds AVID, BCA, ABA, RLA
  ] }]]);
  const e = t.es[0];
  assert.strictEqual(e.ok, true, t.raw[0]);
  assert.deepStrictEqual([e.data.results[0].index, e.data.results[0].ok, e.data.results[0].error.code], [0, false, 'FORM_LOCKED']);
  assert.deepStrictEqual([e.data.results[1].index, e.data.results[1].ok], [1, true]);
  const stored = await w.stored();
  assert.strictEqual(stored.answers.listingAgent.v, 'Pat Lee');
  assert.ok(!stored.answers[TWO_FORM_FACT], 'the refused fact is not stored');
});

test('a batch where every fact is refused stores nothing and returns the first refusal', async () => {
  const w = await world(dealWith({ locks: { SPQ: lock() } }));
  const before = await w.stored();
  const t = await w.say('broker', [['save_answers', { answers: [{ field_name: 'leaseEnd', value: 'x' }, { field_name: TWO_FORM_FACT, value: 'x' }] }]]);
  await assertRefused(w, t, 'FORM_NOT_REQUIRED', before);
});

// ---- the checks hold for every question, not only the ones above ----

test('with every required form approved, a fact is refused exactly when it feeds a required, templated form its role may see', async () => {
  const deal = dealWith();
  const engine = engineOf(deal);
  const required = engine.requiredForms();
  for (const role of ['broker', 'seller']) {
    for (const q of engine.QUESTIONS) {
      if (!engine.askable(q)) continue;
      const accessible = (q.fills || []).filter(c => canAccessForm(role, c));
      if (!accessible.length) continue; // ROLE_FORBIDDEN, tested above
      const feeds = accessible.some(c => required.includes(c) && hasTemplate(c));
      const w = await world(dealWith({ approval: snapshot(...required) }));
      const t = await w.say(role, [one(q.k)]);
      const code = t.es[0].error && t.es[0].error.code;
      assert.strictEqual(code === 'POST_APPROVAL_CHANGE', feeds, `${role} ${q.k}: ${t.raw[0]}`);
    }
  }
});

test('with every required form locked, a fact is refused exactly when it feeds a required, templated form its role may see', async () => {
  const deal = dealWith();
  const engine = engineOf(deal);
  const required = engine.requiredForms();
  const locks = Object.fromEntries(required.map(c => [c, lock()]));
  for (const role of ['broker', 'seller']) {
    for (const q of engine.QUESTIONS) {
      if (!engine.askable(q)) continue;
      const accessible = (q.fills || []).filter(c => canAccessForm(role, c));
      if (!accessible.length) continue;
      const feeds = accessible.some(c => required.includes(c) && hasTemplate(c));
      const w = await world(dealWith({ locks }));
      const t = await w.say(role, [one(q.k)]);
      const code = t.es[0].error && t.es[0].error.code;
      assert.strictEqual(code === 'FORM_LOCKED', feeds, `${role} ${q.k}: ${t.raw[0]}`);
    }
  }
});

// ---- known gaps: these pass today and document today's behaviour. They are NOT the behaviour we want. ----

// KNOWN GAP (ticket 046): the snapshot and lock checks look only at the forms the fact feeds. An answer can also change
// WHICH forms are required, so a form in an approved snapshot can stop being required without any guard firing. Nothing
// writes a snapshot yet, so this cannot happen in the app today. Ticket 046 (freeze and reopen) must decide what happens
// when a write changes the required set while a snapshotted form drops out: refuse the write, or void the snapshot.
// When it does, these two tests change with it. Found by trying every question and option against the rules: other
// examples drop only untemplated forms (HOA, LA-9A and others), which are flag-only.
test('KNOWN GAP (ticket 046): answering solar can drop SOLAR from the required forms without feeding it, while SOLAR is approved', async () => {
  const deal = dealWith({ answers: { solar: 'Leased or PPA' }, approval: snapshot('SOLAR') });
  const engine = engineOf(deal);
  assert.ok(engine.requiredForms().includes('SOLAR'), 'SOLAR is required while solar is "Leased or PPA"');
  assert.ok(!engine.QUESTIONS.find(q => q.k === 'solar').fills.includes('SOLAR'), 'the solar question does not feed SOLAR (it feeds TDS)');

  const w = await world(deal);
  const t = await w.say('broker', [one('solar', 'Owned outright')]);
  assert.strictEqual(t.es[0].ok, true, `today the write is allowed: ${t.raw[0]}`);
  const after = await w.stored();
  assert.ok(!engineOf(after).requiredForms().includes('SOLAR'), 'SOLAR is no longer required');
  assert.ok(after.approval.snapshot.forms.includes('SOLAR'), 'and it is still in the approved snapshot');
});

test('KNOWN GAP (ticket 046): answering city "Other / unincorporated" can drop SJ-TREE from the required forms without feeding it, while SJ-TREE is approved', async () => {
  const deal = dealWith({ answers: { city: 'San José' }, approval: snapshot('SJ-TREE') });
  const engine = engineOf(deal);
  assert.ok(engine.requiredForms().includes('SJ-TREE'), 'SJ-TREE is required in San José');
  assert.ok(!engine.QUESTIONS.find(q => q.k === 'city').fills.includes('SJ-TREE'), 'the city question does not feed SJ-TREE (it feeds TDS, AVID, NHD)');

  const w = await world(deal);
  const t = await w.say('broker', [one('city', 'Other / unincorporated')]);
  assert.strictEqual(t.es[0].ok, true, `today the write is allowed: ${t.raw[0]}`);
  const after = await w.stored();
  assert.ok(!engineOf(after).requiredForms().includes('SJ-TREE'), 'SJ-TREE is no longer required');
  assert.ok(after.approval.snapshot.forms.includes('SJ-TREE'), 'and it is still in the approved snapshot');
});
