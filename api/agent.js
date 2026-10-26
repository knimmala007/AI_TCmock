// POST /api/agent {message}: the chat endpoint. Wiring only; the logic is backend/agent_handler.js.
// No model client is wired until ticket 027b, so every POST answers 503 MODEL_NOT_CONFIGURED.
import { createRuntime } from '../backend/runtime.js';
import { createAgentHandler } from '../backend/agent_handler.js';
import { sessionFromRequest } from '../backend/session.js';

export function createAgentEndpoint(env = process.env, { callModel } = {}) {
  let handler;
  return req => {
    try {
      if (!handler) {
        const rt = createRuntime(env);
        handler = createAgentHandler({
          callModel, getSession: r => sessionFromRequest(r, env),
          limiter: rt.limiter, dailyCap: rt.dailyCap, eventLog: rt.eventLog, threads: rt.threads,
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: 'DEMO_NOT_CONFIGURED' }), { status: 503, headers: { 'content-type': 'application/json' } });
    }
    return handler(req);
  };
}

export const POST = createAgentEndpoint();
export const GET = POST; // answers 405
