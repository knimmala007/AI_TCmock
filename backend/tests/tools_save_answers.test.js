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

// ---- ticket 035: a required form with no template is flagged, never filled (R9, ticket 018) ----
import { STATUS } from '../status.js';
import { NO_TEMPLATE, NO_QUESTIONS_LEFT, ONLY_UNTEMPLATED_LEFT } from '../tools.js';

const hasTpl = code => DOCS.some(d => d.code === code);
const sf = (answers = {}, extra = {}) => variant({ propertyType: 'Condominium', ...answers }, extra);
const SENTINEL = 'ZZ-NO-LEAK-4412';

test('035: NO_TEMPLATE is a provisional transport code, not an eleventh status code', () => {
  assert.ok(!Object.values(STATUS).includes('NO_TEMPLATE'));
  assert.strictEqual(NO_TEMPLATE.ok, false);
  assert.strictEqual(NO_TEMPLATE.error.code, 'NO_TEMPLATE');
  assert.match(NO_TEMPLATE.error.message, /^Not saved\./);
  assert.match(NO_TEMPLATE.error.next_step, /Do not retry/);
});

test('035: a fact that feeds only untemplated forms is not saved: ok false, fixed text, nothing stored', async () => {
  for (const role of ['broker', 'seller']) {
    let saves = 0;
    const deal = sf();
    const real = createRepository(memoryStorage());
    await real.save(deal);
    const stub = { get: id => real.get(id), save: d => { saves++; return real.save(d); } };
    const t = await run(role, [one('hoaName', `Ashby ${SENTINEL}`)], { deal, stub });
    assert.deepStrictEqual(t.e, NO_TEMPLATE, role);
    assert.strictEqual(saves, 0, `${role}: nothing written`);
    assert.ok(!JSON.stringify(t.e).includes(SENTINEL));
    assert.ok(!JSON.stringify(t.e).includes('HOA'), 'the text names no form code');
    assert.deepStrictEqual(await t.seenFields.list({ dealId: OTHER, sessionId: 's-1', role }), []);
  }
});

test('035: the same refusal holds when the model also passes role, deal and form in the arguments', async () => {
  const t = await run('broker', [one('hoaName', 'Ashby', { role: 'lender', dealId: 'TX-CG118', formCode: 'TDS' })], { deal: sf() });
  assert.deepStrictEqual(t.e, NO_TEMPLATE);
  assert.ok(!(await t.reload(OTHER)).answers.hoaName);
});

test('035: a fact that also feeds a templated form is saved; the untemplated forms are flagged, not filled', async () => {
  const before = sf({ city: 'San Francisco' });
  const t = await run('broker', [one('apn', '123-45-678')], { deal: before });
  assert.strictEqual(t.e.ok, true);
  assert.deepStrictEqual(t.e.data.flagged_forms.sort(), ['SF-3R']);
  assert.ok(t.e.data.forms_filled.length > 0 && t.e.data.forms_filled.every(hasTpl));
  assert.ok(!t.e.data.forms_filled.includes('SF-3R'));
  assert.strictEqual((await t.reload(OTHER)).answers.apn.v, '123-45-678');
  const none = await run('broker', [one('city', 'San José')]);
  assert.deepStrictEqual(none.e.data.flagged_forms, []);
});

test('035: flagged_forms is limited to the role view', async () => {
  const t = await run('seller', [one('apn', '123-45-678')], { deal: sf({ city: 'Los Angeles' }) });
  assert.strictEqual(t.e.ok, true);
  for (const code of t.e.data.flagged_forms) assert.ok(canAccessForm('seller', code));
});

test('035: an approved or locked templated form still refuses the whole write of a mixed fact', async () => {
  const base = { city: 'San Francisco' };
  const approved = sf(base, { approval: { snapshot: { forms: ['NHD'], approved_by: 'broker', approved_at: 'then' } } });
  const a = await run('broker', [one('apn', '123-45-678')], { deal: approved });
  assert.strictEqual(a.e.error.code, 'POST_APPROVAL_CHANGE');
  assert.deepStrictEqual(await a.reload(OTHER), approved);
  const locked = sf(base, { locks: { NHD: { reason: 'under_review' } } });
  const l = await run('broker', [one('apn', '123-45-678')], { deal: locked });
  assert.strictEqual(l.e.error.code, 'FORM_LOCKED');
  assert.deepStrictEqual(await l.reload(OTHER), locked);
});

test('035: get_deal lists the untemplated required forms as flagged, and the templated ones as not', async () => {
  const deal = sf({ city: 'San Francisco' });
  const t = await run('broker', [{}], { deal, name: 'get_deal' });
  const forms = t.e.data.forms;
  const flagged = forms.filter(f => !f.has_template).map(f => f.code);
  assert.ok(['HOA', 'HOA-CERT', 'SF-3R'].every(c => flagged.includes(c)), flagged.join());
  assert.ok(forms.filter(f => f.has_template).every(f => hasTpl(f.code)));
  const s = await run('seller', [{}], { deal, name: 'get_deal_status' });
  assert.ok(s.e.data.forms.some(f => f.code === 'HOA' && f.has_template === false));
  const l = await run('lender', [{}], { deal, name: 'get_deal_status' });
  assert.ok(!JSON.stringify(l.e).includes('"HOA"'));
});

test('035: which untemplated codes a fact can reach is pinned (the other codes are never fed by any question)', () => {
  const engine = createEngine({ getAnswers: () => ({}), getDeal: () => ({ data: {} }), getDocs: () => DOCS });
  const reachable = [...new Set(engine.QUESTIONS.flatMap(q => q.fills || []).filter(c => !hasTpl(c)))].sort();
  assert.deepStrictEqual(reachable, ['HOA', 'HOA-CERT', 'LA-9A', 'LEASE', 'SF-3R']);
  const onlyFlagged = engine.QUESTIONS.filter(q => (q.fills || []).length && q.fills.every(c => !hasTpl(c))).map(q => q.k);
  assert.deepStrictEqual(onlyFlagged, ['hoaName']);
});

// Everything askable answered except hoaName, so the HOA question is the only one left for the deal.
function onlyHoaLeft() {
  const d = sf();
  const engine = createEngine({ getAnswers: () => d.answers, getDeal: () => d, getDocs: () => DOCS });
  for (let i = 0; i < 200; i++) {
    const q = engine.pending().find(x => x.k !== 'hoaName');
    if (!q) break;
    engine.answer(q.k, q.type === 'choice' ? q.options[0] : 'x', 'test');
  }
  assert.deepStrictEqual(engine.pending().map(q => q.k), ['hoaName']);
  return d;
}

test('035: after NO_TEMPLATE the next question is never the same one (no loop)', async () => {
  for (const role of ['broker', 'seller']) {
    const deal = onlyHoaLeft();
    const saved = await run(role, [one('hoaName', 'Ashby')], { deal: structuredClone(deal) });
    assert.deepStrictEqual(saved.e, NO_TEMPLATE, role);
    const next = await run(role, [{}], { deal: structuredClone(deal), name: 'ask_next_question' });
    assert.strictEqual(next.e.ok, true);
    assert.notStrictEqual(next.e.data.question && next.e.data.question.field_name, 'hoaName', role);
    assert.ok(!JSON.stringify(next.e).includes('hoaName'));
  }
});

test('035: a question that also feeds a templated form is still asked', async () => {
  const deal = sf({ city: 'San Francisco' });
  const asked = [];
  for (let i = 0; i < 60; i++) {
    const n = await run('broker', [{}], { deal: structuredClone(deal), name: 'ask_next_question' });
    const q = n.e.data.question;
    if (!q) break;
    asked.push(q.field_name);
    deal.answers[q.field_name] = { v: 'x', src: 'test' };
  }
  assert.ok(asked.includes('apn'), 'apn feeds SF-3R and templated forms');
  assert.ok(!asked.includes('hoaName'));
});

test('035: when only an untemplated question remains, the message says so and is not "no questions left"', async () => {
  for (const role of ['broker', 'seller']) {
    const next = await run(role, [{}], { deal: onlyHoaLeft(), name: 'ask_next_question' });
    assert.strictEqual(next.e.ok, true);
    assert.strictEqual(next.e.data.done, true);
    assert.strictEqual(next.e.data.message, ONLY_UNTEMPLATED_LEFT, role);
    assert.notStrictEqual(next.e.data.message, NO_QUESTIONS_LEFT);
    assert.ok(!/HOA|hoaName/.test(JSON.stringify(next.e)), 'no form or field name');
  }
});

test('035: when every question is answered, the message is still NO_QUESTIONS_LEFT', async () => {
  const deal = onlyHoaLeft();
  deal.answers.hoaName = { v: 'Ashby', src: 'test' };
  const next = await run('broker', [{}], { deal, name: 'ask_next_question' });
  assert.strictEqual(next.e.data.message, NO_QUESTIONS_LEFT);
});
