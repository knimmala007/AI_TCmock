# 032: Tool-call limits and repeat stop
Status: closed by 027c | Depends on: 027c | Owner: agent | Size: S

## What solving this does

Nothing further. Ticket 027c builds the 20-tool-call limit and the repeat stop in the hand-written loop. Logging the stops moves to ticket 062.

Files: none

## Scope

In: Nothing.
Out: Everything. The limits and their plain message are in 027c; the logging of limit stops is in 062.

## Acceptance criteria

Closed. The original criteria are covered elsewhere:

1. The 21st tool call in a turn ends the turn with a plain message: 027c (AC2).
2. An identical call is allowed twice, and the third ends the turn: 027c (AC3).
3. Both are logged as events: 062.

## Tests

None here. See 027c and 062.

## Sources

`.scratch/role-based-chat-agent/spec.md` Guardrails (turn limits); `backend/reminders.md` B2.

## Notes

Closed because the loop is built in 027c, so a separate limits ticket would edit the same file for no new behaviour. Values stay 20 and 2 in `backend/config.js`.
