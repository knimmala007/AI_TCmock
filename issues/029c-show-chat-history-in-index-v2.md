# 029c: Show chat history in `index_v2.html`
Status: todo | Depends on: 029b, 063 | Owner: agent | Size: S

## What solving this does

After a reload or a role switch, the chat panel in the new page shows the recent turns of the viewer's own role and session instead of starting blank.

Files: modify `index_v2.html` | reference `api/history.js`, `index.html`

## Scope

In: On page load and on every role switch, the chat panel calls `GET /api/history` and shows the recent turns it returns.
Out: Any change to `index.html`, `backend/`, `api/` or `rules.js`; a new endpoint; sending messages (063).

## Acceptance criteria

1. After a reload, the panel shows the recent turns of the viewer's own role and session.
2. Switching roles shows no earlier turns of the other role.
3. A 401, 429 or 503 from the history read shows a plain message, not the response body, and the panel still works for sending.
4. User text and reply text are shown as text, never as HTML.
5. No key, token or env value appears in the page, and the page sends no role, session or deal id to `/api/history`; the role comes only from the cookie.
6. The page makes no call except the existing endpoints (`/api/demo-session`, `/api/agent`, `/api/history`, and `/api/inbox` once 050b is built).

## Tests

Page-only, so no handler test. Read `index_v2.html`, list every `fetch(` target and search it for `ANTHROPIC`, `KEY`, `process.env` and `sk-`. Then run `npm start`, chat as the seller, reload, switch to the broker and back, and check each of the four roles. Run `npm test` before and after to show the backend is unchanged.

## Sources

Ticket 029b (the read); ticket 063 (chat panel and role switcher in `index_v2.html`); `backend/reminders.md` R6.

## Notes

A role switch starts a new session (demo mode), so the history after a switch is empty by design; this ticket only needs to show what the read returns.
