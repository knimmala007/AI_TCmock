# 027: Chat endpoint gives a plain reply (umbrella for 027a to 027d)
Status: todo (027a done; 027b to 027d remain) | Depends on: 008, 009, 011, 012 | Owner: agent (027d: human) | Size: M

## What solving this does

A person can send a message and get a reply from the model, acting only with the role in their session. The turn is limited, logged and remembered. This ticket is only the umbrella: the work is in 027a to 027d, and 027 is done only when all four are done.

Files: none of its own | see 027a to 027d below

## Scope

In: POST endpoint, model-call limit, thread, events, limits (027a); the real model client (027b); the hand-written loop with one stub tool (027c); the four role prompts (027d).
Out: Real tools (031 onward); the chat panel (029); the legal-advice guard (030).

## The four parts

| Part | What | Ticket | Status |
|---|---|---|---|
| 027a | `POST /api/agent`, `modelGate`, scripted fake model, `backend/model_interface.js` | recorded here; no separate file | done |
| 027b | Real model client over `fetch` | [027b](027b-real-model-client.md) | todo |
| 027c | Hand-written loop with one stub tool | [027c](027c-loop-with-one-stub-tool.md) | todo |
| 027d | Four per-role system prompts | [027d](027d-per-role-system-prompts.md) | todo |

## Acceptance criteria

027 is done when 027a, 027b, 027c and 027d are all done. Together they cover:

1. `POST /api/agent` takes a message; the role comes only from the session cookie; a role in the body is ignored; no cookie gives 401. (027a)
2. A chat message limit per client (20 per minute) returns 429. (027a)
3. The daily model-call cap is taken before every model call; when reached the reply says so plainly. (027a)
4. A turn makes at most 8 model calls and ends with a plain message at the limit. (gate in 027a; through the handler in 027c)
5. Events are logged before and after every model call, each with the session's role and deal. (027a)
6. The user message and the reply are added to the thread (last 20, expiry) and earlier turns are sent as context. (027a)
7. No key, secret or token appears in a response or log. (027a, and 027b for the key)
8. Hosted without Upstash it returns 503. (027a)

## Tests

Each part's own tests. Tests never call the real model.

## Sources

`.scratch/role-based-chat-agent/spec.md` Architecture, Memory, Guardrails; ADR 0001, 0006; `backend/reminders.md` R15, R21.

## Notes

The real client is first exercised against the real service in ticket 044. The system prompt names the acting role; ticket 030 adds the legal-advice rules.

027a exception: the 9th-model-call limit (AC4) was tested by driving `modelGate` directly (`backend/tests/model_gate.test.js`), because 027a has no loop and a turn makes one model call, so the limit cannot be reached through the handler. This was a one-time exception for 027a; 027c re-tests the 9th-call stop through the handler.

Refused turns (rate limit, daily cap, call limit, tool-call limit, repeat stop) are logged by 062.
