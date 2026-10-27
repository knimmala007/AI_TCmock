// GET /api/inbox: the broker-only inbox read. Wiring only; the logic is backend/inbox.js.
import { createRuntime } from '../backend/runtime.js';
import { createInboxHandler } from '../backend/inbox.js';
import { sessionFromRequest } from '../backend/session.js';

let handler;
export const GET = req => {
  try {
    if (!handler) {
      const rt = createRuntime();
      handler = createInboxHandler({ inbox: rt.inbox, limiter: rt.limiter, getSession: r => sessionFromRequest(r) });
    }
  } catch {
    return new Response(JSON.stringify({ error: 'DEMO_NOT_CONFIGURED' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }
  return handler(req);
};
