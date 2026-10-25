// The only module that reads or writes deal data (ADR 0003).
//
// A stand-in. When the real backend arrives, replace this module and follow reminders.md R1:
// re-run all tests and check nothing above this seam changed. Storage is injected so the
// same repository runs on a file (local dev), in memory (tests) or, later, Upstash. The
// interface is async from the start so that swap needs no caller changes.
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_PATH } from './config.js';
import { SEED_DEALS } from './fixtures.js';

const clone = v => structuredClone(v);

export function memoryStorage() {
  let data = null;
  return { async read() { return data && clone(data); }, async write(d) { data = clone(d); } };
}

export function fileStorage(file = DATA_PATH) {
  return {
    async read() {
      try { return JSON.parse(await fs.readFile(file, 'utf8')); }
      catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    },
    async write(d) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(d, null, 2));
    },
  };
}

// Deals as one JSON value in a key-value store (Upstash when hosted).
export function kvStorage(kv, key = 'deals') {
  return {
    async read() { const raw = await kv.exec(['GET', key]); return raw ? JSON.parse(raw) : null; },
    async write(d) { await kv.exec(['SET', key, JSON.stringify(d)]); },
  };
}

export function createRepository(storage = fileStorage()) {
  async function load() {
    let deals = await storage.read();
    if (!deals) { deals = clone(SEED_DEALS); await storage.write(deals); }
    return deals;
  }
  return {
    // Returns a copy of the deal, or null if unknown.
    async get(transactionId) {
      const deal = (await load())[transactionId];
      return deal ? clone(deal) : null;
    },
    async save(deal) {
      const deals = await load();
      deals[deal.transaction_id] = clone(deal);
      await storage.write(deals);
    },
    // Restore the seed.
    async reset() { await storage.write(clone(SEED_DEALS)); },
  };
}
