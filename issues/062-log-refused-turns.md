# 062: Log refused turns (rate limit, daily cap, call limit) in events.js
Status: todo | Depends on: 027 | Owner: agent | Size: S

## What solving this does

A turn the brakes stop leaves a trace in the audit log, so the broker can see that a message was refused and why, not only the turns that reached the model.

Files: modify `backend/events.js`, `backend/model_gate.js`, `backend/agent_handler.js` | modify `backend/tests/events.test.js`, `backend/tests/model_gate.test.js`, `backend/tests/agent_handler.test.js`

## Scope

In: One new event type for a refused turn or call, logged with the session's role, session and deal, with the reason (`rate_limit`, `daily_cap`, `call_limit`) in a redacted payload.
Out: Tool-call and repeat-call refusals (032 logs those); the audit page layout (010).

## Acceptance criteria

1. `EVENT_TYPES` gains one refusal type; `logEvent` still rejects unknown types.
2. When `modelGate` refuses a call (daily cap or the 9th call), one refusal event is logged with the reason, and no `model_call_start` is logged for it.
3. When the chat rate limit refuses a message from a client with a valid session, one refusal event is logged with reason `rate_limit`. A request with no session logs nothing, because there is no role to record.
4. Every refusal event carries the session's role and deal, never a value from the request body.
5. No key appears in a refusal event.

## Tests

handler and modelGate: scripted fake model, memory storage; each acceptance item.

## Sources

`.claude/CONTEXT.MD` Logging; ADR 0004; ticket 027 (027a run: refused turns are not logged yet).

## Notes

Raised during 027a: `modelGate` and the handler stop turns without logging, because the existing event types cover only model and tool start/end and 027a was not allowed to touch `events.js`. The rate limit runs before the session is read, so AC3 needs the handler to read the session first for logging, or to log only when a session is present; decide when building.
