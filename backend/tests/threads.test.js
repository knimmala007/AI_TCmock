import test from 'node:test';
import assert from 'node:assert';
import { memoryKv } from '../kv.js';
import { createThreadStore } from '../threads.js';
import { THREAD_MESSAGES_KEPT, THREAD_TTL_SECONDS } from '../config.js';

const scope = (over = {}) => ({ dealId: 'TX-CG118', role: 'broker', sessionId: 's1', ...over });

test('keeps messages in order', async () => {
  const threads = createThreadStore(memoryKv());
  await threads.append(scope(), { role: 'user', content: 'hi' });
  await threads.append(scope(), { role: 'assistant', content: 'hello' });
  assert.deepStrictEqual(await threads.recent(scope()), [
    { role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }]);
});

test('keeps only the last N messages', async () => {
  const threads = createThreadStore(memoryKv());
  for (let i = 0; i < THREAD_MESSAGES_KEPT + 5; i++) await threads.append(scope(), { role: 'user', content: `m${i}` });
  const got = await threads.recent(scope());
  assert.strictEqual(got.length, THREAD_MESSAGES_KEPT);
  assert.strictEqual(got.at(-1).content, `m${THREAD_MESSAGES_KEPT + 4}`);
  assert.strictEqual(got[0].content, 'm5');
});

test('a thread expires', async () => {
  let t = 0;
  const threads = createThreadStore(memoryKv({ now: () => t }));
  await threads.append(scope(), { role: 'user', content: 'hi' });
  t += (THREAD_TTL_SECONDS - 1) * 1000;
  assert.strictEqual((await threads.recent(scope())).length, 1);
  t += 2000;
  assert.deepStrictEqual(await threads.recent(scope()), []);
});

test('appending refreshes the expiry', async () => {
  let t = 0;
  const threads = createThreadStore(memoryKv({ now: () => t }));
  await threads.append(scope(), { role: 'user', content: 'a' });
  t += (THREAD_TTL_SECONDS - 10) * 1000;
  await threads.append(scope(), { role: 'user', content: 'b' });
  t += (THREAD_TTL_SECONDS - 10) * 1000;
  assert.strictEqual((await threads.recent(scope())).length, 2);
});

test('threads are keyed by deal, session and role, and never mix', async () => {
  const threads = createThreadStore(memoryKv());
  await threads.append(scope(), { role: 'user', content: 'broker secret' });
  assert.deepStrictEqual(await threads.recent(scope({ role: 'buyer' })), []);
  assert.deepStrictEqual(await threads.recent(scope({ sessionId: 's2' })), []);
  assert.deepStrictEqual(await threads.recent(scope({ dealId: 'tx_unknown_city' })), []);
});

test('key parts cannot collide through separators', async () => {
  const threads = createThreadStore(memoryKv());
  await threads.append(scope({ dealId: 'a:b', sessionId: 'c' }), { role: 'user', content: 'x' });
  assert.deepStrictEqual(await threads.recent(scope({ dealId: 'a', sessionId: 'b:c' })), []);
});

test('a role outside the four is refused', async () => {
  const threads = createThreadStore(memoryKv());
  await assert.rejects(threads.append(scope({ role: 'ai_agent' }), { role: 'user', content: 'x' }), /unknown role/);
  await assert.rejects(threads.recent(scope({ role: 'ai_agent' })), /unknown role/);
});

test('only user and assistant messages are stored', async () => {
  const threads = createThreadStore(memoryKv());
  await assert.rejects(threads.append(scope(), { role: 'system', content: 'x' }), /message role/);
});

test('inherited object property names are not roles', async () => {
  const threads = createThreadStore(memoryKv());
  await assert.rejects(threads.recent(scope({ role: 'constructor' })), /unknown role/);
});

test('switching roles shows no earlier turns, even in the same session', async () => {
  const threads = createThreadStore(memoryKv());
  await threads.append(scope({ role: 'broker' }), { role: 'user', content: 'broker-only question' });
  await threads.append(scope({ role: 'broker' }), { role: 'assistant', content: 'broker-only answer' });
  assert.deepStrictEqual(await threads.recent(scope({ role: 'buyer' })), [], 'same session id, new role');
  assert.deepStrictEqual(await threads.recent(scope({ role: 'buyer', sessionId: 's2' })), [], 'new session, new role');
  assert.deepStrictEqual(await threads.recent(scope({ role: 'lender' })), []);
});

test('the seen-field-names set is keyed by deal, session and role, so a role switch starts clean', async () => {
  const { createSeenFieldStore } = await import('../threads.js');
  const seen = createSeenFieldStore(memoryKv());
  await seen.add(scope(), ['seller', 'address']);
  assert.deepStrictEqual((await seen.list(scope())).sort(), ['address', 'seller']);
  assert.strictEqual(await seen.has(scope(), 'address'), true);
  assert.strictEqual(await seen.has(scope({ role: 'buyer' }), 'address'), false);
  assert.strictEqual(await seen.has(scope({ sessionId: 's2' }), 'address'), false);
  assert.strictEqual(await seen.has(scope({ dealId: 'tx_unknown_city' }), 'address'), false);
  await assert.rejects(seen.add(scope({ role: 'ai_agent' }), ['x']), /unknown role/);
});

test('the seen-field-names set expires with the thread', async () => {
  const { createSeenFieldStore } = await import('../threads.js');
  let t = 0;
  const seen = createSeenFieldStore(memoryKv({ now: () => t }));
  await seen.add(scope(), ['seller']);
  t += (THREAD_TTL_SECONDS + 1) * 1000;
  assert.deepStrictEqual(await seen.list(scope()), []);
});
