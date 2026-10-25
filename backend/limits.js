// Brakes for the public endpoints: a per-client rate limit and a global daily model-call cap.
// Counters live in the key-value store (Upstash when hosted), so they hold across function instances.
import { DAILY_MODEL_CALL_CAP } from './config.js';

export function createRateLimiter(kv, { now = () => Date.now() } = {}) {
  return {
    // Fixed window: at most `limit` hits per `windowSeconds` for this name.
    async hit(name, { limit, windowSeconds }) {
      const bucket = Math.floor(now() / 1000 / windowSeconds);
      const key = `rl:${encodeURIComponent(name)}:${bucket}`;
      const [count] = await kv.pipeline([['INCR', key], ['EXPIRE', key, windowSeconds * 2]]);
      return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
    },
  };
}

export function createDailyCap(kv, { cap = DAILY_MODEL_CALL_CAP, now = () => Date.now() } = {}) {
  return {
    // Call before every model call. When it says no, the turn must end with a plain message.
    async take() {
      const day = new Date(now()).toISOString().slice(0, 10);
      const key = `cap:model_calls:${day}`;
      const [count] = await kv.pipeline([['INCR', key], ['EXPIRE', key, 2 * 24 * 60 * 60]]);
      return { allowed: count <= cap, remaining: Math.max(0, cap - count) };
    },
  };
}
