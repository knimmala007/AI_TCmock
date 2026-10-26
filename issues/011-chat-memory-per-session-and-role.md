# 011: Chat memory and seen-field set per session and role
Status: done | Depends on: 004, 007 | Owner: agent | Size: S

## What solving this does

Recent chat turns and the set of field names the model has seen are kept per deal, session and role. A role switch starts with nothing.

Files: create `backend/threads.js`, `backend/tests/threads.test.js` | modify `backend/config.js`

## Scope

In: Last 20 messages with a one-day expiry; seen-field set.
Out: Calling it from the chat endpoint (tickets 027, 031).

## Acceptance criteria

1. Switching roles shows no earlier turns, even in the same session.
2. Keys cannot collide through separators.
3. A role outside the four is refused.

## Tests

Unit tests (`threads.test.js`).

## Sources

`.scratch/role-based-chat-agent/spec.md` Memory; ADR 0001, 0006.

## Notes

The 20-message and one-day values are my choice (R15, ticket 045).
