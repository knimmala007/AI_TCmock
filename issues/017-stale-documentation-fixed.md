# 017: Stale documentation fixed
Status: done | Depends on: 015 | Owner: agent | Size: S

## What solving this does

Three out-of-date statements were corrected so the docs match the repo.

Files: modify `.claude/CONTEXT.MD`, `backend/reminders.md`

## Scope

In: The R13 and CONTEXT item 6 wording, the R3 Python sentence, the `/chat` wording.
Out: Anything else.

## Acceptance criteria

1. R13 and CONTEXT item 6 now say only the Kialae code remains.
2. R3 no longer mentions a Python backend.
3. CONTEXT says "the chat endpoint (`api/agent.js`)" instead of `/chat`.

## Tests

None (docs).

## Sources

`backend/reminders.md` R3, R13; `.claude/CONTEXT.MD` Still open.

## Notes

Ticket 022 refreshes one more stale statement (APPR is now produced by the rules).
