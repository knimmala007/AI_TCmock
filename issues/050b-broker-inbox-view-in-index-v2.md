# 050b: Broker inbox view in `index_v2.html`
Status: todo | Depends on: 050, 063 | Owner: agent | Size: M

## What solving this does

The broker can read the questions that seller, buyer and lender handed over with `ask_broker`, from a view in the new page. Until this exists, the inbox is readable only by calling `GET /api/inbox` directly.

Files: modify `index_v2.html` | reference `api/inbox.js`, `backend/inbox.js`, `index.html`

## Scope

In: A broker-only Inbox view that calls `GET /api/inbox` and lists each item (asking role, question, time, ticket id). The view is not shown to seller, buyer or lender.
Out: Replies (049); an answered state or removing items (the store has none, see R25); any change to `api/`, `backend/` or `index.html`; a new endpoint.

## Acceptance criteria

1. As the broker, the view lists the items for the session's deal and shows the question text.
2. As seller, buyer or lender, the view is not offered, and a direct call to `/api/inbox` is answered 403.
3. The page sends no role or deal id to `/api/inbox`; the role comes only from the cookie.
4. An empty inbox shows a plain empty state; a 401, 403 or 429 shows fixed text, not the response body.
5. Question text is written to the page as text, never as HTML.
6. The page makes no call except the existing endpoints (`/api/demo-session`, `/api/agent`, `/api/inbox`).

## Tests

Page-only, so no handler test. Read `index_v2.html` and list every `fetch(` target; search it for `ANTHROPIC`, `KEY`, `process.env` and `sk-`. Then run `npm start` and open the inbox as each of the four roles after a seller has asked a question. Run `npm test` before and after to show the backend is unchanged.

## Sources

Ticket 050 (store and endpoint); ticket 063 (role switcher and chat in `index_v2.html`); `backend/inbox.js`; `backend/reminders.md` R25.

## Notes

`GET /api/inbox` returns the full items including question text; this is the only path that delivers the text. The broker's model never sees it (ticket 050).
