# 062: Log refused turns (rate limit, daily cap, call limit, tool-call limit, repeat stop) and tool calls in events.js
Status: todo | Depends on: 027c | Owner: agent | Size: S

## What solving this does

A turn the brakes stop leaves a trace in the audit log, so the broker can see that a message was refused and why, not only the turns that reached the model. Each tool call and its result are logged too, because the 027c loop logs only model calls.

Files: modify `backend/events.js`, `backend/model_gate.js`, `backend/agent_handler.js`, `backend/agent_loop.js` | modify `backend/tests/events.test.js`, `backend/tests/model_gate.test.js`, `backend/tests/agent_handler.test.js`, `backend/tests/agent_loop.test.js`

## Scope

In: One new event type for a refused turn or call, logged with the session's role, session and deal, with the reason (`rate_limit`, `daily_cap`, `call_limit`, `tool_call_limit`, `repeat_call`) in a redacted payload.
Also in: the existing `tool_start` and `tool_end` events, written by the loop, for every tool call, with the tool name, arguments and result in a redacted payload (error results included).
Out: The limits themselves (027a and 027c; 032 is closed by 027c); the audit page layout (010).

## Acceptance criteria

1. `EVENT_TYPES` gains one refusal type; `logEvent` still rejects unknown types.
2. When `modelGate` refuses a call (daily cap or the 9th call), one refusal event is logged with the reason, and no `model_call_start` is logged for it.
3. When the chat rate limit refuses a message from a client with a valid session, one refusal event is logged with reason `rate_limit`. A request with no session logs nothing, because there is no role to record.
4. Every refusal event carries the session's role and deal, never a value from the request body.
5. When the loop ends a turn at the 21st tool call, one refusal event is logged with reason `tool_call_limit`; when it ends a turn on the third identical call, one is logged with reason `repeat_call`. Both carry the session's role and deal.
6. No key appears in a refusal event.
7. Every tool call the loop runs logs a `tool_start` and `tool_end` event (name, arguments, result or error) with the session's role and deal, no key in the payload.

## Tests

handler, modelGate and loop: scripted fake model, memory storage; each acceptance item.

## Sources

`.claude/CONTEXT.MD` Logging; ADR 0004; tickets 027 (027a run: refused turns are not logged yet), 027c, 032.

## Notes

Raised during 027a: `modelGate` and the handler stop turns without logging, because the existing event types cover only model and tool start/end and 027a was not allowed to touch `events.js`. The rate limit runs before the session is read, so AC3 needs the handler to read the session first for logging, or to log only when a session is present; decide when building.
