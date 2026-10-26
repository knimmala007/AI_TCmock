# 027b: Real model client
Status: todo | Depends on: 027a | Owner: agent | Size: M

## What solving this does

The assistant can call the real model. The chat endpoint stops answering 503 `MODEL_NOT_CONFIGURED` once a key is set, and the key is never visible to anyone.

Files: create `backend/model_client.js`, `backend/tests/model_client.test.js` | modify `api/agent.js` | reference `backend/model_interface.js`, `backend/config.js`, `backend/model_gate.js`

## Scope

In: A `callModel` that implements the interface in `backend/model_interface.js` over `fetch` to the Anthropic Messages API; reading the key and model name; wiring it into `createAgentEndpoint`.
Out: The loop and tools (027c); the prompts (027d); setting the key (028).

## Acceptance criteria

1. The client is a function `callModel({ system, tools, messages })` returning `{ content, stop_reason, usage }` that passes `validateModelResult`. Nothing else defines the shape.
2. The key comes from the environment (`ANTHROPIC_API_KEY`) and the model name from `MODEL` in `backend/config.js`. Neither is hard-coded.
3. The key never appears in a response, an event, an error message or a log, including on an HTTP error or a malformed body.
4. `createAgentEndpoint` builds the client from the environment when a key is set, so `MODEL_NOT_CONFIGURED` (503) goes away. With no key it still answers 503. An injected `callModel` still takes precedence, so existing tests keep working.
5. An HTTP error, a timeout or a malformed body becomes a plain failure the handler turns into a plain message, never a stack trace or raw upstream text.
6. Only `modelGate` calls the client.

## Tests

handler and client: a fake `fetch` only. Cases: a successful reply, an HTTP error, a malformed body, no key set, and the key absent from every output. The real API is never called.

## Sources

`backend/model_interface.js`; `backend/reminders.md` R16; ticket 027; `.scratch/role-based-chat-agent/spec.md` Architecture.

## Notes

The real service is first exercised in ticket 044. Model calls per turn and the daily cap are enforced by `modelGate`, not here.
