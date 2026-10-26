# 018: Forms with no template are flag-only (decision)
Status: done | Depends on: 003 | Owner: agent | Size: S

## What solving this does

It is decided that the agent only flags a required form that has no template. It never fills one.

Files: modify the spec, `backend/reminders.md` (R9), `.claude/CONTEXT.MD`

## Scope

In: Recording the decision in three places.
Out: Building the behavior (ticket 035).

## Acceptance criteria

1. The decision appears in the spec, R9 and CONTEXT.

## Tests

None (docs).

## Sources

`backend/reminders.md` R9; `.scratch/role-based-chat-agent/spec.md` Further Notes.

## Notes

13 form codes are affected.
