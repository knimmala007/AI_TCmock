// Recent chat turns, and the set of field names the model has seen, per deal, SESSION and role,
// in a key-value store with an expiry.
//
// Both are context only. Chat turns are never a source of facts (ADR 0001). Keying by session AND role
// means a role switch (which starts a new session) begins with an empty thread and an empty seen set,
// so nothing one role saw can reach another (spec, section 4).
import { THREAD_MESSAGES_KEPT, THREAD_TTL_SECONDS } from './config.js';
import { ROLE_TOOLS } from './roles.js';

const MESSAGE_ROLES = new Set(['user', 'assistant']);

function keyFor(prefix, { dealId, sessionId, role }) {
  if (typeof role !== 'string' || !Object.hasOwn(ROLE_TOOLS, role)) throw new Error(`unknown role: ${role}`);
  if (!sessionId) throw new Error('a session id is required');
  // Encode each part so a ':' in one cannot make two different scopes share a key.
  return [prefix, dealId, sessionId, role].map(encodeURIComponent).join(':');
}

export function createThreadStore(kv) {
  return {
    async append(scope, message) {
      if (!MESSAGE_ROLES.has(message.role)) throw new Error(`message role must be user or assistant, got ${message.role}`);
      const key = keyFor('thread', scope);
      await kv.pipeline([
        ['RPUSH', key, JSON.stringify({ role: message.role, content: message.content })],
        ['LTRIM', key, -THREAD_MESSAGES_KEPT, -1],
        ['EXPIRE', key, THREAD_TTL_SECONDS],
      ]);
    },
    async recent(scope) {
      const rows = await kv.exec(['LRANGE', keyFor('thread', scope), 0, -1]);
      return (rows || []).map(r => JSON.parse(r));
    },
  };
}

export function createSeenFieldStore(kv) {
  return {
    async add(scope, names) {
      const key = keyFor('seen', scope);
      await kv.pipeline([['SADD', key, ...names], ['EXPIRE', key, THREAD_TTL_SECONDS]]);
    },
    async list(scope) { return kv.exec(['SMEMBERS', keyFor('seen', scope)]); },
    async has(scope, name) { return (await kv.exec(['SISMEMBER', keyFor('seen', scope), name])) === 1; },
  };
}
