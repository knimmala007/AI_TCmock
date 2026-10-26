# 028a: One manual real model run
Status: todo | Depends on: 027b, 027c, 028 | Owner: human | Size: S

## What solving this does

The owner makes one real model run by hand, to confirm the real client works end to end before any role prompts or tools are built on it.

Files: modify `backend/reminders.md` (record the result) | reference `backend/model_client.js`, `api/agent.js`, `backend/config.js`

## Scope

In: One local run with a real key, and a short written result.
Out: Tools, role prompts, and hosted (Vercel) runs (ticket 044).

## Steps for the owner

1. Set the key in the local shell only, for example `export ANTHROPIC_API_KEY=...` in the terminal you will use. Never put it in a file git tracks, a ticket, a chat or a command history you share.
2. Run `npm start`.
3. Switch to the broker role in the app.
4. Send one plain message (no tool is needed) and note the time.
5. Confirm a reply comes back through `/api/agent`.
6. Confirm the other answers still behave: without the key set, `/api/agent` answers 503 `MODEL_NOT_CONFIGURED`; sending more than 20 messages in a minute answers 429.
7. Confirm the event log and the responses contain no key: search `backend/data/agent_events.jsonl` (or the `AGENT_EVENTS_PATH` file) and the browser's network responses for the key's first characters.
8. Confirm the daily cap counter went up by the number of model calls made. Locally the counter is held in memory and cannot be read from outside, so count the `model_call_start` events for the turn in the event log instead; with one plain message this is 1.
9. Run `git status` and confirm no file with the key is listed.

## Acceptance criteria

1. One real reply is received through `/api/agent` for a broker session.
2. The key appears in no log, event, response or `git status`.
3. 429 and 503 still behave as before.
4. The number of `model_call_start` events for the turn matches the number of model calls made.
5. Spend on the key (the provider's usage page) matches roughly one call.
6. The result is recorded in `backend/reminders.md` (R16), with any surprise.

## Tests

Manual check. No automated test makes a real call.

## Sources

Ticket 028 (the variables); `backend/reminders.md` R15, R16; `.scratch/role-based-chat-agent/spec.md` Platform.

## Notes

Stop and report if a key shows up anywhere it should not, and rotate that key. Agents do not hold or read the key. The prompt may still be the placeholder (027d), so the reply may be generic; that is expected.

Repeat this manual run once after ticket 031 (the first real tool, `get_deal`) is built, because that is the first time the real model sees real tool definitions and a tool result. Record the second run in the same reminders row.
