// POST /api/agent: the chat door. One message in, one plain reply out: {reply, turnId}.
//
// The role, session id and deal id come only from the signed demo session (session.js), read once
// and passed on as values. The request body contributes the message text and nothing else; any role,
// deal or session in the body, query or headers is ignored. session.js returns no session for a role
// outside the four, so an unknown role is a 401 like a missing cookie.
//
// Order: method -> model configured -> rate limit -> session -> message -> load thread
//        -> the tool-use loop (agent_loop.js, every model call through modelGate) -> save thread -> {reply, turnId}.
// A stopped turn (rate limit, daily cap, call limit, tool-call limit, repeat stop) saves nothing to the thread.
import crypto from 'node:crypto';
import { CHAT_PER_MINUTE } from './config.js';
import { clientKey } from './demo_session.js';
import { redact } from './events.js';
import { runLoop } from './agent_loop.js';
import { createModelGate, createTurn } from './model_gate.js';
import { promptFor } from './prompts.js';

export const RATE_LIMIT_REPLY = 'You are sending messages too quickly. Please wait a minute and try again.';

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
});

export function createAgentHandler({
  callModel, getSession, limiter, dailyCap, eventLog, threads,
  perMinute = CHAT_PER_MINUTE, newTurnId = () => crypto.randomUUID(), registry,
}) {
  const modelGate = callModel ? createModelGate({ callModel, dailyCap, eventLog }) : null;

  return async function POST(req) {
    if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' }, { allow: 'POST' });
    if (!modelGate) return json(503, { error: 'MODEL_NOT_CONFIGURED', message: 'The assistant is not set up yet.' });

    const turnId = newTurnId();
    const limited = await limiter.hit(`chat:${clientKey(req)}`, { limit: perMinute, windowSeconds: 60 });
    if (!limited.allowed) return json(429, { reply: RATE_LIMIT_REPLY, turnId }, { 'retry-after': '60' });

    const session = getSession(req);
    if (!session) return json(401, { error: 'UNAUTHENTICATED', message: 'Pick a role first.' });
    const { role, sessionId, dealId } = session;

    let body;
    try { body = await req.json(); } catch { body = null; }
    const text = body && body.message;
    if (typeof text !== 'string' || !text.trim()) return json(400, { error: 'BAD_REQUEST', message: 'Send a message.' });
    const message = redact(text);

    const scope = { dealId, sessionId, role };
    const history = await threads.recent(scope);
    const turn = createTurn({ sessionId, turnId, role, dealId });
    const r = await runLoop(modelGate, turn, {
      system: promptFor(role), messages: [...history, { role: 'user', content: message }], registry,
    });
    if (r.stopped === 'daily_cap') return json(429, { reply: r.reply, turnId });
    if (r.stopped) return json(200, { reply: r.reply, turnId });

    const reply = redact(r.reply);
    await threads.append(scope, { role: 'user', content: message });
    await threads.append(scope, { role: 'assistant', content: reply });
    return json(200, { reply, turnId });
  };
}
