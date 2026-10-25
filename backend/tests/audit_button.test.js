// Runs the app's real script against a stub DOM and renders brokerView for each role.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as Rules from '../../rules.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function loadApp() {
  const stub = () => new Proxy(function () {}, {
    get: (t, p) => (p === Symbol.toPrimitive ? () => '' : p === 'length' ? 0 : stub()),
    apply: () => stub(), set: () => true, construct: () => stub(),
  });
  const ctx = { document: stub(), localStorage: { getItem: () => null, setItem() {} }, console,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, addEventListener() {},
    location: { hash: '' }, navigator: {}, Intl, Date, JSON, Math, Rules };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const src = html.match(/<script id="app-src" type="text\/plain">([\s\S]*?)<\/script>/)[1];
  vm.runInContext(src, ctx);
  return ctx;
}

const app = loadApp();
const render = role => vm.runInContext(`brokerView(${JSON.stringify({ role })})`, app);

test('the Audit log button is rendered for the broker', () => {
  assert.match(render('broker'), /Audit log/);
  assert.match(render('broker'), /openAuditLog\(\)/);
});

test('the Audit log button is not rendered for seller, buyer, lender or audit', () => {
  for (const role of ['seller', 'buyer', 'lender', 'audit']) {
    assert.ok(!/Audit log/.test(render(role)), role);
    assert.ok(!/openAuditLog/.test(render(role)), role);
  }
});

test('the session is requested as the viewer\'s own role, never a hard-coded broker, and only for the four roles', () => {
  const sync = vm.runInContext('syncDemoRole.toString()', app);
  assert.match(sync, /VIEWERS\[view\]\.role/);
  assert.match(sync, /DEMO_ROLES\.includes\(role\)/);
  assert.ok(!/role:\s*'broker'/.test(sync));
  assert.deepStrictEqual(JSON.parse(vm.runInContext('JSON.stringify(DEMO_ROLES)', app)), ['broker', 'seller', 'buyer', 'lender']);
});

test('the switcher posts to the demo-session endpoint, never GET', () => {
  const sync = vm.runInContext('syncDemoRole.toString()', app);
  assert.match(sync, /\/api\/demo-session/);
  assert.match(sync, /method:'POST'/);
});
