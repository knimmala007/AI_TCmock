import test from 'node:test';
import assert from 'node:assert';
import { APPROVAL_GATED_ACTIONS, STATUS, guardAction, guardWrite } from '../status.js';

const allowedEngine = { requiredForms: () => ['TDS', 'SPQ', 'WFA', 'APPR'] };
const deal = (extra = {}) => ({ transaction_id: 'TX', ...extra });

test('there are exactly ten locked status codes', () => {
  assert.deepStrictEqual(Object.values(STATUS).sort(), [
    'APPROVAL_REQUIRED', 'FACT_CONFLICT', 'FORM_LOCKED', 'FORM_NOT_REQUIRED', 'HUMAN_ATTESTATION_REQUIRED',
    'INVALID_VALUE', 'LEGAL_JUDGMENT', 'MISSING_FACT', 'POST_APPROVAL_CHANGE', 'ROLE_FORBIDDEN']);
  assert.ok(Object.entries(STATUS).every(([k, v]) => k === v));
});

test('a write the role may make, to a required unlocked form, is allowed', () => {
  assert.strictEqual(guardWrite({ role: 'broker', deal: deal(), engine: allowedEngine, formCode: 'TDS' }), null);
});

test('ROLE_FORBIDDEN: the role may not touch this at all', () => {
  const r = guardWrite({ role: 'buyer', deal: deal(), engine: allowedEngine, formCode: 'TDS' });
  assert.strictEqual(r.error, 'ROLE_FORBIDDEN');
});

test('ROLE_FORBIDDEN wins over everything else, so a role cannot probe a form it may not see', () => {
  const d = deal({ approval: { snapshot: { forms: ['TDS'] } }, locks: { TDS: { reason: 'awaiting_signature' } } });
  const r = guardWrite({ role: 'buyer', deal: d, engine: { requiredForms: () => [] }, formCode: 'TDS' });
  assert.strictEqual(r.error, 'ROLE_FORBIDDEN');
});

test('FORM_NOT_REQUIRED: the form is not part of this deal', () => {
  const r = guardWrite({ role: 'broker', deal: deal(), engine: allowedEngine, formCode: 'POOL' });
  assert.strictEqual(r.error, 'FORM_NOT_REQUIRED');
});

test('POST_APPROVAL_CHANGE: an approved snapshot exists and the write would change it', () => {
  const d = deal({ approval: { snapshot: { forms: ['TDS'] } } });
  const r = guardWrite({ role: 'broker', deal: d, engine: allowedEngine, formCode: 'TDS' });
  assert.strictEqual(r.error, 'POST_APPROVAL_CHANGE');
  assert.match(r.next_step, /broker.*reopen/i);
});

test('a form outside the approved snapshot can still be written', () => {
  const d = deal({ approval: { snapshot: { forms: ['TDS'] } } });
  assert.strictEqual(guardWrite({ role: 'broker', deal: d, engine: allowedEngine, formCode: 'SPQ' }), null);
});

test('FORM_LOCKED: locked for any other reason, and the next step is to wait', () => {
  for (const reason of ['awaiting_signature', 'pending_approval']) {
    const d = deal({ locks: { SPQ: { reason } } });
    const r = guardWrite({ role: 'broker', deal: d, engine: allowedEngine, formCode: 'SPQ' });
    assert.strictEqual(r.error, 'FORM_LOCKED');
    assert.match(r.next_step, /wait/i);
    assert.ok(r.message.includes(reason.replace('_', ' ')));
  }
});

test('POST_APPROVAL_CHANGE is checked before FORM_LOCKED', () => {
  const d = deal({ approval: { snapshot: { forms: ['TDS'] } }, locks: { TDS: { reason: 'awaiting_signature' } } });
  assert.strictEqual(guardWrite({ role: 'broker', deal: d, engine: allowedEngine, formCode: 'TDS' }).error, 'POST_APPROVAL_CHANGE');
});

test('APPROVAL_REQUIRED never comes from a form write', () => {
  for (const d of [deal(), deal({ locks: { TDS: { reason: 'pending_approval' } } }), deal({ approval: { snapshot: { forms: ['TDS'] } } })]) {
    const r = guardWrite({ role: 'broker', deal: d, engine: allowedEngine, formCode: 'TDS' });
    assert.notStrictEqual(r && r.error, 'APPROVAL_REQUIRED');
  }
});

test('the gated actions are the agreed six bullets (waive and override are two actions)', () => {
  assert.deepStrictEqual([...APPROVAL_GATED_ACTIONS].sort(), [
    'freeze_snapshot', 'hand_off', 'override_refusal', 'release_forms', 'reopen_form', 'send_message', 'waive_form']);
});

test('APPROVAL_REQUIRED: a gated action before the broker pressed Approve', () => {
  for (const action of APPROVAL_GATED_ACTIONS) {
    assert.strictEqual(guardAction({ action, deal: deal() }).error, 'APPROVAL_REQUIRED', action);
  }
});

test('a gated action is allowed once the broker approved that action', () => {
  assert.strictEqual(guardAction({ action: 'hand_off', deal: deal({ approvals: { hand_off: true } }) }), null);
  assert.strictEqual(guardAction({ action: 'send_message', deal: deal({ approvals: { hand_off: true } }) }).error, 'APPROVAL_REQUIRED');
});

test('an action that is not gated is never refused', () => {
  assert.strictEqual(guardAction({ action: 'get_deal', deal: deal() }), null);
});
