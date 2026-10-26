# 032: Tool-call limits and repeat stop
Status: todo | Depends on: 031 | Owner: agent | Size: S

## What solving this does

A runaway turn ends cleanly: at most 20 tool calls, and the same call with the same arguments stops after two tries.

Files: modify `backend/agent_loop.js`, `backend/config.js` (only if needed) | create `backend/tests/agent_limits.test.js`

## Scope

In: The two limits and their plain message.
Out: The model-call limit (done in 027).

## Acceptance criteria

1. The 21st tool call in a turn ends the turn with a plain message.
2. An identical call is allowed twice, and the third ends the turn.
3. Both are logged as events.

## Tests

handler: scripted model that loops.

## Sources

`.scratch/role-based-chat-agent/spec.md` Guardrails (turn limits); `backend/reminders.md` B2.

## Notes

Values are 20 and 2.
