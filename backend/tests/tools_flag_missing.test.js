// flag_missing at the handler seam: a scripted fake model, memory storage, no network (ticket 040, ADR 0013).
// A read-only broker report. The role and the deal come from the cookie only; arguments are never read.
import test from 'node:test';
import assert from 'node:assert';
import { memoryKv } from '../kv.js';
import { createDailyCap, createRateLimiter } from '../limits.js';
import { createEventLog, memoryEventStore } from '../events.js';
import { createSeenFieldStore, createThreadStore } from '../threads.js';
import { createRepository, memoryStorage } from '../repository.js';
import { cookieName, sessionFromRequest, signSession } from '../session.js';
import { createAgentHandler } from '../agent_handler.js';
import { REPEAT_CALL_REPLY, TOOL_NOT_ALLOWED } from '../agent_loop.js';
import { ATTESTATION_FIELDS, NO_DEAL, UNTESTED_JURISDICTION, createTools } from '../tools.js';
import { DOCS, QUESTIONS, SEED_DEALS } from '../fixtures.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const env = {};
const DEAL = 'TX-CG118'; // Cottage Grove
const OTHER = 'tx_unknown_city'; // seeded in Austin: untested
const usage = { input_tokens: 1, output_tokens: 1 };
const ok = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const uses = (...blocks) => ({ content: blocks, stop_reason: 'tool_use', usage });

const cookieFor = (role, dealId = DEAL, sessionId = 's-1') =>
  `${cookieName}=${signSession({ role, sessionId, dealId }, env)}`;
const post = cookie => new Request('http://x/api/agent', {
  method: 'POST', body: JSON.stringify({ message: 'hi' }), headers: { 'content-type': 'application/json', cookie },
});

function setup(replies, { deals = [], repository } = {}) {
  const kv = memoryKv();
  const repo = repository ?? createRepository(memoryStorage());
  const seenFields = createSeenFieldStore(kv);
  const requests = [];
  const callModel = async req => {
    requests.push(structuredClone(req));
    return replies[Math.min(requests.length - 1, replies.length - 1)];
  };
  const handler = createAgentHandler({
    callModel,
    getSession: r => sessionFromRequest(r, env),
    limiter: createRateLimiter(kv),
    dailyCap: createDailyCap(kv, { cap: 100 }),
    eventLog: createEventLog(memoryEventStore()),
    threads: createThreadStore(kv),
    repository: repo,
    seenFields,
  });
  return { handler, requests, repo, seenFields, ready: Promise.all(deals.map(d => repo.save(d))) };
}

const resultsOf = requests => requests.at(-1).messages.at(-1).content;

// One flag_missing call (with `args`) as `role` against `dealId`; returns the parsed envelope and the request log.
async function callFlag(role, args = {}, { dealId = DEAL, deals = [] } = {}) {
  const t = setup([uses(use('f1', 'flag_missing', args)), ok('done')], { deals });
  await t.ready;
  const res = await t.handler(post(cookieFor(role, dealId)));
  assert.strictEqual(res.status, 200);
  const [result] = resultsOf(t.requests);
  return { ...t, result, env: JSON.parse(result.content) };
}

// A deal saved under another id so a test can change it: Cottage Grove data, with the given edits.
const variant = (edit = d => d) => {
  const d = structuredClone(SEED_DEALS[DEAL]);
  d.transaction_id = OTHER;
  return edit(d) ?? d;
};
const formOf = (e, code) => e.data.forms.find(f => f.code === code);
const namesIn = form => form.missing.map(m => m.field_name);
const questionKeys = new Set(QUESTIONS.map(q => q.k));

test('Cottage Grove: permitHistory and tenancyStatus are missing, as never received, with the upload and note', async () => {
  const { env: e, result } = await callFlag('broker');
  assert.strictEqual(result.is_error, undefined);
  assert.strictEqual(e.ok, true);
  const spq = formOf(e, 'SPQ');
  const never = Object.fromEntries(spq.missing.filter(m => m.never_received).map(m => [m.field_name, m.never_received]));
  const expected = Object.fromEntries(SEED_DEALS[DEAL].never_received.map(n => [n.field, { upload: n.upload, note: n.note }]));
  assert.deepStrictEqual(never, expected);
  assert.ok(namesIn(spq).includes('permitHistory'));
  assert.ok(namesIn(spq).includes('tenancyStatus'));
  assert.ok(e.field_names.includes('permitHistory') && e.field_names.includes('tenancyStatus'));
});

test('per form: {code, name, missing}, only forms with a gap, each gap a DOCS field with no value on the deal', async () => {
  const { env: e } = await callFlag('broker');
  const data = SEED_DEALS[DEAL].data;
  assert.ok(e.data.forms.length > 0);
  for (const f of e.data.forms) {
    const doc = DOCS.find(d => d.code === f.code);
    assert.deepStrictEqual(Object.keys(f).sort(), ['code', 'missing', 'name']);
    assert.strictEqual(f.name, doc.name);
    assert.ok(f.missing.length > 0);
    for (const m of f.missing) {
      assert.ok(doc.fields.includes(m.field_name));
      assert.ok(!data[m.field_name], `${m.field_name} has a value on the deal`);
      assert.ok(Object.keys(m).every(k => ['field_name', 'never_received'].includes(k)));
    }
    // Every DOCS field with no value is listed: nothing is skipped.
    assert.deepStrictEqual(namesIn(f).sort(), doc.fields.filter(n => !data[n]).sort());
  }
  assert.ok(!e.data.forms.some(f => DOCS.find(d => d.code === f.code).fields.every(n => data[n])));
});

test('a field with no never-received entry has no never_received key', async () => {
  const { env: e } = await callFlag('broker');
  const named = new Set(SEED_DEALS[DEAL].never_received.map(n => n.field));
  for (const m of e.data.forms.flatMap(f => f.missing)) {
    assert.strictEqual('never_received' in m, named.has(m.field_name), m.field_name);
  }
});

test('field_names is every missing name, once', async () => {
  const { env: e } = await callFlag('broker');
  const all = e.data.forms.flatMap(f => namesIn(f));
  assert.deepStrictEqual([...e.field_names].sort(), [...new Set(all)].sort());
});

test('no value is invented: a filled field is never listed, and a value saved on the deal removes the gap', async () => {
  const deal = variant(d => { d.data.permitHistory = { v: 'Roof 2019', src: 'test' }; });
  const { env: e, result } = await callFlag('broker', {}, { dealId: OTHER, deals: [deal] });
  assert.ok(!e.field_names.includes('permitHistory'));
  assert.ok(e.field_names.includes('tenancyStatus'));
  assert.ok(!result.content.includes('Roof 2019'));
  for (const m of e.data.forms.flatMap(f => f.missing)) assert.ok(!('v' in m) && !('value' in m));
});

test('tenancyStatus is not a question key, so it is reported but never offered to save_answers', async () => {
  assert.ok(!questionKeys.has('tenancyStatus'));
  const t = setup([
    uses(use('f1', 'flag_missing', {})),
    uses(use('s1', 'save_answers', { answers: [{ field_name: 'tenancyStatus', value: 'Owner-occupied' }] })),
    ok('done'),
  ]);
  await t.handler(post(cookieFor('broker')));
  const scope = { dealId: DEAL, sessionId: 's-1', role: 'broker' };
  const seen = await t.seenFields.list(scope);
  assert.ok(!seen.includes('tenancyStatus'));
  const [saved] = resultsOf(t.requests);
  const refused = JSON.parse(saved.content);
  assert.strictEqual(refused.ok, false);
  assert.strictEqual(refused.error.code, 'UNKNOWN_FIELD');
  assert.ok(!refused.error.message.includes('tenancyStatus'));
  // Nothing was stored.
  assert.deepStrictEqual((await t.repo.get(DEAL)).answers, SEED_DEALS[DEAL].answers);
});

test('the seen set holds the missing names that are questions, and never a seller certification', async () => {
  const deal = variant(d => { for (const n of ATTESTATION_FIELDS) delete d.data[n]; });
  const { env: e, seenFields } = await callFlag('broker', {}, { dealId: OTHER, deals: [deal] });
  // coDetector is on no DOCS form today, so only the certifications on a form can be missing.
  const onForms = ATTESTATION_FIELDS.filter(n => DOCS.some(d => d.fields.includes(n)));
  assert.ok(onForms.length > 0);
  for (const n of onForms) assert.ok(e.field_names.includes(n), `${n} is missing`);
  const seen = await seenFields.list({ dealId: OTHER, sessionId: 's-1', role: 'broker' });
  assert.deepStrictEqual([...seen].sort(), e.field_names.filter(n => questionKeys.has(n) && !ATTESTATION_FIELDS.includes(n)).sort());
  assert.ok(seen.includes('permitHistory'));
});

test('unanswered seller certifications are listed as awaiting the seller', async () => {
  const none = await callFlag('broker');
  assert.deepStrictEqual(none.env.data.awaiting_seller, []);

  const deal = variant(d => { delete d.data.waterHeater; delete d.data.smokeAlarm; });
  const { env: e } = await callFlag('broker', {}, { dealId: OTHER, deals: [deal] });
  assert.deepStrictEqual(e.data.awaiting_seller, ['waterHeater', 'smokeAlarm']);
  // Only fields on a form of the package count: the third certification is on none today.
  assert.ok(!e.data.awaiting_seller.includes('coDetector'));
});

test('a required form with no template is listed by code only, with no missing list', async () => {
  const deal = variant(d => { d.answers = { city: { v: 'Berkeley', src: 'test' } }; });
  const { env: e } = await callFlag('broker', {}, { dealId: OTHER, deals: [deal] });
  assert.ok(e.data.flagged_forms.length > 0);
  for (const code of e.data.flagged_forms) {
    assert.strictEqual(typeof code, 'string');
    assert.ok(!DOCS.some(d => d.code === code));
    assert.ok(!e.data.forms.some(f => f.code === code));
  }
  // The full deal has no untemplated required form to flag.
  assert.deepStrictEqual((await callFlag('broker')).env.data.flagged_forms, []);
});

test('read-only: the deal is not changed and nothing is saved', async () => {
  const saves = [];
  const inner = createRepository(memoryStorage());
  await inner.save(structuredClone(SEED_DEALS[DEAL]));
  const repository = { get: id => inner.get(id), save: async d => { saves.push(d); return inner.save(d); } };
  const before = JSON.stringify(await inner.get(DEAL));
  const t = setup([uses(use('f1', 'flag_missing', {})), ok('done')], { repository });
  await t.handler(post(cookieFor('broker')));
  assert.strictEqual(saves.length, 0);
  assert.strictEqual(JSON.stringify(await inner.get(DEAL)), before);
});

test('the result is redacted: an email or phone in a note or a value never reaches the model', async () => {
  const deal = variant(d => {
    d.never_received[0].note = 'Ask pat@example.com or 415-555-0100';
    d.data.seller = { v: 'Pat pat@example.com', src: 'test' };
  });
  const { result, env: e } = await callFlag('broker', {}, { dealId: OTHER, deals: [deal] });
  assert.ok(!result.content.includes('pat@example.com'));
  assert.ok(!result.content.includes('415-555-0100'));
  assert.ok(formOf(e, 'SPQ').missing.find(m => m.field_name === 'permitHistory').never_received.note.includes('[REDACTED]'));
});

test('the seller, buyer and lender are not offered it, and a call is the fixed refusal', async () => {
  for (const role of ['seller', 'buyer', 'lender']) {
    const t = setup([uses(use('f1', 'flag_missing', {})), ok('done')]);
    await t.handler(post(cookieFor(role)));
    assert.ok(!t.requests[0].tools.some(x => x.name === 'flag_missing'), role);
    const [r] = resultsOf(t.requests);
    assert.strictEqual(r.is_error, true);
    assert.strictEqual(r.content, TOOL_NOT_ALLOWED);
  }
  const broker = setup([ok('hi')]);
  await broker.handler(post(cookieFor('broker')));
  assert.ok(broker.requests[0].tools.some(x => x.name === 'flag_missing'));
});

test('the tool refuses a non-broker turn itself (ROLE_FORBIDDEN, fixed text), even if the registry would let it through', async () => {
  const repository = createRepository(memoryStorage());
  await repository.save(structuredClone(SEED_DEALS[DEAL]));
  const seenFields = createSeenFieldStore(memoryKv());
  const { registry } = createTools({ repository, seenFields });
  for (const role of ['seller', 'buyer', 'lender']) {
    const r = await registry.flag_missing.run({ turn: { role, dealId: DEAL, sessionId: 's-1' }, args: { note: 'zzz-secret-input' } });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error.code, 'ROLE_FORBIDDEN');
    // Fixed text: the same envelope for every role, with no echo of the input and no deal data.
    assert.deepStrictEqual(r.error, (await registry.flag_missing.run({ turn: { role: 'buyer', dealId: DEAL, sessionId: 's-2' }, args: {} })).error);
    assert.ok(!JSON.stringify(r).includes('zzz-secret-input'));
    assert.ok(!JSON.stringify(r).includes(SEED_DEALS[DEAL].address));
    assert.ok(!('data' in r));
    assert.deepStrictEqual(await seenFields.list({ dealId: DEAL, sessionId: 's-1', role }), []);
  }
});

test('an unknown deal is the fixed NOT_FOUND envelope', async () => {
  const t = setup([uses(use('f1', 'flag_missing', {})), ok('done')], { repository: { get: async () => null } });
  await t.handler(post(cookieFor('broker')));
  const [r] = resultsOf(t.requests);
  assert.deepStrictEqual(JSON.parse(r.content), NO_DEAL);
});

test('an untested jurisdiction gets the decline, and no report, for the broker', async () => {
  const { env: e, result } = await callFlag('broker', {}, { dealId: OTHER });
  assert.deepStrictEqual(e, UNTESTED_JURISDICTION);
  assert.ok(!('data' in e));
  assert.ok(!result.content.includes('Austin') && !result.content.includes('Travis'));
});

test('the jurisdiction check comes before the role check: the same decline for any role', async () => {
  const repository = createRepository(memoryStorage());
  await repository.save(structuredClone(SEED_DEALS[OTHER]));
  const { registry } = createTools({ repository, seenFields: createSeenFieldStore(memoryKv()) });
  const r = await registry.flag_missing.run({ turn: { role: 'buyer', dealId: OTHER, sessionId: 's-1' }, args: {} });
  assert.deepStrictEqual(r, UNTESTED_JURISDICTION);
});

test('arguments are ignored: any input gives the same report and error text never echoes it', async () => {
  const baseline = (await callFlag('broker')).result.content;
  const attacks = [
    { role: 'seller' },
    { transaction_id: OTHER, dealId: OTHER, sessionId: 'evil' },
    { field_name: 'tenancyStatus', fields: ['ssn'], include: 'all', form: 'TDS' },
    null, 'broker', 42, ['role', 'broker'],
  ];
  for (const args of attacks) assert.strictEqual((await callFlag('broker', args)).result.content, baseline, JSON.stringify(args));
  // The refusals carry fixed text: the input is never echoed.
  const forbidden = setup([uses(use('f1', 'flag_missing', { note: 'zzz-secret-input' })), ok('done')]);
  await forbidden.handler(post(cookieFor('seller')));
  assert.ok(!resultsOf(forbidden.requests)[0].content.includes('zzz-secret-input'));
  const untested = await callFlag('broker', { note: 'zzz-secret-input' }, { dealId: OTHER });
  assert.ok(!untested.result.content.includes('zzz-secret-input'));
});

test('the repeat key is {}: different junk arguments three times stop on the third', async () => {
  const t = setup([
    uses(use('a', 'flag_missing', { x: 1 })), uses(use('b', 'flag_missing', { y: 'two' })),
    uses(use('c', 'flag_missing', { role: 'broker' })), ok('never'),
  ]);
  const res = await t.handler(post(cookieFor('broker')));
  assert.strictEqual((await res.json()).reply, REPEAT_CALL_REPLY);
  assert.strictEqual(t.requests.length, 3);
});
