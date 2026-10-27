// Picks storage for the environment. Hosted (Vercel) always uses Upstash; file-backed storage
// is for local development only and is never used there (reminders.md R1/R7).
import { createRepository, fileStorage, kvStorage } from './repository.js';
import { createEventLog, fileEventStore, kvEventStore } from './events.js';
import { createSeenFieldStore, createThreadStore } from './threads.js';
import { createDailyCap, createRateLimiter } from './limits.js';
import { memoryKv, upstashKv } from './kv.js';
import { createInboxStore } from './inbox.js';

export function createRuntime(env = process.env, { fetch = globalThis.fetch } = {}) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!(url && token) && env.VERCEL) {
    throw new Error('Upstash is required on Vercel: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
  }
  const hosted = Boolean(url && token);
  const kv = hosted ? upstashKv({ url, token, fetch }) : memoryKv();
  return {
    local: !hosted,
    kv,
    repository: createRepository(hosted ? kvStorage(kv) : fileStorage()),
    eventLog: createEventLog(hosted ? kvEventStore(kv) : fileEventStore()),
    threads: createThreadStore(kv),
    seenFields: createSeenFieldStore(kv),
    inbox: createInboxStore(kv),
    limiter: createRateLimiter(kv),
    dailyCap: createDailyCap(kv),
  };
}
