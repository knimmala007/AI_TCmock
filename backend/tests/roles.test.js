import test from 'node:test';
import assert from 'node:assert';
import * as roles from '../roles.js';

test('all four roles are registered', () => {
  assert.deepStrictEqual(Object.keys(roles.ROLE_TOOLS).sort(), ['broker', 'buyer', 'lender', 'seller']);
});

test('broker tools', () => {
  assert.deepStrictEqual(roles.toolsFor('broker'),
    ['get_deal', 'save_answers', 'ask_next_question', 'flag_missing', 'request_approval', 'hand_off']);
});

test('only non-brokers can ask the broker', () => {
  for (const r of ['seller', 'buyer', 'lender']) assert.ok(roles.toolsFor(r).includes('ask_broker'));
  assert.ok(!roles.toolsFor('broker').includes('ask_broker'));
});

test('role-specific tools, and there is only one save tool name', () => {
  assert.ok(roles.toolsFor('buyer').includes('acknowledge_disclosure'));
  assert.ok(roles.toolsFor('lender').includes('mark_clear_to_close'));
  assert.ok(roles.toolsFor('seller').includes('save_answers'));
  const all = Object.keys(roles.ROLE_TOOLS).flatMap(r => roles.toolsFor(r));
  assert.ok(!all.includes('save_answer'));
  for (const r of ['buyer', 'lender']) {
    assert.ok(!roles.toolsFor(r).includes('save_answers'));
    assert.ok(roles.toolsFor(r).includes('get_deal_status') && roles.toolsFor(r).includes('explain_form'));
  }
});

test('no role can use another role\'s tool', () => {
  assert.ok(!roles.toolsFor('broker').includes('mark_clear_to_close'));
  assert.ok(!roles.toolsFor('seller').includes('request_approval'));
  assert.ok(!roles.toolsFor('buyer').includes('hand_off'));
});

test('unknown role gets nothing', () => {
  assert.throws(() => roles.toolsFor('hacker'), roles.UnknownRole);
  assert.throws(() => roles.canAccessForm('hacker', 'TDS'), roles.UnknownRole);
});

test('the broker sees every document on both sides of the deal', async () => {
  const { DOCS } = await import('../fixtures.js');
  assert.ok(roles.canAccessForm('broker', 'TDS'), 'seller-side');
  assert.ok(roles.canAccessForm('broker', 'APPR'), 'buyer-side');
  assert.ok(roles.canAccessForm('broker', 'WFA'), 'shared');
  assert.deepStrictEqual(roles.visibleDocCodes('broker'), DOCS.map(d => d.code), 'all 44, nothing hidden');
});

test('seller and buyer still see only their own side plus shared documents', () => {
  assert.ok(roles.canAccessForm('seller', 'TDS') && roles.canAccessForm('seller', 'WFA'));
  assert.ok(!roles.canAccessForm('seller', 'APPR'));
  assert.ok(roles.canAccessForm('buyer', 'APPR') && roles.canAccessForm('buyer', 'WFA'));
  assert.ok(!roles.canAccessForm('buyer', 'TDS'));
});

test('the lender sees only the loan file (APPR)', () => {
  assert.deepStrictEqual(roles.visibleDocCodes('lender'), ['APPR']);
  assert.ok(!roles.canAccessForm('lender', 'TDS'));
});

test('a code with no DOCS entry is treated as a seller-side placeholder form', () => {
  assert.ok(roles.canAccessForm('broker', 'SF-3R'));
  assert.ok(!roles.canAccessForm('buyer', 'SF-3R'));
  assert.ok(!roles.canAccessForm('lender', 'SF-3R'));
});

test('inherited object property names are not roles', () => {
  for (const r of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.throws(() => roles.toolsFor(r), roles.UnknownRole, r);
    assert.throws(() => roles.canAccessForm(r, 'TDS'), roles.UnknownRole, r);
  }
});
