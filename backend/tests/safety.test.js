import test from 'node:test';
import assert from 'node:assert';
import { redactDeal, scrubText } from '../safety.js';
import { redact } from '../events.js';

test('scrubText removes emails, phone numbers, SSN-like numbers and API keys', () => {
  const out = scrubText('Mail jane.doe@example.com or call (408) 555-0199, SSN 123-45-6789, key sk-ant-api03-abcdef');
  for (const s of ['jane.doe@example.com', '555-0199', '123-45-6789', 'sk-ant-api03-abcdef']) assert.ok(!out.includes(s), s);
  assert.ok(out.includes('[REDACTED]'));
});

test('scrubText leaves ordinary deal text alone', () => {
  const text = '118 Cottage Grove Avenue, San Jose, APN 434-24-002, built 1947, listed 10/29/2025';
  assert.strictEqual(scrubText(text), text);
});

test('redactDeal scrubs every string in a deal, deeply, without changing the original', () => {
  const deal = { seller: 'Seller Corp.', data: { agent: { v: 'Pat <pat@example.com>', src: 'RLA' } }, list: ['call 408-555-0101'] };
  const out = redactDeal(deal);
  assert.ok(!JSON.stringify(out).includes('pat@example.com') && !JSON.stringify(out).includes('555-0101'));
  assert.strictEqual(out.seller, 'Seller Corp.');
  assert.ok(deal.data.agent.v.includes('pat@example.com'), 'the original is untouched');
});

test('the seed deals contain nothing that redactDeal would change', async () => {
  const { SEED_DEALS } = await import('../fixtures.js');
  for (const deal of Object.values(SEED_DEALS)) assert.deepStrictEqual(redactDeal(deal), deal, deal.transaction_id);
});

test('logged events never contain an API key', () => {
  const out = JSON.stringify(redact({ headers: { 'x-api-key': 'sk-ant-secret' }, msg: 'oops sk-ant-api03-zzz' }));
  assert.ok(!out.includes('sk-ant-secret') && !out.includes('sk-ant-api03-zzz'));
});
