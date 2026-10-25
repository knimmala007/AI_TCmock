import test from 'node:test';
import assert from 'node:assert';
import { createStaticServer } from '../scripts/serve.js';

async function withServer(fn) {
  const server = createStaticServer({ env: {} });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(r => server.close(r)); }
}

test('serves the app and the shared rules module', async () => {
  await withServer(async base => {
    const page = await fetch(`${base}/`);
    assert.strictEqual(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    const rules = await fetch(`${base}/rules.js`);
    assert.strictEqual(rules.status, 200);
    assert.match(rules.headers.get('content-type'), /javascript/);
  });
});

test('never serves anything outside the allowlist', async () => {
  await withServer(async base => {
    for (const p of ['/.env', '/backend/data/deals.json', '/backend/fixtures.js', '/.claude/CLAUDE.md', '/package.json',
      '/docs/adr/0001-hybrid-memory-deal-file-is-truth.md', '/%2e%2e/etc/passwd', '/..%2f..%2fetc/passwd', '/docs/../.env']) {
      const res = await fetch(`${base}${p}`);
      assert.strictEqual(res.status, 404, p);
    }
  });
});

test('routes /api/<name> to the function and returns its Response', async () => {
  await withServer(async base => {
    const res = await fetch(`${base}/api/events?turn=x`);
    assert.strictEqual(res.status, 401, 'no session, so the audit page refuses');
    const dev = await fetch(`${base}/api/demo-session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: 'seller' }) });
    assert.strictEqual(dev.status, 200);
    const cookie = dev.headers.get('set-cookie').split(';')[0];
    const denied = await fetch(`${base}/api/events?turn=x`, { headers: { cookie } });
    assert.strictEqual(denied.status, 403, 'a seller session is refused');
  });
});

test('an unknown or malformed api route is a 404', async () => {
  await withServer(async base => {
    for (const p of ['/api/nope', '/api/../package', '/api/%2e%2e/x', '/api/']) {
      assert.strictEqual((await fetch(`${base}${p}`)).status, 404, p);
    }
  });
});
