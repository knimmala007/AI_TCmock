import test from 'node:test';
import assert from 'node:assert';
import { memoryKv } from '../kv.js';
import { createDailyCap, createRateLimiter } from '../limits.js';

test('rate limiter allows up to the limit per window, then refuses', async () => {
  let t = 0;
  const limiter = createRateLimiter(memoryKv({ now: () => t }), { now: () => t });
  for (let i = 0; i < 3; i++) assert.strictEqual((await limiter.hit('k', { limit: 3, windowSeconds: 60 })).allowed, true);
  const r = await limiter.hit('k', { limit: 3, windowSeconds: 60 });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.remaining, 0);
});

test('the window resets', async () => {
  let t = 0;
  const limiter = createRateLimiter(memoryKv({ now: () => t }), { now: () => t });
  for (let i = 0; i < 4; i++) await limiter.hit('k', { limit: 3, windowSeconds: 60 });
  t += 61_000;
  assert.strictEqual((await limiter.hit('k', { limit: 3, windowSeconds: 60 })).allowed, true);
});

test('keys are independent', async () => {
  const limiter = createRateLimiter(memoryKv());
  await limiter.hit('a', { limit: 1, windowSeconds: 60 });
  assert.strictEqual((await limiter.hit('a', { limit: 1, windowSeconds: 60 })).allowed, false);
  assert.strictEqual((await limiter.hit('b', { limit: 1, windowSeconds: 60 })).allowed, true);
});

test('the daily model-call cap stops calls after the cap and resets the next day', async () => {
  let t = Date.UTC(2026, 9, 26, 12);
  const cap = createDailyCap(memoryKv({ now: () => t }), { cap: 3, now: () => t });
  for (let i = 0; i < 3; i++) assert.strictEqual((await cap.take()).allowed, true);
  assert.strictEqual((await cap.take()).allowed, false);
  t += 24 * 3600 * 1000;
  assert.strictEqual((await cap.take()).allowed, true);
});

test('the cap is global, not per session', async () => {
  const cap = createDailyCap(memoryKv(), { cap: 1 });
  assert.strictEqual((await cap.take()).allowed, true);
  assert.strictEqual((await cap.take()).allowed, false);
});
