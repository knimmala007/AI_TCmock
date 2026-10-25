import test from 'node:test';
import assert from 'node:assert';
import { cookieName, sessionFromRequest, signSession } from '../session.js';

const req = (token, headers = {}) => new Request('http://x/api/events', {
  headers: { ...(token ? { cookie: `${cookieName}=${token}` } : {}), ...headers },
});
const env = (o = {}) => ({ ...o });
const hosted = (o = {}) => env({ VERCEL: '1', AGENT_SESSION_SECRET: 'a-long-random-owner-secret', ...o });

test('a signed session round-trips with its role, session id and deal', () => {
  const token = signSession({ role: 'broker', sessionId: 's-1', dealId: 'TX-CG118' }, env());
  assert.deepStrictEqual(sessionFromRequest(req(token), env()), { role: 'broker', sessionId: 's-1', dealId: 'TX-CG118' });
});

test('every new session gets its own id unless one is given', () => {
  const a = sessionFromRequest(req(signSession({ role: 'buyer', dealId: 'TX-CG118' }, env())), env());
  const b = sessionFromRequest(req(signSession({ role: 'buyer', dealId: 'TX-CG118' }, env())), env());
  assert.ok(a.sessionId && b.sessionId && a.sessionId !== b.sessionId);
});

test('no cookie, no session', () => {
  assert.strictEqual(sessionFromRequest(req(null), env()), null);
});

test('a tampered token is rejected', () => {
  const token = signSession({ role: 'seller', dealId: 'TX-CG118' }, env());
  const [body, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ role: 'broker', sessionId: 'x', dealId: 'TX-CG118' })).toString('base64url');
  assert.strictEqual(sessionFromRequest(req(`${forged}.${sig}`), env()), null);
  assert.strictEqual(sessionFromRequest(req(`${body}.AAAA`), env()), null);
});

test('only the four roles can be signed, and no AI-agent-style role exists', () => {
  for (const role of ['ai_agent', 'aiagent', 'agent', 'admin', 'audit', '', undefined, 'constructor', '__proto__']) {
    assert.throws(() => signSession({ role, dealId: 'TX-CG118' }, env()), /unknown role/, String(role));
  }
});

test('a token with a role outside the four is rejected even when correctly signed', () => {
  const e = env();
  const good = signSession({ role: 'broker', dealId: 'TX-CG118' }, e);
  const [, sig] = good.split('.');
  const body = Buffer.from(JSON.stringify({ role: 'ai_agent', sessionId: 'x', dealId: 'TX-CG118' })).toString('base64url');
  assert.strictEqual(sessionFromRequest(req(`${body}.${sig}`), e), null);
});

test('only known deals can be put in a session', () => {
  assert.throws(() => signSession({ role: 'broker', dealId: 'TX-SOMEONE-ELSE' }, env()), /unknown deal/);
});

test('the role is never read from the request, only from the signed session', () => {
  const token = signSession({ role: 'buyer', dealId: 'TX-CG118' }, env());
  const r = new Request('http://x/api/events?role=broker', {
    headers: { cookie: `${cookieName}=${token}`, 'x-role': 'broker' },
  });
  assert.strictEqual(sessionFromRequest(r, env()).role, 'buyer');
});

test('the demo session works with VERCEL set (demo mode, no sign-in)', () => {
  const e = hosted();
  const token = signSession({ role: 'broker', dealId: 'TX-CG118' }, e);
  assert.strictEqual(sessionFromRequest(req(token), e).role, 'broker');
});

test('on Vercel it refuses to run without an owner-set signing secret', () => {
  assert.throws(() => signSession({ role: 'broker', dealId: 'TX-CG118' }, env({ VERCEL: '1' })), /AGENT_SESSION_SECRET/);
  const token = signSession({ role: 'broker', dealId: 'TX-CG118' }, env());
  assert.strictEqual(sessionFromRequest(req(token), env({ VERCEL: '1' })), null);
});

test('a token signed with a different secret is rejected', () => {
  const token = signSession({ role: 'broker', dealId: 'TX-CG118' }, env({ AGENT_SESSION_SECRET: 'one' }));
  assert.strictEqual(sessionFromRequest(req(token), env({ AGENT_SESSION_SECRET: 'two' })), null);
});
