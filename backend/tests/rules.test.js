// Runs the app's own CASES (from index.html) against the shared rules.js, driven the
// way the Test Lab drives them: ask nextQ(), answer from the case, then the epilogue.
// node --test backend/tests/rules.test.js
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Rules from '../../rules.js';
import fixtures from '../fixtures.js';
import { canAccessForm } from '../roles.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const DEAL_VARIABLE = ['address', 'city', 'county', 'zip', 'apn', 'type', 'yearBuilt', 'price', 'seller',
  'listingAgent', 'brokerage', 'listingSigned', 'tdsDate', 'lpdDate', 'nhdDate', 'glideDate', 'treeDate', 'closeDate'];

function blankDeal() {
  const deal = {data: {}, sellerStage: 0, buyerStage: 0, tcRun: false};
  DEAL_VARIABLE.forEach(k => { deal[k] = ''; });
  return deal;
}

function loadCases(env) {
  const i = html.indexOf('const CASES = [');
  const j = html.indexOf('\n];', i) + 3;
  return new Function('requiredForms', 'missingFields', 'intakeProgress', 'DEAL',
    html.slice(i, j) + '\nreturn CASES;')(env.requiredForms, env.missingFields, env.intakeProgress, env.DEAL);
}

function runCase(C, answers, deal, engine) {
  let guard = 0;
  for (let q = engine.nextQ(); q; q = engine.nextQ()) {
    assert.ok(guard++ < 200, 'runaway question loop');
    assert.ok(C.a[q.k] !== undefined, `case "${C.id}" has no answer for ${q.k}`);
    assert.ok(engine.answer(q.k, C.a[q.k]), `answer for ${q.k} was rejected`);
  }
  (C.epilogue || []).forEach(([k, v]) => engine.answer(k, v));
}

function fresh() {
  const answers = {}, deal = blankDeal();
  const engine = Rules.createEngine({getAnswers: () => answers, getDeal: () => deal, getDocs: () => fixtures.docs});
  return {answers, deal, engine};
}

const probe = fresh();
const cases = loadCases({
  requiredForms: () => { throw new Error('probe'); }, missingFields: () => [], intakeProgress: () => ({}), DEAL: {},
});

test('index.html loads the shared engine instead of defining its own', () => {
  assert.match(html, /import \* as Rules from '\.\/rules\.js'/);
  assert.doesNotMatch(html, /const QUESTIONS = \[/);
  assert.match(html, /Rules\.createEngine/);
});

test('the real cases exist', () => {
  assert.deepStrictEqual(cases.map(c => c.id), ['longford', 'sfcondo', 'unknown', 'latenant', 'citychange']);
});

for (const spec of cases) {
  test(`app CASE "${spec.id}": every assertion passes against rules.js`, () => {
    const {answers, deal, engine} = fresh();
    const C = loadCases({
      requiredForms: engine.requiredForms, missingFields: engine.missingFields,
      intakeProgress: engine.intakeProgress, DEAL: deal,
    }).find(c => c.id === spec.id);
    runCase(C, answers, deal, engine);
    const failed = C.expect.filter(([, fn]) => { try { return !fn(); } catch (e) { return true; } }).map(([label]) => label);
    assert.deepStrictEqual(failed, []);
  });
}

test('the derived county follows a corrected city (San Jose -> Los Angeles)', () => {
  const {deal, engine} = fresh();
  engine.answer('city', 'San José');
  assert.strictEqual(deal.county, 'Santa Clara');
  engine.answer('city', 'Los Angeles');
  assert.strictEqual(deal.county, 'Los Angeles');
});

test('an unparseable build year still requires the lead disclosure (safe default)', () => {
  const {engine} = fresh();
  engine.answer('yearBuilt', 'Unknown — records lost');
  assert.ok(engine.requiredForms().includes('LPD'));
});

test('answering with an empty value or unknown key records nothing', () => {
  const {answers, engine} = fresh();
  assert.strictEqual(engine.answer('city', ''), null);
  assert.strictEqual(engine.answer('not_a_question', 'x'), null);
  assert.deepStrictEqual(answers, {});
});

const norm = s => String(s).normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

test('the tested-jurisdiction list is exactly the cities and counties the app\'s CASES use', async () => {
  const { TESTED_JURISDICTIONS, isTestedJurisdiction } = await import('../config.js');
  const used = new Set();
  for (const spec of cases) {
    const { answers, deal, engine } = fresh();
    const C = loadCases({
      requiredForms: engine.requiredForms, missingFields: engine.missingFields,
      intakeProgress: engine.intakeProgress, DEAL: deal,
    }).find(c => c.id === spec.id);
    runCase(C, answers, deal, engine);
    used.add(`${norm(deal.city)}|${norm(deal.county)}`);
    // citychange passes through San José before it is corrected, so count every city entered
    for (const k of ['city']) if (C.a[k]) used.add(`${norm(C.a[k])}|${norm(engine.QUESTIONS.find(q => q.k === k).derives(C.a[k]).county)}`);
  }
  assert.deepStrictEqual([...used].sort(), TESTED_JURISDICTIONS.map(([c, n]) => `${norm(c)}|${norm(n)}`).sort());
  assert.ok(isTestedJurisdiction('San José', 'Santa Clara'));
  assert.ok(!isTestedJurisdiction('Austin', 'Travis'));
  assert.ok(!isTestedJurisdiction('Berkeley', 'Alameda'), 'no CASE uses Berkeley');
});

test('APPR appears only when the buyer is financing, in every CASE', () => {
  const financed = { longford: true, latenant: true, sfcondo: false, unknown: false, citychange: false };
  assert.deepStrictEqual(Object.keys(financed).sort(), cases.map(c => c.id).sort());
  for (const spec of cases) {
    const { answers, deal, engine } = fresh();
    const C = loadCases({
      requiredForms: engine.requiredForms, missingFields: engine.missingFields,
      intakeProgress: engine.intakeProgress, DEAL: deal,
    }).find(c => c.id === spec.id);
    runCase(C, answers, deal, engine);
    assert.strictEqual(engine.requiredForms().includes('APPR'), financed[spec.id], spec.id);
    assert.strictEqual(answers.buyerFinancing.v.startsWith('Yes'), financed[spec.id], spec.id);
  }
});

test('the Cottage Grove deal gets APPR only after the buyer is said to be financing', () => {
  const { engine } = fresh();
  [['sellerType', 'Corporation or LLC'], ['seller', 'Seller Corp.'], ['signer', 'Authorized Officer, President'],
    ['address', '118 Cottage Grove Avenue'], ['city', 'San José'], ['apn', '434-24-002'], ['yearBuilt', '1947'],
    ['propertyType', 'Single-family resale']].forEach(([k, v]) => engine.answer(k, v));
  assert.strictEqual(engine.requiredForms().length, 32, 'the prefill form set is unchanged');
  assert.ok(!engine.requiredForms().includes('APPR'));
  engine.answer('buyerFinancing', 'No, all cash');
  assert.ok(!engine.requiredForms().includes('APPR'));
  engine.answer('buyerFinancing', 'Yes, with a lender loan');
  assert.ok(engine.requiredForms().includes('APPR'));
  assert.strictEqual(engine.requiredForms().length, 33);
});

// ---- ranking for the agent (ticket 033, ADR 0008): by forms unblocked, then question order ----
const ATTEST = ['waterHeater', 'smokeAlarm', 'coDetector'];
const rankKeys = (engine, opts) => engine.rankedQuestions(opts).map(r => r.question.k);

test('ranking: the question that feeds the most unfinished forms comes first, ties keep question order', () => {
  const {engine} = fresh();
  const ranked = engine.rankedQuestions();
  assert.deepStrictEqual(ranked.slice(0, 3).map(r => [r.question.k, r.unblocks]), [['address', 10], ['seller', 8], ['listingAgent', 4]]);
  // sellerType, city, county and defects all unblock 3 forms: QUESTIONS order decides.
  assert.deepStrictEqual(ranked.filter(r => r.unblocks === 3).map(r => r.question.k).slice(0, 4), ['sellerType', 'city', 'county', 'defects']);
  assert.ok(ranked.every((r, i) => i === 0 || ranked[i - 1].unblocks >= r.unblocks), 'never ascending');
});

test('ranking: nextQ() is unchanged and still takes the first pending question', () => {
  const {engine} = fresh();
  assert.strictEqual(engine.nextQ().k, 'sellerType');
  assert.notStrictEqual(engine.nextByUnblock().question.k, engine.nextQ().k);
});

test('ranking: a question whose condition is not met is skipped until it is met', () => {
  const {engine} = fresh();
  for (const k of ['signer', 'treeStatus', 'leaseEnd', 'permits', 'hoaName']) assert.ok(!rankKeys(engine).includes(k), k);
  engine.answer('city', 'San José');
  assert.ok(rankKeys(engine).includes('treeStatus'));
  engine.answer('sellerType', 'Trust');
  assert.ok(rankKeys(engine).includes('signer'));
});

test('ranking: skip removes candidates and answered questions are never offered', () => {
  const {engine} = fresh();
  assert.ok(rankKeys(engine).includes('waterHeater'));
  assert.ok(!rankKeys(engine, {skip: ATTEST}).some(k => ATTEST.includes(k)));
  engine.answer('address', '1 Main St');
  assert.ok(!rankKeys(engine).includes('address'));
});

test('ranking: only forms the formFilter allows are counted', () => {
  const {engine} = fresh();
  const all = engine.rankedQuestions().find(r => r.question.k === 'address').unblocks;
  const some = engine.rankedQuestions({formFilter: c => c === 'TDS'}).find(r => r.question.k === 'address').unblocks;
  assert.strictEqual(some, 1);
  assert.ok(all > some);
});

test('ranking: when every askable question is answered there is nothing left', () => {
  const {engine} = fresh();
  const C = cases.find(c => c.id === 'longford');
  for (let g = 0; engine.nextByUnblock(); g++) {
    assert.ok(g < 200, 'runaway loop');
    const k = engine.nextByUnblock().question.k;
    assert.ok(engine.answer(k, C.a[k]), `answer for ${k} was rejected`);
  }
  assert.deepStrictEqual(engine.rankedQuestions(), []);
  assert.strictEqual(engine.nextByUnblock(), null);
});

test('ranking: skipped questions stay unanswered, so the skip list alone ends the run for them', () => {
  const {engine} = fresh();
  const C = cases.find(c => c.id === 'longford');
  for (let g = 0, n = engine.nextByUnblock({skip: ATTEST}); n; n = engine.nextByUnblock({skip: ATTEST})) {
    assert.ok(g++ < 200, 'runaway question loop');
    engine.answer(n.question.k, C.a[n.question.k]);
  }
  assert.deepStrictEqual(engine.pending().map(q => q.k).sort(), [...ATTEST].sort());
});

for (const role of ['broker', 'seller', 'buyer', 'lender']) {
  test(`ranking: for the ${role}, a question that feeds no form they can see is skipped, not ranked last`, () => {
    const {engine} = fresh();
    const formFilter = c => canAccessForm(role, c);
    const hidden = engine.pending().filter(q => !(q.fills || []).some(formFilter)).map(q => q.k);
    const keys = rankKeys(engine, {formFilter});
    for (const k of hidden) assert.ok(!keys.includes(k), `${k} offered to ${role}`);
    assert.strictEqual(keys.length + hidden.length, engine.pending().length);
    assert.ok(engine.rankedQuestions({formFilter}).every(r => (r.question.fills || []).some(formFilter)));
    // buyerFinancing feeds only the appraisal: the broker and lender may see it, the seller and buyer may not.
    assert.strictEqual(keys.includes('buyerFinancing'), canAccessForm(role, 'APPR'));
    assert.strictEqual(hidden.includes('buyerFinancing'), !canAccessForm(role, 'APPR'));
  });
}
