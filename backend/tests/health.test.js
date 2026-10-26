import test from 'node:test';
import assert from 'node:assert';
import { createHealthHandler } from '../health.js';
import { DOCS, QUESTIONS } from '../fixtures.js';
import { BASE_FORMS } from '../../rules.js';

const call = (handler, method = 'GET') => handler(new Request('http://x/api/health', { method }));

test('GET returns ok, the Node version, hosted and the counts', async () => {
  const res = await call(createHealthHandler({}));
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.node, process.version);
  assert.strictEqual(body.hosted, false);
  assert.strictEqual(body.questions, QUESTIONS.length);
  assert.strictEqual(body.documents, DOCS.length);
  assert.strictEqual(body.baseForms, BASE_FORMS.length);
});

test('hosted is true on Vercel', async () => {
  const body = await (await call(createHealthHandler({ VERCEL: '1' }))).json();
  assert.strictEqual(body.hosted, true);
});

test('no environment variable value appears in the response', async () => {
  const env = {
    VERCEL: '1', AGENT_SESSION_SECRET: 'secret-value-123', UPSTASH_REDIS_REST_TOKEN: 'token-value-456',
    UPSTASH_REDIS_REST_URL: 'https://upstash.example/url-789', ANTHROPIC_API_KEY: 'sk-key-000',
  };
  const res = await call(createHealthHandler(env));
  const text = await res.text();
  for (const v of Object.values(env).filter(v => v !== '1')) assert.ok(!text.includes(v), v);
});

test('needs no session, storage or secret: works with an empty environment and no cookie', async () => {
  const res = await call(createHealthHandler({}));
  assert.strictEqual(res.status, 200);
});

test('other methods return 405 with an Allow header', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const res = await call(createHealthHandler({}), method);
    assert.strictEqual(res.status, 405, method);
    assert.strictEqual(res.headers.get('allow'), 'GET');
  }
});
