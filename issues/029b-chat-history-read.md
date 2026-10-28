# 029b: Chat history read
Status: todo | Depends on: 029 | Owner: agent | Size: S

## What solving this does

The chat panel can show the recent messages of the caller's own conversation after a page reload. Ticket 029a left this out, so the panel shows only the turns of the current page load.

Files: create `api/history.js` (`GET` only), `backend/tests/chat_history.test.js` | modify `backend/agent_handler.js` only if needed to resolve session and role from the signed cookie exactly as the chat does; the builder must justify it in its plan | reference `backend/threads.js`, `backend/session.js`

## Scope

In: `GET /api/history`, which returns the recent thread (up to `THREAD_MESSAGES_KEPT`) for the caller's own session and role. Role, session and deal come only from the signed cookie.
Out: Any model call; any deal data beyond what the thread already holds; another session's or role's thread; a change to how threads are written (011); the page change that calls it.

## Acceptance criteria

1. A `GET` with a valid session returns that session's recent messages as `[{role, content}]`, oldest first, and makes no model call.
2. The thread is read with the scope `{dealId, sessionId, role}` taken from the signed cookie only.
3. A role, session id or deal id in the query, body or headers changes nothing.
4. A tampered or missing cookie gets 401 with fixed text and no thread.
5. A buyer session cannot read the broker's thread, and a role switch (a new session) starts with an empty history.
6. The response holds no deal data other than the thread's own messages, and no key or session token.
7. The read is rate limited like the other public endpoints (`config.js`), and non-`GET` methods on the history path are refused.

## Tests

handler, memory storage, scripted fake model that fails the test if called. Cover: a buyer cannot read the broker's thread; a role or session id in the query or body changes nothing; a tampered cookie gets 401; a role switch starts empty; no model call is made.

## Sources

Ticket 029 (note on the open history read); ticket 011 (`backend/threads.js`); `backend/reminders.md` R6; `.scratch/role-based-chat-agent/spec.md` Memory and Identity.

## Notes

`api/history.js` is a separate file, so the one entry point that runs the loop (`api/agent.js`) is not widened. The panel call from `index.html` is outside this ticket; `index_v2.html` does not need it for 063, and no ticket yet adds the call there.
