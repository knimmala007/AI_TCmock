# 027: Chat endpoint gives a plain reply
Status: todo | Depends on: 008, 009, 011, 012 | Owner: agent | Size: M

## What solving this does

A person can send a message and get a reply from the model, acting only with the role in their session. The turn is limited, logged and remembered, but the assistant has no tools yet.

Files: create `api/agent.js`, `backend/agent_handler.js`, `backend/agent_loop.js`, `backend/model_client.js`, `backend/tests/agent_handler.test.js` | modify `backend/runtime.js` (only if needed) | reference `backend/session.js`, `threads.js`, `limits.js`, `events.js`, `config.js`

## Scope

In: POST endpoint, loop with a model-call limit, model client (scripted for tests, real over `fetch`), thread, events, limits.
Out: Tools (031 onward); the chat panel (029).

## Acceptance criteria

1. `POST /api/agent` takes a message; the role comes only from the session cookie; a role in the body is ignored; no cookie gives 401.
2. A chat message limit per client (20 per minute) returns 429.
3. The daily model-call cap is taken before every model call; when reached the reply says so plainly.
4. A turn makes at most 8 model calls and ends with a plain message at the limit.
5. Events are logged before and after every model call, each with the session's role and deal.
6. The user message and the reply are added to the thread (last 20, expiry) and earlier turns are sent as context.
7. No key, secret or token appears in a response or log.
8. The model client is injected: a scripted fake in tests; the real Messages API (model from config) is not called by tests.
9. Hosted without Upstash it returns 503.

## Tests

handler: scripted fake model; each acceptance item.

## Sources

`.scratch/role-based-chat-agent/spec.md` Architecture, Memory, Guardrails; ADR 0001, 0006; `backend/reminders.md` R15.

## Notes

The real client is first exercised in ticket 044. The system prompt names the acting role; ticket 030 adds the legal-advice rules.

027a exception: the 9th-model-call limit (AC4) is tested by driving `modelGate` directly (`backend/tests/model_gate.test.js`), because 027a has no loop and a turn makes one model call, so the limit cannot be reached through the handler. This is a one-time exception for 027a; the 9th-call limit gets re-tested through the handler in 027c/032.
