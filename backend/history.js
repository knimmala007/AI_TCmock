// GET /api/history: the caller's own recent chat thread (ticket 029b). Read only, no model call.
//
// The role, session id and deal id come only from the signed demo session (session.js), exactly as the chat
// reads them in agent_handler.js. The query, body and headers are never read (the one exception is
// x-forwarded-for, which clientKey uses to pick the rate-limit bucket, not to pick a thread). The thread
// holds only what the chat saved, already redacted, so nothing is redacted again here and no deal data is read.
//
// Order: method -> rate limit -> session -> read the thread. Fixed text in every refusal, never an echo of input.
import { AUDIT_PAGE_PER_MINUTE } from './config.js';
import { clientKey } from './demo_session.js';

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
});

// There is no limit of its own in config.js yet, so this reuses the audit page's number (its own bucket).
// Ticket 045 decides whether history gets its own constant.
export function createHistoryHandler({ threads, getSession, limiter, perMinute = AUDIT_PAGE_PER_MINUTE }) {
  return async function GET(req) {
    if (req.method !== 'GET') return json(405, { error: 'METHOD_NOT_ALLOWED' }, { allow: 'GET' });
    if (limiter) {
      const r = await limiter.hit(`history:${clientKey(req)}`, { limit: perMinute, windowSeconds: 60 });
      if (!r.allowed) return json(429, { error: 'RATE_LIMITED', message: 'Too many requests. Please wait a minute.' }, { 'retry-after': '60' });
    }
    const session = getSession(req);
    if (!session) return json(401, { error: 'UNAUTHENTICATED', message: 'Pick a role first.' });
    const { role, sessionId, dealId } = session;
    const rows = await threads.recent({ dealId, sessionId, role });
    // Only role and content leave: a field added to the stored rows later cannot reach the client.
    return json(200, { messages: rows.map(({ role, content }) => ({ role, content })) });
  };
}
