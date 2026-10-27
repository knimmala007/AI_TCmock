// POST /api/agent {message}: the chat endpoint. Wiring only; the logic is backend/agent_handler.js.
// The model client is built from ANTHROPIC_API_KEY; with no key every POST answers 503 MODEL_NOT_CONFIGURED.
// An injected callModel (tests) takes precedence.
import { createRuntime } from '../backend/runtime.js';
import { createAgentHandler } from '../backend/agent_handler.js';
import { sessionFromRequest } from '../backend/session.js';
import { redact } from '../backend/events.js';
import { modelClientFromEnv, ModelCallError, MODEL_FAILED_REPLY } from '../backend/model_client.js';

const failure = (status, error, message) => new Response(JSON.stringify({ error, message }),
  { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export function createAgentEndpoint(env = process.env, { callModel = modelClientFromEnv(env) } = {}) {
  let handler;
  return req => {
    try {
      if (!handler) {
        const rt = createRuntime(env);
        handler = createAgentHandler({
          callModel, getSession: r => sessionFromRequest(r, env),
          limiter: rt.limiter, dailyCap: rt.dailyCap, eventLog: rt.eventLog, threads: rt.threads,
          repository: rt.repository, seenFields: rt.seenFields, inbox: rt.inbox,
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: 'DEMO_NOT_CONFIGURED' }), { status: 503, headers: { 'content-type': 'application/json' } });
    }
    // A failed model call is a plain 502. Any other error is a generic 500, not shown as a model problem.
    // Neither shows a stack, an upstream body or a header; the 500 is logged by name and message only.
    return Promise.resolve(handler(req)).catch(e => {
      if (e instanceof ModelCallError) return failure(502, 'MODEL_FAILED', MODEL_FAILED_REPLY);
      console.error('agent endpoint error:', redact(String(e && e.name)), redact(String(e && e.message)));
      return failure(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
    });
  };
}

export const POST = createAgentEndpoint();
export const GET = POST; // answers 405
