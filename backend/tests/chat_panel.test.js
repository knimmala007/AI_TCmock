// Runs the app's real script against a stub DOM and a fake fetch, and drives the chat panel per role.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as Rules from '../../rules.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// respond(url, init) -> {status, body}; every call is recorded in calls.
function loadApp(respond = () => ({ status: 200, body: { reply: 'ok' } })) {
  const stub = () => new Proxy(function () {}, {
    get: (t, p) => (p === Symbol.toPrimitive ? () => '' : p === 'length' ? 0 : stub()),
    apply: () => stub(), set: () => true, construct: () => stub(),
  });
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const { status, body } = respond(url, init);
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  };
  const ctx = { document: stub(), localStorage: { getItem: () => null, setItem() {} }, console,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, addEventListener() {},
    location: { hash: '' }, navigator: {}, Intl, Date, JSON, Math, Rules, fetch };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const src = html.match(/<script id="app-src" type="text\/plain">([\s\S]*?)<\/script>/)[1];
  vm.runInContext(src, ctx);
  return { app: ctx, calls, run: code => vm.runInContext(code, ctx) };
}

const VIEW_FN = { broker: 'brokerView', seller: 'sellerView', buyer: 'buyerView' };
const renderView = (t, role) => t.run(`${VIEW_FN[role]}(VIEWERS.${role})`);
const send = (t, role, text) => { t.run(`view=${JSON.stringify(role)}`); return t.run(`chatSend(${JSON.stringify(text)})`); };
const agentCalls = t => t.calls.filter(c => c.url === '/api/agent');

test('the panel is rendered in the broker, seller and buyer views', () => {
  const t = loadApp();
  for (const role of ['broker', 'seller', 'buyer']) {
    const out = renderView(t, role);
    assert.match(out, /id="chat-log"/, role);
    assert.match(out, /sendChat\(\)/, role);
  }
});

test('the panel starts a session as the viewer\'s role, then posts only the message', async () => {
  for (const role of ['broker', 'seller', 'buyer']) {
    const t = loadApp();
    await send(t, role, 'hello');
    assert.deepStrictEqual(t.calls.map(c => c.url), ['/api/demo-session', '/api/agent'], role);
    assert.deepStrictEqual(JSON.parse(t.calls[0].init.body), { role });
    const a = t.calls[1].init;
    assert.strictEqual(a.method, 'POST');
    assert.deepStrictEqual(JSON.parse(a.body), { message: 'hello' }, 'no role, deal or session in the body');
  }
});

test('if the session cannot be started, nothing is sent and a plain message is shown', async () => {
  const t = loadApp(url => (url === '/api/demo-session' ? { status: 503, body: {} } : { status: 200, body: { reply: 'x' } }));
  await send(t, 'broker', 'hello');
  assert.strictEqual(agentCalls(t).length, 0);
  assert.match(renderView(t, 'broker'), /Could not start a session/);
});

test('sending shows the reply, escaped', async () => {
  const t = loadApp(() => ({ status: 200, body: { reply: 'Escrow closes <b>Friday</b>', turnId: 't1' } }));
  await send(t, 'seller', 'when do we close?');
  const out = renderView(t, 'seller');
  assert.match(out, /when do we close\?/);
  assert.match(out, /Escrow closes &lt;b&gt;Friday&lt;\/b&gt;/);
  assert.ok(!/<b>Friday<\/b>/.test(out));
});

test('401, 429 and 503 each show a plain message, never raw JSON or an error code', async () => {
  const cases = [
    [401, { error: 'UNAUTHENTICATED', message: 'Pick a role first.' }, /Pick a role first\./],
    [429, { reply: 'You are sending messages too quickly. Please wait a minute and try again.' }, /too quickly/],
    [429, { reply: 'The assistant has reached today\'s limit.' }, /today&#39;s limit|today's limit/],
    [503, { error: 'MODEL_NOT_CONFIGURED', message: 'The assistant is not set up yet.' }, /not set up yet/],
    [503, { error: 'DEMO_NOT_CONFIGURED' }, /not available right now/],
    [500, {}, /Something went wrong/],
  ];
  for (const [status, body, want] of cases) {
    const t = loadApp(url => (url === '/api/agent' ? { status, body } : { status: 200, body: { role: 'broker' } }));
    await send(t, 'broker', 'hi');
    const out = renderView(t, 'broker');
    assert.match(out, want, `${status}`);
    assert.match(out, /class="m m-note"/, `${status}`);
    assert.ok(!/UNAUTHENTICATED|MODEL_NOT_CONFIGURED|DEMO_NOT_CONFIGURED|\{"/.test(out), `${status}`);
  }
});

test('after a 401 the next send starts a session again', async () => {
  let first = true;
  const t = loadApp(url => {
    if (url !== '/api/agent') return { status: 200, body: {} };
    if (first) { first = false; return { status: 401, body: { message: 'Pick a role first.' } }; }
    return { status: 200, body: { reply: 'ok' } };
  });
  await send(t, 'broker', 'one');
  await send(t, 'broker', 'two');
  assert.deepStrictEqual(t.calls.map(c => c.url), ['/api/demo-session', '/api/agent', '/api/demo-session', '/api/agent']);
});

test('switching roles clears the panel and shows no earlier turns, even when switching back', async () => {
  const t = loadApp(() => ({ status: 200, body: { reply: 'broker-only reply' } }));
  await send(t, 'broker', 'broker question');
  assert.match(renderView(t, 'broker'), /broker question/);
  for (const role of ['seller', 'buyer', 'broker']) {
    const out = renderView(t, role);
    assert.ok(!/broker question|broker-only reply/.test(out), role);
  }
});

test('a reply that arrives after a role switch is dropped', async () => {
  let release;
  const t = loadApp(url => (url === '/api/agent' ? { status: 200, body: { reply: 'late reply' } } : { status: 200, body: {} }));
  const origFetch = t.app.fetch;
  t.app.fetch = async (url, init) => {
    if (url === '/api/agent') await new Promise(r => { release = r; });
    return origFetch(url, init);
  };
  const pending = send(t, 'broker', 'slow question');
  await new Promise(r => setImmediate(r));
  renderView(t, 'seller');
  release();
  await pending;
  assert.ok(!/late reply|slow question/.test(renderView(t, 'seller')));
  assert.ok(!/late reply|slow question/.test(renderView(t, 'broker')));
});

test('no key or token is in the page', () => {
  assert.ok(!/sk-ant|api[_-]?key|x-api-key|authorization|bearer|AGENT_SESSION_SECRET|UPSTASH|ANTHROPIC/i.test(html));
});
