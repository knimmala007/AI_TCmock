// Single home for tunable constants. Nothing else hard-codes these.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BACKEND_DIR = path.dirname(fileURLToPath(import.meta.url));

export const MODEL = 'claude-sonnet-5-5';

// Per-turn limits (ADR 0002). Hitting any of them ends the turn with a plain message.
export const MODEL_CALLS_PER_TURN = 8;
export const TOOL_CALLS_PER_TURN = 20;
export const MAX_FACTS_PER_SAVE = 15; // facts in one save_answers batch
export const REPEATED_CALL_LIMIT = 2; // the same tool call with identical arguments, then stop

// Tested jurisdictions as [city, county]: every city and county the app's own CASES in
// index.html use (San Jose, San Francisco, Los Angeles). A jurisdiction is "tested" because a
// CASE exercises it, not because a real deal has verified it (reminders.md R5). Berkeley and
// Oakland are in the app's rules but in no CASE, so they stay untested. Compared after
// normalizing accents: the app spells the city "San José" in questions, "San Jose" in the deal.
export const TESTED_JURISDICTIONS = [
  ['San Jose', 'Santa Clara'],
  ['San Francisco', 'San Francisco'],
  ['Los Angeles', 'Los Angeles'],
];

const normalize = s => String(s).normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

export function isTestedJurisdiction(city, county) {
  return TESTED_JURISDICTIONS.some(([c, n]) => normalize(c) === normalize(city) && normalize(n) === normalize(county));
}

// Public-endpoint safeguards (demo mode has no sign-in, so these are the brakes). The values are
// a starting point; the owner can tune them. See reminders.md R15.
export const DEMO_SESSION_PER_MINUTE = 10; // role switches per client
export const AUDIT_PAGE_PER_MINUTE = 30; // audit page loads per client
export const CHAT_PER_MINUTE = 20; // chat messages per client (for the chat endpoint, not built yet)
export const DAILY_MODEL_CALL_CAP = 500; // model calls per day across everyone
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60; // one day

// Chat memory (spec, section 6): the last N messages per deal, role and user, with an expiry.
export const THREAD_MESSAGES_KEPT = 20;
export const THREAD_TTL_SECONDS = 24 * 60 * 60; // one day

// Local-dev storage only. On Vercel the filesystem is not writable; see reminders.md R1/R7.
export const DATA_PATH = process.env.DEAL_DATA_PATH || path.join(BACKEND_DIR, 'data', 'deals.json');
export const EVENTS_PATH = process.env.AGENT_EVENTS_PATH || path.join(BACKEND_DIR, 'data', 'agent_events.jsonl');
