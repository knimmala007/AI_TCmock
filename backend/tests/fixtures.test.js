import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_FORMS, DOCS, QUESTIONS, SEED_DEALS, SELLER_STAGES } from '../fixtures.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('docs are the real 44 with 42 executed PDFs', () => {
  const codes = DOCS.map(d => d.code);
  assert.strictEqual(new Set(codes).size, 44);
  assert.strictEqual(codes.length, 44);
  assert.strictEqual(DOCS.filter(d => d.has_pdf).length, 42);
  assert.deepStrictEqual(DOCS.filter(d => !d.has_pdf).map(d => d.code).sort(), ['POOL', 'SOLAR']);
});

test('base forms are real doc codes', () => {
  const codes = new Set(DOCS.map(d => d.code));
  assert.ok(BASE_FORMS.every(c => codes.has(c)));
});

test('six real seller stages', () => {
  assert.deepStrictEqual(SELLER_STAGES, ['Listing Signed', 'Disclosures', 'Offer Accepted', 'Inspection', 'Escrow', 'Closed']);
});

test('Cottage Grove is real and closed', () => {
  const d = SEED_DEALS['TX-CG118'];
  assert.strictEqual(d.synthetic, false);
  assert.deepStrictEqual([d.city, d.county], ['San Jose', 'Santa Clara']);
  assert.strictEqual(SELLER_STAGES[d.seller_stage], 'Closed');
});

test('never-received fields come from the app\'s logic', () => {
  const d = SEED_DEALS['TX-CG118'];
  assert.deepStrictEqual(d.never_received.map(n => n.field), ['permitHistory', 'tenancyStatus']);
  assert.ok(!('permitHistory' in d.data) && !('tenancyStatus' in d.data));
});

test('Austin is labelled synthetic', () => {
  const d = SEED_DEALS.tx_unknown_city;
  assert.strictEqual(d.synthetic, true);
  assert.deepStrictEqual([d.city, d.county], ['Austin', 'Travis']);
  assert.ok(Object.values(d.answers).every(a => a.src === 'SYNTHETIC'));
});

test('question keys are unique and every question fills something', () => {
  const keys = QUESTIONS.map(q => q.k);
  assert.strictEqual(new Set(keys).size, keys.length);
  assert.ok(QUESTIONS.every(q => q.fills.length));
});

test('fixtures.json is in sync with index.html (regenerate with the extract script)', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const i = html.indexOf('const DOCS = [');
  const block = html.slice(i, html.indexOf('\n];', i));
  const inHtml = [...block.matchAll(/\{code:'([^']+)'/g)].map(m => m[1]);
  assert.deepStrictEqual(inHtml, DOCS.map(d => d.code));
});
