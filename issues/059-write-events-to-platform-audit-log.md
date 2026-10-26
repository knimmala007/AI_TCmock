# 059: Write events to the platform's audit log
Status: blocked | Depends on: 026, 027 | Owner: agent | Size: M

## What solving this does

Agent events go to the platform's existing audit trail.

Files: modify `backend/events.js`, `backend/runtime.js`

## Scope

In: A new event store.
Out: Changing the audit trail itself.

## Acceptance criteria

1. Events appear in the audit trail with the agreed shape.
2. Redaction is kept.
3. The audit page still works.

## Tests

handler.

## Sources

`backend/reminders.md` R7, Q-a; ticket 026.

## Notes

Blocked on the audit log shape and access.
