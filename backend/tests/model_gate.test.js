// modelGate driven directly. A one-time exception for 027a: with no loop yet, one turn makes one
// model call, so the 9th-call limit cannot be reached through the handler. 027c/032 re-test it there.
import test from 'node:test';
import assert from 'node:assert';
import { memoryKv } from '../kv.js';
import { createDailyCap } from '../limits.js';
import { createEventLog, memoryEventStore } from '../events.js';
import { createModelGate, createTurn } from '../model_gate.js';
import { validateModelResult, replyText } from '../model_interface.js';
import { MODEL_CALLS_PER_TURN } from '../config.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const ok = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });

function setup({ cap = 100, reply = ok('hi') } = {}) {
  const calls = [];
  const callModel = async req => { calls.push(req); return typeof reply === 'function' ? reply(req) : reply; };
  const store = memoryEventStore();
  let taken = 0;
  const realCap = createDailyCap(memoryKv(), { cap });
  const dailyCap = { async take() { taken++; return realCap.take(); } };
  const gate = createModelGate({ callModel, dailyCap, eventLog: createEventLog(store) });
  const turn = createTurn({ sessionId: 's1', turnId: 't1', role: 'seller', dealId: 'TX-CG118' });
  return { gate, turn, calls, store, taken: () => taken };
}
const request = { system: 'sys', tools: [], messages: [{ role: 'user', content: 'hello' }] };

test('a call passes through: the model gets the request, the result comes back', async () => {
  const { gate, turn, calls } = setup();
  const r = await gate(turn, request);
  assert.strictEqual(r.stopped, null);
  assert.strictEqual(replyText(r.result), 'hi');
  assert.deepStrictEqual(calls, [request]);
});

test('the 9th model call in a turn is refused with a plain message, and the cap is not taken for it', async () => {
  const { gate, turn, calls, taken } = setup();
  for (let i = 0; i < MODEL_CALLS_PER_TURN; i++) assert.strictEqual((await gate(turn, request)).stopped, null);
  const r = await gate(turn, request);
  assert.strictEqual(r.stopped, 'call_limit');
  assert.strictEqual(typeof r.reply, 'string');
  assert.ok(r.reply.length > 0);
  assert.strictEqual(calls.length, MODEL_CALLS_PER_TURN);
  assert.strictEqual(taken(), MODEL_CALLS_PER_TURN);
});

test('a new turn starts a new count', async () => {
  const { gate, turn } = setup();
  for (let i = 0; i < MODEL_CALLS_PER_TURN; i++) await gate(turn, request);
  const next = createTurn({ sessionId: 's1', turnId: 't2', role: 'seller', dealId: 'TX-CG118' });
  assert.strictEqual((await gate(next, request)).stopped, null);
});

test('when the daily cap is reached the model is not called and a plain message comes back', async () => {
  const { gate, turn, calls, store } = setup({ cap: 1 });
  await gate(turn, request);
  const r = await gate(turn, request);
  assert.strictEqual(r.stopped, 'daily_cap');
  assert.match(r.reply, /daily/i);
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(store.rows.map(r => r.event_type), ['model_call_start', 'model_call_end', 'turn_refused']);
});

test('every call logs start then end, with the turn\'s role, session and deal, redacted', async () => {
  const { gate, turn, store } = setup({ reply: ok('my key is sk-ant-xyz789') });
  await gate(turn, { ...request, messages: [{ role: 'user', content: 'use sk-ant-abc123' }] });
  assert.deepStrictEqual(store.rows.map(r => r.event_type), ['model_call_start', 'model_call_end']);
  for (const row of store.rows) {
    assert.strictEqual(row.role, 'seller');
    assert.strictEqual(row.session_id, 's1');
    assert.strictEqual(row.turn_id, 't1');
    assert.strictEqual(row.transaction_id, 'TX-CG118');
  }
  const text = JSON.stringify(store.rows);
  assert.ok(!text.includes('sk-ant-'));
  assert.ok(text.includes('[REDACTED]'));
});

test('a malformed model result is refused, and the end event is still logged', async () => {
  const { gate, turn, store } = setup({ reply: { content: 'not an array' } });
  await assert.rejects(gate(turn, request), /model result/);
  assert.deepStrictEqual(store.rows.map(r => r.event_type), ['model_call_start', 'model_call_end']);
});

test('the result validator accepts the interface shape and rejects others', () => {
  assert.doesNotThrow(() => validateModelResult(ok('x')));
  for (const bad of [null, {}, { content: [], usage: {} }, { content: [{}], stop_reason: 'end_turn', usage: {} },
    { content: [], stop_reason: 'end_turn' }]) {
    assert.throws(() => validateModelResult(bad), /model result/);
  }
});

test('a turn\'s scope cannot be changed after it is made', () => {
  const turn = createTurn({ sessionId: 's1', turnId: 't1', role: 'seller', dealId: 'TX-CG118' });
  assert.throws(() => { turn.role = 'broker'; });
});

test('a daily-cap refusal logs one turn_refused with the reason, the turn scope and no model_call_start', async () => {
  const { gate, turn, store } = setup({ cap: 1 });
  await gate(turn, request);
  store.rows.length = 0;
  await gate(turn, { ...request, messages: [{ role: 'user', content: 'private words' }] });
  assert.strictEqual(store.rows.length, 1);
  const [row] = store.rows;
  assert.strictEqual(row.event_type, 'turn_refused');
  assert.deepStrictEqual(row.payload, { reason: 'daily_cap', call: 2 });
  assert.deepStrictEqual([row.role, row.session_id, row.transaction_id], ['seller', 's1', 'TX-CG118']);
  assert.ok(!JSON.stringify(row).includes('private words'));
});

test('the 9th-call refusal logs one turn_refused with reason call_limit and no model_call_start', async () => {
  const { gate, turn, store } = setup();
  for (let i = 0; i < MODEL_CALLS_PER_TURN; i++) await gate(turn, request);
  const before = store.rows.length;
  await gate(turn, request);
  const added = store.rows.slice(before);
  assert.deepStrictEqual(added.map(r => r.event_type), ['turn_refused']);
  assert.deepStrictEqual(added[0].payload, { reason: 'call_limit', call: MODEL_CALLS_PER_TURN + 1 });
  assert.deepStrictEqual([added[0].role, added[0].transaction_id], ['seller', 'TX-CG118']);
});
