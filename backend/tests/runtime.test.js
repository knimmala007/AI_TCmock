import test from 'node:test';
import assert from 'node:assert';
import { createRuntime } from '../runtime.js';

const env = (o = {}) => ({ ...o });

test('on Vercel without Upstash configured it refuses to start', () => {
  assert.throws(() => createRuntime(env({ VERCEL: '1' })), /Upstash/);
});

test('on Vercel with Upstash it uses Upstash for deals, events and threads', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => ({ result: null }) };
  };
  const rt = createRuntime(env({ VERCEL: '1', UPSTASH_REDIS_REST_URL: 'https://x.upstash.io', UPSTASH_REDIS_REST_TOKEN: 't' }), { fetch });
  await rt.repository.get('TX-CG118');
  await rt.threads.recent({ dealId: 'TX-CG118', role: 'broker', sessionId: 's1' });
  assert.ok(calls.length >= 2, 'every read went over the Upstash REST API');
  assert.strictEqual(rt.local, false);
});

test('off Vercel without Upstash it falls back to local storage', () => {
  const rt = createRuntime(env());
  assert.strictEqual(rt.local, true);
});
