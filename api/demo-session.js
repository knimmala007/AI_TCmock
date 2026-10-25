// POST /api/demo-session {role}: the role switcher's endpoint (demo mode, no sign-in).
// Validates the role and sets the session cookie. A stand-in for real sign-in; not DEV_FAKE_AUTH.
import { createRuntime } from '../backend/runtime.js';
import { createDemoSessionHandler } from '../backend/demo_session.js';

let handler;
const handle = req => {
  try {
    handler ??= createDemoSessionHandler(process.env, { limiter: createRuntime().limiter });
  } catch {
    return new Response(JSON.stringify({ error: 'DEMO_NOT_CONFIGURED' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }
  return handler(req);
};
export const POST = handle;
export const GET = handle; // answers 405
