import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEventLog, EVENT_TYPES, fileEventStore, memoryEventStore } from '../events.js';

test('logEvent stores a row', async () => {
  const log = createEventLog(memoryEventStore());
  await log.logEvent('s1', 't1', 'broker', 'TX-CG118', 'model_call_start', { step: 1 });
  const [e] = await log.eventsForTurn('t1');
  assert.deepStrictEqual([e.session_id, e.role, e.transaction_id, e.event_type], ['s1', 'broker', 'TX-CG118', 'model_call_start']);
  assert.deepStrictEqual(e.payload, { step: 1 });
});

test('events for a turn are ordered and scoped', async () => {
  const log = createEventLog(memoryEventStore());
  for (const t of ['model_call_start', 'tool_start', 'tool_end', 'model_call_end']) await log.logEvent('s1', 't1', 'broker', 'TX-CG118', t, {});
  await log.logEvent('s1', 't2', 'broker', 'TX-CG118', 'model_call_start', {});
  assert.deepStrictEqual((await log.eventsForTurn('t1')).map(e => e.event_type),
    ['model_call_start', 'tool_start', 'tool_end', 'model_call_end']);
  assert.strictEqual((await log.eventsForTurn('t2')).length, 1);
});

test('an unknown event type is rejected', async () => {
  await assert.rejects(createEventLog(memoryEventStore()).logEvent('s1', 't1', 'broker', 'TX', 'whatever', {}), /unknown event type/);
});

test('API keys are redacted before writing', async () => {
  const store = memoryEventStore();
  await createEventLog(store).logEvent('s1', 't1', 'broker', 'TX', 'model_call_start',
    { headers: { 'x-api-key': 'sk-ant-secret123' }, text: 'key sk-ant-api03-abc is here' });
  const raw = JSON.stringify(store.rows);
  assert.ok(!raw.includes('secret123') && !raw.includes('sk-ant-api03-abc'));
  assert.ok(raw.includes('[REDACTED]'));
});

test('file store appends JSON lines and reads them back', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'events-')), 'agent_events.jsonl');
  const log = createEventLog(fileEventStore(file));
  await log.logEvent('s1', 't1', 'broker', 'TX', 'tool_start', { a: 1 });
  await log.logEvent('s1', 't1', 'broker', 'TX', 'tool_end', { a: 2 });
  assert.strictEqual(fs.readFileSync(file, 'utf8').trim().split('\n').length, 2);
  assert.deepStrictEqual((await createEventLog(fileEventStore(file)).eventsForTurn('t1')).map(e => e.payload), [{ a: 1 }, { a: 2 }]);
});

test('kv event store keeps events per turn, in order, with no expiry', async () => {
  const { memoryKv } = await import('../kv.js');
  const { kvEventStore } = await import('../events.js');
  let t = 0;
  const log = createEventLog(kvEventStore(memoryKv({ now: () => t })));
  await log.logEvent('s1', 't1', 'broker', 'TX', 'tool_start', { a: 1 });
  await log.logEvent('s1', 't1', 'broker', 'TX', 'tool_end', { a: 2 });
  await log.logEvent('s1', 't2', 'broker', 'TX', 'tool_start', { a: 3 });
  t += 365 * 24 * 3600 * 1000;
  assert.deepStrictEqual((await log.eventsForTurn('t1')).map(e => e.payload), [{ a: 1 }, { a: 2 }]);
});

test('turn_refused is a known event type, and logEvent still rejects others', async () => {
  assert.ok(EVENT_TYPES.has('turn_refused'));
  const store = memoryEventStore();
  await createEventLog(store).logEvent('s1', 't1', 'buyer', 'TX', 'turn_refused', { reason: 'rate_limit' });
  assert.strictEqual(store.rows[0].event_type, 'turn_refused');
  await assert.rejects(createEventLog(store).logEvent('s1', 't1', 'buyer', 'TX', 'refused', {}), /unknown event type/);
});
