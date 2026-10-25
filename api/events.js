// GET /api/events?turn=<id>: the broker-only audit page (spec, sections 4 and 10).
import { createRuntime } from '../backend/runtime.js';
import { createEventsPageHandler } from '../backend/events_page.js';
import { sessionFromRequest } from '../backend/session.js';

let handler;
export const GET = req => {
  try {
    if (!handler) {
      const rt = createRuntime();
      handler = createEventsPageHandler({ eventLog: rt.eventLog, limiter: rt.limiter, getSession: r => sessionFromRequest(r) });
    }
  } catch {
    return new Response(JSON.stringify({ error: 'DEMO_NOT_CONFIGURED' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }
  return handler(req);
};
