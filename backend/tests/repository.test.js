import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRepository, fileStorage, memoryStorage } from '../repository.js';
import { SEED_DEALS } from '../fixtures.js';

test('first use seeds the store', async () => {
  const repo = createRepository(memoryStorage());
  assert.strictEqual((await repo.get('TX-CG118')).city, 'San Jose');
});

test('unknown transaction returns null', async () => {
  assert.strictEqual(await createRepository(memoryStorage()).get('nope'), null);
});

test('save persists across repositories sharing a store', async () => {
  const store = memoryStorage();
  const repo = createRepository(store);
  const deal = await repo.get('tx_unknown_city');
  deal.answers.escrow = { v: 'Chicago Title', src: 'test' };
  await repo.save(deal);
  assert.strictEqual((await createRepository(store).get('tx_unknown_city')).answers.escrow.v, 'Chicago Title');
});

test('get returns a copy', async () => {
  const repo = createRepository(memoryStorage());
  (await repo.get('tx_unknown_city')).answers.escrow = { v: 'x', src: 'test' };
  assert.ok(!('escrow' in (await repo.get('tx_unknown_city')).answers));
});

test('reset restores the seed', async () => {
  const repo = createRepository(memoryStorage());
  const deal = await repo.get('tx_unknown_city');
  deal.answers.escrow = { v: 'x', src: 'test' };
  await repo.save(deal);
  await repo.reset();
  assert.deepStrictEqual(await repo.get('tx_unknown_city'), SEED_DEALS.tx_unknown_city);
});

test('file storage writes plain JSON and survives a new instance', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'deals-')), 'nested', 'deals.json');
  const repo = createRepository(fileStorage(file));
  const deal = await repo.get('tx_unknown_city');
  deal.answers.escrow = { v: 'Chicago Title', src: 'test' };
  await repo.save(deal);
  assert.deepStrictEqual(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))).sort(), Object.keys(SEED_DEALS).sort());
  assert.strictEqual((await createRepository(fileStorage(file)).get('tx_unknown_city')).answers.escrow.v, 'Chicago Title');
});

test('kv storage round-trips deals through a key-value store', async () => {
  const { memoryKv } = await import('../kv.js');
  const { kvStorage } = await import('../repository.js');
  const kv = memoryKv();
  const repo = createRepository(kvStorage(kv));
  const deal = await repo.get('tx_unknown_city');
  deal.answers.escrow = { v: 'Chicago Title', src: 'test' };
  await repo.save(deal);
  assert.strictEqual((await createRepository(kvStorage(kv)).get('tx_unknown_city')).answers.escrow.v, 'Chicago Title');
});
