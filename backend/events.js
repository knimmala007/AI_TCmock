// The agent_events log and its one logging helper (ADR 0004).
//
// logEvent is called from three places: around each model call (start/end) and around each
// tool execution (start/end). Payloads are redacted before they are written. Storage is
// injected: memory (tests), a JSONL file (local dev), later the real audit sink (reminders.md R7).
import fs from 'node:fs/promises';
import path from 'node:path';
import { EVENTS_PATH } from './config.js';

export const EVENT_TYPES = new Set(['model_call_start', 'model_call_end', 'tool_start', 'tool_end']);

const KEY_PATTERN = /sk-ant-[A-Za-z0-9_-]+/g;
const SECRET_NAMES = new Set(['x-api-key', 'api_key', 'authorization', 'anthropic_api_key']);

export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) =>
      [k, SECRET_NAMES.has(k.toLowerCase()) ? '[REDACTED]' : redact(v)]));
  }
  if (typeof value === 'string') return value.replace(KEY_PATTERN, '[REDACTED]');
  return value;
}

export function memoryEventStore() {
  const rows = [];
  return {
    rows,
    async append(row) { rows.push(row); },
    async list(turnId) { return rows.filter(r => r.turn_id === turnId); },
  };
}

export function fileEventStore(file = EVENTS_PATH) {
  return {
    async append(row) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.appendFile(file, JSON.stringify(row) + '\n');
    },
    async list(turnId) {
      let text;
      try { text = await fs.readFile(file, 'utf8'); }
      catch (e) { if (e.code === 'ENOENT') return []; throw e; }
      return text.split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => r.turn_id === turnId);
    },
  };
}

// One list per turn in a key-value store (Upstash when hosted). No expiry: this is the audit trail.
export function kvEventStore(kv) {
  const key = turnId => `agent_events:${encodeURIComponent(turnId)}`;
  return {
    async append(row) { await kv.exec(['RPUSH', key(row.turn_id), JSON.stringify(row)]); },
    async list(turnId) { return ((await kv.exec(['LRANGE', key(turnId), 0, -1])) || []).map(r => JSON.parse(r)); },
  };
}

export function createEventLog(store = fileEventStore()) {
  return {
    async logEvent(sessionId, turnId, role, transactionId, eventType, payload) {
      if (!EVENT_TYPES.has(eventType)) throw new Error(`unknown event type: ${eventType}`);
      await store.append({
        ts: new Date().toISOString(), session_id: sessionId, turn_id: turnId, role,
        transaction_id: transactionId, event_type: eventType, payload: redact(payload),
      });
    },
    async eventsForTurn(turnId) { return store.list(turnId); },
  };
}
