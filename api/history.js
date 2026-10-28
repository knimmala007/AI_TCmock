// GET /api/history: the caller's own recent chat thread. Wiring only; the logic is backend/history.js.
import { createRuntime } from '../backend/runtime.js';
import { createHistoryHandler } from '../backend/history.js';
import { sessionFromRequest } from '../backend/session.js';
import { redact } from '../backend/events.js';

const failure = (status, error, message) => new Response(JSON.stringify(message ? { error, message } : { error }),
  { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

let handler;
export const GET = req => {
  try {
    if (!handler) {
      const rt = createRuntime();
      handler = createHistoryHandler({ threads: rt.threads, limiter: rt.limiter, getSession: r => sessionFromRequest(r) });
    }
  } catch {
    return failure(503, 'DEMO_NOT_CONFIGURED');
  }
  // Any other error is a generic 500: no stack, no upstream body; logged by name and message only.
  return Promise.resolve(handler(req)).catch(e => {
    console.error('history endpoint error:', redact(String(e && e.name)), redact(String(e && e.message)));
    return failure(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  });
};
