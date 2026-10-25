import test from 'node:test';
import assert from 'node:assert';
import { createEventLog, memoryEventStore } from '../events.js';
import { createEventsPageHandler } from '../events_page.js';
import { cookieName, sessionFromRequest, signSession } from '../session.js';

const env = {};
async function setup() {
  const eventLog = createEventLog(memoryEventStore());
  await eventLog.logEvent('s1', 'turn-1', 'broker', 'TX-CG118', 'tool_start', { tool: 'get_deal', note: 'BROKER-ONLY-DATA' });
  await eventLog.logEvent('s1', 'turn-1', 'broker', 'TX-CG118', 'tool_end', { ok: true });
  await eventLog.logEvent('s2', 'turn-2', 'broker', 'tx_unknown_city', 'tool_start', { tool: 'get_deal', note: 'OTHER-DEAL' });
  const handler = createEventsPageHandler({ eventLog, getSession: r => sessionFromRequest(r, env) });
  return { eventLog, handler };
}
const as = (role, url = 'http://x/api/events?turn=turn-1', headers = {}) => new Request(url, {
  headers: { cookie: `${cookieName}=${signSession({ role, sessionId: 's-1', dealId: 'TX-CG118' }, env)}`, ...headers },
});

test('the broker sees the events of a turn', async () => {
  const { handler } = await setup();
  const res = await handler(as('broker'));
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.ok(html.includes('tool_start') && html.includes('tool_end') && html.includes('BROKER-ONLY-DATA'));
});

for (const role of ['seller', 'buyer', 'lender']) {
  test(`${role} requests to the audit page are refused, and nothing is leaked`, async () => {
    const { handler } = await setup();
    const res = await handler(as(role));
    assert.strictEqual(res.status, 403);
    const body = await res.text();
    assert.ok(body.includes('ROLE_FORBIDDEN'));
    assert.ok(!body.includes('BROKER-ONLY-DATA') && !body.includes('tool_start'));
  });
}

test('a non-broker cannot get in by claiming the broker role in the query, a header or the body', async () => {
  const { handler } = await setup();
  for (const r of [
    as('buyer', 'http://x/api/events?turn=turn-1&role=broker'),
    as('buyer', 'http://x/api/events?turn=turn-1', { 'x-role': 'broker', 'x-user-role': 'broker' }),
    new Request('http://x/api/events?turn=turn-1', { method: 'POST', body: JSON.stringify({ role: 'broker' }),
      headers: { cookie: as('buyer').headers.get('cookie') } }),
  ]) {
    assert.strictEqual((await handler(r)).status, 403);
  }
});

test('no session is unauthenticated, not forbidden', async () => {
  const { handler } = await setup();
  const res = await handler(new Request('http://x/api/events?turn=turn-1'));
  assert.strictEqual(res.status, 401);
  assert.ok(!(await res.text()).includes('BROKER-ONLY-DATA'));
});

test('the broker sees only events for the session\'s own deal', async () => {
  const { handler } = await setup();
  const html = await (await handler(as('broker', 'http://x/api/events?turn=turn-2'))).text();
  assert.ok(!html.includes('OTHER-DEAL'));
});

test('event contents are HTML-escaped', async () => {
  const eventLog = createEventLog(memoryEventStore());
  await eventLog.logEvent('s1', 'turn-x', 'broker', 'TX-CG118', 'tool_start', { note: '<script>alert(1)</script>' });
  const handler = createEventsPageHandler({ eventLog, getSession: r => sessionFromRequest(r, env) });
  const html = await (await handler(as('broker', 'http://x/api/events?turn=turn-x'))).text();
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('without a turn id the broker gets a form to enter one', async () => {
  const { handler } = await setup();
  const res = await handler(as('broker', 'http://x/api/events'));
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /<form/);
});

test('responses are not cached', async () => {
  const { handler } = await setup();
  assert.match((await handler(as('broker'))).headers.get('cache-control'), /no-store/);
  assert.match((await handler(as('seller'))).headers.get('cache-control'), /no-store/);
});

test('the audit page works in demo mode on Vercel, and still refuses the other roles', async () => {
  const hostedEnv = { VERCEL: '1', AGENT_SESSION_SECRET: 'a-long-random-owner-secret' };
  const eventLog = createEventLog(memoryEventStore());
  await eventLog.logEvent('s1', 'turn-1', 'broker', 'TX-CG118', 'tool_start', { note: 'BROKER-ONLY-DATA' });
  const handler = createEventsPageHandler({ eventLog, getSession: r => sessionFromRequest(r, hostedEnv) });
  const withRole = role => new Request('http://x/api/events?turn=turn-1', {
    headers: { cookie: `${cookieName}=${signSession({ role, dealId: 'TX-CG118' }, hostedEnv)}` } });
  assert.strictEqual((await handler(withRole('broker'))).status, 200);
  for (const role of ['seller', 'buyer', 'lender']) assert.strictEqual((await handler(withRole(role))).status, 403, role);
});

test('refusals never contain the signing secret or any key', async () => {
  const { handler } = await setup();
  for (const res of [await handler(as('buyer')), await handler(new Request('http://x/api/events'))]) {
    const body = await res.text();
    assert.ok(!/sk-ant|local-dev-only-secret|AGENT_SESSION_SECRET/.test(body));
  }
});

test('the audit page is rate limited', async () => {
  const { createRateLimiter } = await import('../limits.js');
  const { memoryKv } = await import('../kv.js');
  const eventLog = createEventLog(memoryEventStore());
  const handler = createEventsPageHandler({ eventLog, getSession: r => sessionFromRequest(r, env), limiter: createRateLimiter(memoryKv()), perMinute: 2 });
  assert.strictEqual((await handler(as('broker'))).status, 200);
  assert.strictEqual((await handler(as('broker'))).status, 200);
  assert.strictEqual((await handler(as('broker'))).status, 429);
});
