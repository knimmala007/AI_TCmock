// GET /api/approve (pending requests) and POST /api/approve {action, request_id} (the broker's Approve click).
// Broker only. Wiring only; the logic is backend/approvals.js.
import { createRuntime } from '../backend/runtime.js';
import { createApproveHandler } from '../backend/approvals.js';
import { sessionFromRequest } from '../backend/session.js';

let handler;
const handle = req => {
  try {
    if (!handler) {
      const rt = createRuntime();
      handler = createApproveHandler({
        repository: rt.repository, eventLog: rt.eventLog, limiter: rt.limiter, getSession: r => sessionFromRequest(r),
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: 'DEMO_NOT_CONFIGURED' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }
  return handler(req);
};
export const GET = handle;
export const POST = handle;
