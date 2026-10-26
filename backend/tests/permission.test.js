// The page's permission layer (canAccess in index.html) and the agent's role registry (roles.js)
// must give every role the same documents. Runs the app's real script against a stub DOM.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as Rules from '../../rules.js';
import { DOCS } from '../fixtures.js';
import * as roles from '../roles.js';

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
  vm.runInContext(html.match(/<script id="app-src" type="text\/plain">([\s\S]*?)<\/script>/)[1], ctx);
  return ctx;
}
const app = loadApp();
const codesVisibleTo = viewer => JSON.parse(vm.runInContext(
  `JSON.stringify(DOCS.filter(d => canAccess(VIEWERS.${viewer}, d)).map(d => d.code))`, app));

test('the broker sees every document on both sides in the page', () => {
  for (const viewer of ['broker', 'agent', 'lab', 'files']) { // every viewer that runs as role broker
    assert.deepStrictEqual(codesVisibleTo(viewer), DOCS.map(d => d.code), viewer);
  }
});

test('the page and the agent registry give seller, buyer and broker the same documents', () => {
  for (const role of ['broker', 'seller', 'buyer']) {
    assert.deepStrictEqual(codesVisibleTo(role), roles.visibleDocCodes(role), role);
  }
});

test('the seller sees seller-side and shared documents, never the appraisal', () => {
  const seen = codesVisibleTo('seller');
  assert.ok(seen.includes('TDS') && seen.includes('WFA'));
  assert.ok(!seen.includes('APPR'));
});

test('the buyer sees buyer-side and shared documents only', () => {
  const seen = codesVisibleTo('buyer');
  assert.ok(seen.includes('APPR') && seen.includes('WFA'));
  assert.ok(!seen.includes('TDS'));
});

test('the audit and evaluation viewers are unchanged: they see nothing in the permission layer', () => {
  for (const viewer of ['audit', 'eval']) {
    assert.deepStrictEqual(codesVisibleTo(viewer), [], viewer);
    assert.strictEqual(vm.runInContext(`VIEWERS.${viewer}.role`, app), 'audit');
  }
});

test('the audit role bypass when opening a document is untouched', () => {
  assert.match(html, /if\(v\.role!=='audit' && !canAccess\(v,d\)\)\{ alert\('Blocked by the permission layer\.'\); return; \}/);
});

test('a role outside broker, seller and buyer gets nothing from canAccess', () => {
  for (const role of ['audit', 'ai_agent', 'lender', '']) {
    assert.strictEqual(vm.runInContext(`canAccess({role:${JSON.stringify(role)}}, DOCS[0])`, app), false, role);
  }
});
