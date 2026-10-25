import test from 'node:test';
import assert from 'node:assert';
import { createDemoSessionHandler } from '../demo_session.js';
import { sessionFromRequest } from '../session.js';
import { createRateLimiter } from '../limits.js';
import { memoryKv } from '../kv.js';

const SECRET = 'a-long-random-owner-secret';
const post = (handler, body, headers = {}) => handler(new Request('http://x/api/demo-session', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
}));
const sessionOf = (res, env) => sessionFromRequest(new Request('http://x/', { headers: { cookie: res.headers.get('set-cookie').split(';')[0] } }), env);

test('the switcher endpoint validates the role and sets a server-side session cookie', async () => {
  const env = {};
  const res = await post(createDemoSessionHandler(env), { role: 'broker' });
  assert.strictEqual(res.status, 200);
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.strictEqual(sessionOf(res, env).role, 'broker');
});

test('all four roles can be switched to, and nothing else', async () => {
  const env = {};
  const h = createDemoSessionHandler(env);
  for (const role of ['broker', 'seller', 'buyer', 'lender']) assert.strictEqual(sessionOf(await post(h, { role }), env).role, role);
  for (const role of ['ai_agent', 'aiagent', 'agent', 'admin', 'audit', '', 'constructor', '__proto__', 7, null]) {
    const res = await post(h, { role });
    assert.strictEqual(res.status, 400, String(role));
    assert.ok(!res.headers.get('set-cookie'));
  }
});

test('the role is read only from the JSON body of this one endpoint; garbage is rejected', async () => {
  const h = createDemoSessionHandler({});
  assert.strictEqual((await post(h, 'not json')).status, 400);
  assert.strictEqual((await h(new Request('http://x/api/demo-session?role=broker', { method: 'POST' }))).status, 400);
});

test('GET is not allowed: switching changes state', async () => {
  const res = await createDemoSessionHandler({})(new Request('http://x/api/demo-session?role=broker'));
  assert.strictEqual(res.status, 405);
  assert.ok(!res.headers.get('set-cookie'));
});

test('every switch starts a clean session, even back to a role used before', async () => {
  const env = {};
  const h = createDemoSessionHandler(env);
  const ids = new Set();
  for (const role of ['broker', 'buyer', 'broker']) ids.add(sessionOf(await post(h, { role }), env).sessionId);
  assert.strictEqual(ids.size, 3);
});

test('only known deals can be chosen', async () => {
  const h = createDemoSessionHandler({});
  assert.strictEqual((await post(h, { role: 'broker', deal: 'tx_unknown_city' })).status, 200);
  assert.strictEqual((await post(h, { role: 'broker', deal: 'TX-SOMEONE-ELSE' })).status, 400);
});

test('it works on Vercel in demo mode, and the cookie is Secure there', async () => {
  const env = { VERCEL: '1', AGENT_SESSION_SECRET: SECRET };
  const res = await post(createDemoSessionHandler(env), { role: 'seller' });
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('set-cookie'), /Secure/);
  assert.strictEqual(sessionOf(res, env).role, 'seller');
});

test('on Vercel without the owner\'s secret it says so, without revealing anything', async () => {
  const res = await post(createDemoSessionHandler({ VERCEL: '1' }), { role: 'broker' });
  assert.strictEqual(res.status, 503);
  assert.ok(!res.headers.get('set-cookie'));
});

test('the response never contains the session token or the secret', async () => {
  const env = { VERCEL: '1', AGENT_SESSION_SECRET: SECRET };
  const res = await post(createDemoSessionHandler(env), { role: 'buyer' });
  const body = await res.text();
  const token = res.headers.get('set-cookie').split(';')[0].split('=')[1];
  assert.ok(!body.includes(token) && !body.includes(SECRET));
  assert.deepStrictEqual(JSON.parse(body), { role: 'buyer' });
});

test('it is rate limited per client', async () => {
  const limiter = createRateLimiter(memoryKv());
  const h = createDemoSessionHandler({}, { limiter, perMinute: 3 });
  const as = ip => post(h, { role: 'buyer' }, { 'x-forwarded-for': ip });
  for (let i = 0; i < 3; i++) assert.strictEqual((await as('1.1.1.1')).status, 200);
  const blocked = await as('1.1.1.1');
  assert.strictEqual(blocked.status, 429);
  assert.ok(!blocked.headers.get('set-cookie'));
  assert.strictEqual((await as('2.2.2.2')).status, 200, 'another client is unaffected');
});
