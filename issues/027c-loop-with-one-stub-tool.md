# 027c: Loop with one stub tool
Status: done | Depends on: 027a | Owner: agent | Size: M

## What solving this does

The assistant runs a hand-written tool-use loop: it asks the model, runs a tool if the model calls one, and repeats until the model answers or a limit stops the turn. One harmless stub tool proves the loop before any real tool exists. This ticket also builds the tool-call and repeat limits, so ticket 032 is closed by it.

Files: create `backend/agent_loop.js`, `backend/tests/agent_loop.test.js` | modify `backend/agent_handler.js` | reference `backend/model_gate.js`, `backend/model_interface.js`, `backend/config.js`, `backend/roles.js`

## Scope

In: The loop, the three limits, one stub tool, session-only identity.
Out: Real tools (031 onward); the real model client (027b); the prompts (027d); logging of limit stops (062).

## Acceptance criteria

1. Every model call goes through `modelGate`. The loop never calls a client directly.
2. A turn makes at most 8 model calls (`MODEL_CALLS_PER_TURN`) and at most 20 tool calls (`TOOL_CALLS_PER_TURN`); at either limit the turn ends with a plain message to the user.
3. The same tool call with identical arguments is allowed twice (`REPEATED_CALL_LIMIT`); the third ends the turn with a plain message.
4. Role, deal and session ids come from the session only, never from the request body, the chat text, tool arguments or model output.
5. One stub tool (read-only, returns fixed text, touches no deal data) is offered to every role, so the loop can be tested end to end. It is removed or replaced when the first real tool lands (031).
6. A tool name the registry does not offer, or bad arguments, returns an error result to the model and does not end the turn.
7. The 9th model call is refused through the handler (the 027a exception is closed).

## Tests

handler: scripted fake model that calls the stub tool, loops, repeats an identical call, and asks for a 9th call. Each acceptance item, including the 21st tool call and the third identical call.

## Sources

`.scratch/role-based-chat-agent/spec.md` Architecture, Guardrails (turn limits); `.claude/CONTEXT.MD` Limits; ADR 0002; tickets 027, 032.

## Notes

Limit values live in `backend/config.js` and are not redefined here. Recording that a turn was stopped by a limit is ticket 062.
