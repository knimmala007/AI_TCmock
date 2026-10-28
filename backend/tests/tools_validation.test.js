// Ticket 039: HUMAN_ATTESTATION_REQUIRED, INVALID_VALUE and FACT_CONFLICT in save_answers. Through the handler with a scripted
// fake model, memory storage, no network. The order after the write guards (037) is: attestation, document, option, conflict.
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
import {
  ATTESTATION_FIELDS, DOC_NOT_IN_CHAT, FACT_CONFLICT, HUMAN_ATTESTATION, INVALID_CHOICE, NO_QUESTIONS_LEFT, ONLY_UNCHATTABLE_LEFT,
} from '../tools.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const env = {};
const DEAL = 'TX-CG118'; // San Jose, a tested jurisdiction, with recorded facts (seller, apn, county, ...)
const SENTINEL = 'ZEBRA-7731';
const usage = { input_tokens: 1, output_tokens: 1 };
const ok = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const uses = (...blocks) => ({ content: blocks, stop_reason: 'tool_use', usage });
const post = cookie => new Request('http://x/api/agent', {
  method: 'POST', body: JSON.stringify({ message: 'hi' }), headers: { 'content-type': 'application/json', cookie },
});

const one = (field_name, value) => ['save_answers', { answers: [{ field_name, value }] }];
const many = (...facts) => ['save_answers', { answers: facts.map(([field_name, value]) => ({ field_name, value })) }];
const GOOD = 'Yes, compliant'; // an option of the three seller certifications
const AT = { approved_by: 'broker', approved_at: '2026-10-28T10:00:00.000Z' };
const lock = { reason: 'awaiting_signature', set_by: 'server', set_at: '2026-10-28T10:00:00.000Z' };

// A deal on the seeded Cottage Grove record. answers: {key: value | {v, src}}; data: recorded facts to add or replace.
const dealWith = ({ answers = {}, data = {}, approval, locks } = {}) => {
  const d = structuredClone(SEED_DEALS[DEAL]);
  d.answers = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, typeof v === 'object' ? v : { v, src: 'test' }]));
  Object.assign(d.data, data);
  if (approval) d.approval = approval;
  if (locks) d.locks = locks;
  return d;
};
const engineOf = deal => createEngine({ getAnswers: () => deal.answers || {}, getDeal: () => deal, getDocs: () => DOCS });
const QUESTIONS = engineOf(dealWith()).QUESTIONS;
const qOf = k => QUESTIONS.find(q => q.k === k);
const validValue = q => (q.type === 'choice' ? q.options[0] : 'x');

// One storage and kv per world. Every question name is already in the seen set, so these tests are about the value checks.
async function world(deal = dealWith()) {
  const kv = memoryKv();
  const real = createRepository(memoryStorage());
  for (const d of Object.values(SEED_DEALS)) await real.save(structuredClone(d)); // seed first, so a later save is not overwritten
  await real.save(deal);
  const counts = { saves: 0 };
  const repository = { get: id => real.get(id), save: d => { counts.saves++; return real.save(d); } };
  const seenFields = createSeenFieldStore(kv);
  const common = {
    getSession: r => sessionFromRequest(r, env), limiter: createRateLimiter(kv), dailyCap: createDailyCap(kv, { cap: 1000 }),
    eventLog: createEventLog(memoryEventStore()), threads: createThreadStore(kv), repository, seenFields,
  };
  async function say(role, calls) {
    await seenFields.add({ dealId: DEAL, sessionId: 's-1', role }, QUESTIONS.map(q => q.k));
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

// A refusal envelope exactly as the constant, nothing stored, nothing saved, and no echo of what was sent.
async function assertRefusedAs(w, t, constant, before, { echo = [] } = {}) {
  assert.deepStrictEqual(t.es[0], constant, t.raw[0]);
  assert.strictEqual(t.es[0].ok, false);
  assert.ok(t.es[0].error.next_step.length > 0);
  assert.deepStrictEqual(await w.stored(), before, 'the stored deal is unchanged');
  assert.strictEqual(w.counts.saves, 0, 'nothing was saved');
  for (const s of echo) assert.ok(!t.raw[0].includes(s), `the reply does not contain ${s}`);
}

// ---- A. attestation: HUMAN_ATTESTATION_REQUIRED ----

test('a broker cannot save any of the three seller certifications: HUMAN_ATTESTATION_REQUIRED, nothing stored', async () => {
  for (const k of ATTESTATION_FIELDS) {
    const w = await world();
    const before = await w.stored();
    const t = await w.say('broker', [one(k, GOOD)]);
    await assertRefusedAs(w, t, HUMAN_ATTESTATION, before, { echo: [k] });
  }
});

test('the refusal does not depend on the value: an invalid value from a broker is still HUMAN_ATTESTATION_REQUIRED', async () => {
  const w = await world();
  const before = await w.stored();
  const t = await w.say('broker', [one('waterHeater', SENTINEL)]);
  await assertRefusedAs(w, t, HUMAN_ATTESTATION, before, { echo: [SENTINEL, 'waterHeater'] });
});

test('a broker cannot copy or overwrite a seller\'s stored certification', async () => {
  const stored = { v: GOOD, src: 'Seller chat answer' };
  const w = await world(dealWith({ answers: { waterHeater: stored, smokeAlarm: stored } }));
  const before = await w.stored();
  for (const [k, v] of [['waterHeater', 'No, needs correction before close'], ['waterHeater', GOOD], ['smokeAlarm', 'No, needs correction before close']]) {
    const t = await w.say('broker', [one(k, v)]);
    assert.deepStrictEqual(t.es[0], HUMAN_ATTESTATION, `${k} = ${v}`);
  }
  assert.deepStrictEqual(await w.stored(), before);
  assert.strictEqual(w.counts.saves, 0);
});

test('in a batch the attestation fact is refused per fact and the others are still saved', async () => {
  const w = await world();
  const t = await w.say('broker', [many(['waterHeater', GOOD], ['escrow', 'Bay Escrow'])]);
  const r = t.es[0].data.results;
  assert.deepStrictEqual([r[0].index, r[0].ok, r[0].error.code], [0, false, 'HUMAN_ATTESTATION_REQUIRED']);
  assert.deepStrictEqual([r[1].index, r[1].ok], [1, true]);
  const stored = await w.stored();
  assert.strictEqual(stored.answers.escrow.v, 'Bay Escrow');
  assert.ok(!stored.answers.waterHeater);
  assert.deepStrictEqual(Object.keys(r[0]).sort(), ['error', 'index', 'ok'], 'the refused entry carries no field name');
});

test('the seller can save them, and the source is the seller\'s chat answer', async () => {
  for (const k of ATTESTATION_FIELDS) {
    const w = await world();
    const t = await w.say('seller', [one(k, GOOD)]);
    assert.strictEqual(t.es[0].ok, true, `${k}: ${t.raw[0]}`);
    assert.deepStrictEqual((await w.stored()).answers[k], { v: GOOD, src: 'Seller chat answer' });
  }
});

test('the role comes from the session: a seller role in the arguments does not let a broker save one', async () => {
  const w = await world();
  const before = await w.stored();
  const t = await w.say('broker', [['save_answers', {
    answers: [{ field_name: 'waterHeater', value: GOOD }], role: 'seller', deal_id: DEAL, as: 'seller',
  }]]);
  await assertRefusedAs(w, t, HUMAN_ATTESTATION, before);
});

test('an aliased or respelled name is not the field: UNKNOWN_FIELD, nothing stored', async () => {
  const w = await world();
  const before = await w.stored();
  for (const name of ['WaterHeater', 'water_heater', 'waterheater', 'water heater', 'waterHeater ']) {
    const t = await w.say('broker', [one(name, GOOD)]);
    if (name === 'waterHeater ') continue; // trimmed to the real name: covered by the refusal above
    assert.strictEqual(t.es[0].error.code, 'UNKNOWN_FIELD', name);
  }
  assert.deepStrictEqual(await w.stored(), before);
});

test('answering any other question never creates or changes a certification, as seller or broker', async () => {
  const stored = { v: GOOD, src: 'Seller chat answer' };
  for (const role of ['broker', 'seller']) {
    for (const q of QUESTIONS) {
      if (ATTESTATION_FIELDS.includes(q.k)) continue;
      const w = await world(dealWith({ answers: { smokeAlarm: stored } }));
      await w.say(role, [one(q.k, validValue(q))]);
      const after = (await w.stored()).answers;
      assert.deepStrictEqual(after.smokeAlarm, stored, `${role} ${q.k}`);
      for (const k of ['waterHeater', 'coDetector']) assert.ok(!after[k], `${role} ${q.k} created ${k}`);
    }
  }
});

test('the other tools never write an answer', async () => {
  const w = await world();
  const before = (await w.stored()).answers;
  await w.say('broker', [['request_approval', { to: 'seller', forms: ['SPQ'] }], ['hand_off', { to: 'seller', forms: ['SPQ'] }], ['get_deal', {}], ['ask_next_question', {}]]);
  assert.deepStrictEqual((await w.stored()).answers, before);
});

test('the write guards answer first: a certification on an approved form is POST_APPROVAL_CHANGE, on a locked form FORM_LOCKED', async () => {
  const approved = await world(dealWith({ approval: { snapshot: { forms: ['WHSD'], ...AT } } }));
  const a = await approved.say('broker', [one('waterHeater', GOOD)]);
  assert.strictEqual(a.es[0].error.code, 'POST_APPROVAL_CHANGE');
  assert.strictEqual((await approved.stored()).answers.waterHeater, undefined);

  const locked = await world(dealWith({ locks: { WHSD: lock } }));
  const l = await locked.say('broker', [one('waterHeater', GOOD)]);
  assert.strictEqual(l.es[0].error.code, 'FORM_LOCKED');
  assert.strictEqual((await locked.stored()).answers.waterHeater, undefined);
});

// ---- B. INVALID_VALUE ----

test('a choice question rejects a value that is not one of its options, with the fixed text and no echo', async () => {
  const w = await world();
  const before = await w.stored();
  const t = await w.say('broker', [one('sellerType', SENTINEL)]);
  await assertRefusedAs(w, t, INVALID_CHOICE, before, { echo: [SENTINEL, 'sellerType'] });
});

test('the option must match exactly: another case or spelling is INVALID_VALUE, and surrounding spaces are trimmed', async () => {
  for (const [k, v] of [['city', 'San Jose'], ['city', 'san josé'], ['sellerType', 'trust'], ['buyerFinancing', 'Yes']]) {
    const w = await world();
    const t = await w.say('broker', [one(k, v)]);
    assert.deepStrictEqual(t.es[0], INVALID_CHOICE, `${k} = ${v}`);
  }
  const w = await world();
  const t = await w.say('broker', [one('sellerType', '  Trust  ')]);
  assert.strictEqual(t.es[0].ok, true, t.raw[0]);
  assert.strictEqual((await w.stored()).answers.sellerType.v, 'Trust');
});

test('every option of every choice question is accepted for a broker', async () => {
  for (const q of QUESTIONS.filter(x => x.type === 'choice' && !ATTESTATION_FIELDS.includes(x.k))) {
    for (const option of q.options) {
      const w = await world();
      const t = await w.say('broker', [one(q.k, option)]);
      assert.notStrictEqual(t.es[0].error && t.es[0].error.code, 'INVALID_VALUE', `${q.k} = ${option}: ${t.raw[0]}`);
    }
  }
});

test('a text question takes any non-empty value: the engine has no format to check', async () => {
  const w = await world();
  const t = await w.say('broker', [one('escrow', SENTINEL)]);
  assert.strictEqual(t.es[0].ok, true, t.raw[0]);
  assert.strictEqual((await w.stored()).answers.escrow.v, SENTINEL);
});

test('a document question cannot be answered in chat: INVALID_VALUE with its own text, and the zone answers are not created', async () => {
  const docs = QUESTIONS.filter(q => q.type === 'doc').map(q => q.k);
  assert.ok(docs.includes('hazards') && docs.includes('permitHistory'));
  for (const role of ['broker', 'seller']) {
    for (const k of docs) {
      const w = await world();
      const before = await w.stored();
      const t = await w.say(role, [one(k, SENTINEL)]);
      await assertRefusedAs(w, t, DOC_NOT_IN_CHAT, before, { echo: [SENTINEL, k] });
      assert.notDeepStrictEqual(t.es[0], INVALID_CHOICE, 'its own message, not the options message');
    }
  }
});

test('a refused document question is never returned by ask_next_question afterwards', async () => {
  for (const role of ['broker', 'seller']) {
    const w = await world();
    await w.say(role, [one('hazards', 'Received'), one('permitHistory', 'Received')]);
    // Walk the whole interview: answer what is asked, in a fresh world each time, and never see a document question.
    const asked = [];
    let answers = {};
    for (let i = 0; i < 80; i++) {
      const fresh = await world(dealWith({ answers }));
      const { es } = await fresh.say(role, [['ask_next_question', {}]]);
      if (es[0].data.done) break;
      const k = es[0].data.question.field_name;
      asked.push(k);
      answers = { ...answers, [k]: 'x' };
    }
    assert.ok(asked.length > 5);
    assert.ok(!asked.includes('hazards') && !asked.includes('permitHistory'), `${role}: ${asked.join()}`);
  }
});

test('when only questions chat cannot ask remain, the done message says so and does not claim everything is answered', async () => {
  for (const role of ['broker', 'seller']) {
    let answers = {};
    let last;
    for (let i = 0; i < 80; i++) {
      const w = await world(dealWith({ answers }));
      last = (await w.say(role, [['ask_next_question', {}]])).es[0];
      if (last.data.done) break;
      answers = { ...answers, [last.data.question.field_name]: 'x' };
    }
    assert.strictEqual(last.data.done, true, role);
    assert.strictEqual(last.data.message, ONLY_UNCHATTABLE_LEFT, role);
    assert.notStrictEqual(last.data.message, NO_QUESTIONS_LEFT);
  }
});

test('when the documents are in too, every question is answered and the message says so', async () => {
  const everything = Object.fromEntries(QUESTIONS.map(q => [q.k, 'x']));
  const w = await world(dealWith({ answers: everything }));
  const { es } = await w.say('seller', [['ask_next_question', {}]]);
  assert.strictEqual(es[0].data.message, NO_QUESTIONS_LEFT);
});

// ---- C. FACT_CONFLICT ----

const RECORDED = SEED_DEALS[DEAL].data.seller; // a recorded fact from a document: { v, src }

test('a value that differs from a recorded fact is FACT_CONFLICT; the reply shows neither value', async () => {
  assert.ok(RECORDED && !/chat|Derived/.test(RECORDED.src));
  for (const role of ['broker', 'seller']) {
    const w = await world();
    const before = await w.stored();
    const t = await w.say(role, [one('seller', SENTINEL)]);
    await assertRefusedAs(w, t, FACT_CONFLICT, before, { echo: [SENTINEL, String(RECORDED.v), 'seller"'] });
  }
});

test('the same value is not a conflict, whatever its case or accents, and it changes nothing: the source is kept', async () => {
  for (const value of [RECORDED.v, String(RECORDED.v).toUpperCase(), `  ${RECORDED.v}  `]) {
    const w = await world();
    const before = await w.stored();
    const t = await w.say('broker', [one('seller', value)]);
    assert.strictEqual(t.es[0].ok, true, `${value}: ${t.raw[0]}`);
    assert.strictEqual(t.es[0].data.saved.field_name, 'seller');
    assert.deepStrictEqual(await w.stored(), before, 'nothing was written');
    assert.strictEqual(w.counts.saves, 0, 'and nothing was saved');
  }
});

test('a protected fact cannot be replaced in two steps: confirming it keeps its source, so a different value still conflicts', async () => {
  const w = await world();
  await w.say('broker', [one('seller', RECORDED.v)]);
  const t = await w.say('broker', [one('seller', SENTINEL)]);
  assert.deepStrictEqual(t.es[0], FACT_CONFLICT);
  assert.deepStrictEqual((await w.stored()).data.seller, RECORDED);
});

test('an answer from the broker\'s intake form or an uploaded document is protected the same way', async () => {
  for (const src of ['Broker intake', 'Uploaded document']) {
    const w = await world(dealWith({ answers: { apn: { v: '111-22-333', src } } }));
    const before = await w.stored();
    const t = await w.say('broker', [one('apn', '999-99-999')]);
    await assertRefusedAs(w, t, FACT_CONFLICT, before, { echo: ['111-22-333', '999-99-999'] });
    const same = await w.say('broker', [one('apn', '111-22-333')]);
    assert.strictEqual(same.es[0].ok, true, src);
    assert.deepStrictEqual((await w.stored()).answers.apn, { v: '111-22-333', src }, 'source kept');
  }
});

test('a chat answer is replaced by a later chat answer, from either role; the earlier value is not kept', async () => {
  for (const [first, second, role, src] of [
    ['Seller chat answer', 'B', 'broker', 'Broker chat answer'],
    ['Broker chat answer', 'B', 'seller', 'Seller chat answer'],
    ['Chat answer', 'B', 'broker', 'Broker chat answer'],
  ]) {
    const w = await world(dealWith({ answers: { escrow: { v: 'A', src: first } } }));
    const t = await w.say(role, [one('escrow', second)]);
    assert.strictEqual(t.es[0].ok, true, `${first}: ${t.raw[0]}`);
    assert.deepStrictEqual((await w.stored()).answers.escrow, { v: second, src }, 'replaced, and no earlier value is kept');
  }
});

test('a derived answer is overwritten by the rules: moving the city moves the county', async () => {
  // county is asked only while it has no answer (rules.js), so a derived county is replaced by the rules, not by a chat answer.
  const derived = { v: 'Santa Clara', src: 'Derived from parties & property' };
  const moved = await world(dealWith({ answers: { city: 'San José', county: derived } }));
  const m = await moved.say('broker', [one('city', 'Los Angeles')]);
  assert.strictEqual(m.es[0].ok, true, m.raw[0]);
  assert.strictEqual((await moved.stored()).answers.county.v, 'Los Angeles');
});

test('a recorded fact whose source is a chat answer or derived is not protected', async () => {
  for (const src of ['Seller chat answer', 'Broker chat answer', 'Chat answer', 'Derived from parties & property']) {
    const w = await world(dealWith({ data: { seller: { v: 'Recorded Name', src } } }));
    const t = await w.say('broker', [one('seller', 'Another Name')]);
    assert.strictEqual(t.es[0].ok, true, `${src}: ${t.raw[0]}`);
    assert.strictEqual((await w.stored()).answers.seller.v, 'Another Name');
  }
});

test('a recorded value that is not one of a choice question\'s options is not compared', async () => {
  const recorded = SEED_DEALS[DEAL].data.waterHeater;
  assert.ok(recorded && !qOf('waterHeater').options.includes(recorded.v));
  const w = await world();
  const t = await w.say('seller', [one('waterHeater', GOOD)]);
  assert.strictEqual(t.es[0].ok, true, t.raw[0]);
});

test('an answer whose derived value contradicts a typed value is a conflict (county Alameda, then city San José)', async () => {
  const w = await world(dealWith({ answers: { county: { v: 'Alameda', src: 'Broker chat answer' } } }));
  const before = await w.stored();
  const t = await w.say('broker', [one('city', 'San José')]);
  await assertRefusedAs(w, t, FACT_CONFLICT, before);

  const agree = await world(dealWith({ answers: { county: { v: 'Santa Clara', src: 'Broker chat answer' } } }));
  const a = await agree.say('broker', [one('city', 'San José')]);
  assert.strictEqual(a.es[0].ok, true, a.raw[0]);
});

test('KNOWN GAP (reminder): a recorded fact stored under another key (escrow is escrowCo) is not compared', async () => {
  const w = await world(dealWith({ data: { escrowCo: { v: 'Recorded Escrow Co', src: 'Title company record' } } }));
  const t = await w.say('broker', [one('escrow', 'Another Escrow Co')]);
  assert.strictEqual(t.es[0].ok, true, `today the write is allowed: ${t.raw[0]}`);
});

test('the comparison ignores case and accents but not formatting: "Gonzalez, Maria" against "Maria Gonzalez" conflicts', async () => {
  const w = await world(dealWith({ data: { seller: { v: 'Maria Gonzalez', src: 'Title report' } } }));
  assert.deepStrictEqual((await w.say('broker', [one('seller', 'Gonzalez, Maria')])).es[0], FACT_CONFLICT);
  assert.strictEqual((await w.say('broker', [one('seller', 'maría gonzalez')])).es[0].ok, true);
});

// ---- D. batch ----

test('a batch reports an invalid value, a conflict with an earlier fact, and a wrong-role attestation per fact', async () => {
  // No recorded county, so the county typed in this call is the fact the later city contradicts.
  const w = await world(dealWith({ data: { county: undefined } }));
  const t = await w.say('broker', [many(
    ['escrow', 'Bay Escrow'], // 0 saved
    ['sellerType', SENTINEL], // 1 not an option
    ['county', 'Alameda'], // 2 saved
    ['city', 'San José'], // 3 its derived county (Santa Clara) contradicts the county typed in fact 2
    ['waterHeater', GOOD], // 4 a broker cannot state it
  )]);
  const e = t.es[0];
  assert.strictEqual(e.ok, true, t.raw[0]);
  assert.deepStrictEqual(e.data.results.map(r => [r.index, r.ok, r.error && r.error.code]), [
    [0, true, undefined], [1, false, 'INVALID_VALUE'], [2, true, undefined], [3, false, 'FACT_CONFLICT'], [4, false, 'HUMAN_ATTESTATION_REQUIRED'],
  ]);
  const stored = await w.stored();
  assert.deepStrictEqual([stored.answers.escrow.v, stored.answers.county.v], ['Bay Escrow', 'Alameda']);
  for (const k of ['sellerType', 'city', 'waterHeater']) assert.ok(!stored.answers[k], `${k} was not stored`);
  assert.strictEqual(w.counts.saves, 1, 'one save for the batch');
  assert.ok(!t.raw[0].includes(SENTINEL), 'the value is not echoed');
  for (const r of e.data.results.filter(x => !x.ok)) assert.deepStrictEqual(Object.keys(r).sort(), ['error', 'index', 'ok']);
});

test('a name twice in one call rejects the whole call with one fixed error and stores nothing', async () => {
  const w = await world();
  const before = await w.stored();
  const t = await w.say('broker', [many(['escrow', 'A'], ['escrow', 'B'])]);
  assert.strictEqual(t.es[0], null, 'a fixed text error, not an envelope');
  assert.ok(!t.raw[0].includes('escrow'));
  assert.deepStrictEqual(await w.stored(), before);
  assert.strictEqual(w.counts.saves, 0);
});

test('a batch where every fact is refused stores nothing and returns the first refusal', async () => {
  const w = await world();
  const before = await w.stored();
  const t = await w.say('broker', [many(['sellerType', SENTINEL], ['waterHeater', GOOD], ['seller', SENTINEL])]);
  await assertRefusedAs(w, t, INVALID_CHOICE, before);
});

test('precedence inside one fact: attestation, then document, then option, then conflict', async () => {
  const w = await world(dealWith({ answers: { apn: { v: '111', src: 'Broker intake' } } }));
  assert.deepStrictEqual((await w.say('broker', [one('waterHeater', SENTINEL)])).es[0], HUMAN_ATTESTATION);
  assert.deepStrictEqual((await w.say('seller', [one('hazards', SENTINEL)])).es[0], DOC_NOT_IN_CHAT);
  assert.deepStrictEqual((await w.say('broker', [one('sellerType', SENTINEL)])).es[0], INVALID_CHOICE);
  assert.deepStrictEqual((await w.say('broker', [one('apn', SENTINEL)])).es[0], FACT_CONFLICT);
  // A value that is both not an option and different from a protected answer is reported as not an option.
  const both = await world(dealWith({ answers: { sellerType: { v: 'Trust', src: 'Broker intake' } } }));
  assert.deepStrictEqual((await both.say('broker', [one('sellerType', SENTINEL)])).es[0], INVALID_CHOICE);
});

test('a fact that passes the value checks is still refused by the write guards first (a locked form)', async () => {
  const w = await world(dealWith({ locks: { SPQ: lock } }));
  const t = await w.say('broker', [one('repairs', 'None')]);
  assert.strictEqual(t.es[0].error.code, 'FORM_LOCKED');
});
