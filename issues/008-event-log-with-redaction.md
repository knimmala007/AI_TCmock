# 008: Event log with key redaction
Status: done | Depends on: 007 | Owner: agent | Size: S

## What solving this does

Every model call and tool run can be recorded as an event, with API keys removed before anything is written.

Files: create `backend/events.js`, `backend/tests/events.test.js` | reference `backend/kv.js`

## Scope

In: One `logEvent` helper, four event types, memory/file/Upstash stores, redaction.
Out: Calling it from the loop (ticket 027); the platform audit log (ticket 059).

## Acceptance criteria

1. Only four event types are accepted.
2. API keys never reach storage.
3. Events for a turn come back in order.

## Tests

Unit tests (`events.test.js`).

## Sources

ADR 0004; `.scratch/role-based-chat-agent/spec.md` Logging.

## Notes

Events are stored one list per turn, with no expiry.
