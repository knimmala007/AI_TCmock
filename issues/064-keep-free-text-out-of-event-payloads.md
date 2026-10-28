# 064: Keep question text and other free text out of event payloads
Status: todo | Depends on: 062 | Owner: agent | Size: M

## What solving this does

The audit log no longer holds what users typed or what the model wrote. Ticket 062 keeps free text out of tool and refusal events, but `model_call_start` and `model_call_end` still log the full `system`, `tools` and `messages` and the model's `content`, so a question handed to `ask_broker` reaches the audit page and the broker's model through the log.

Files: modify `backend/model_gate.js`, `backend/events.js` | modify `backend/tests/inbox.test.js`, `backend/tests/model_gate.test.js`, `backend/tests/events.test.js` | reference `backend/agent_loop.js`, `backend/events_page.js`

## Scope

In: Model-call events carry counts and ids only (call number, message count, tool names, content block types, `stop_reason`, `usage`, error class), not text, tool arguments or tool results. The `model_call_end` error event no longer logs `e.message`.
Out: Changing what the model is sent; the audit page layout (010); the event types (062).

## Acceptance criteria

1. After a turn in which a seller asks the broker a question, no stored event contains the question text.
2. No stored event contains the user's message, the reply, a tool argument or a tool result.
3. `model_call_start` and `model_call_end` still log the call number, `stop_reason` and `usage`.
4. The `todo` test "the question text appears in no stored event" in `backend/tests/inbox.test.js` is a normal test and passes. The suite has no `todo`.
5. No key appears in any event.

## Tests

handler and modelGate: scripted fake model, memory storage; a distinctive marker string in the user message, the tool argument and the reply, searched for in every stored row. Mutation check: put the messages back in the payload and see the tests fail.

## Sources

Ticket 062 (what it logs); ticket 050 (the known gap); ADR 0004; ADR 0012; `backend/reminders.md` R7, R25.

## Notes

Ticket 044 waits on this, because its last check is that nothing sensitive appears in any log. Check whether ADR 0004 or ADR 0012 expects the model-call payload to be kept for debugging before removing it; if they disagree, stop and report.
