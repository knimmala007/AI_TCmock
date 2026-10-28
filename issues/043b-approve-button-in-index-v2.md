# 043b: Approve button in `index_v2.html`
Status: todo | Depends on: 043, 063 | Owner: agent | Size: S

## What solving this does

The broker can press Approve in the new page, which calls the Approve endpoint built in 043. Until this exists, approval can only be granted by calling `api/approve.js` directly.

Files: modify `index_v2.html` | reference `api/approve.js`, `backend/approvals.js`, `index.html`

## Scope

In: A broker-only Approve button for the pending approval request, calling the endpoint from 043.
Out: Any change to `api/`, `backend/` or `index.html`; the buttons for the other gated actions (046 to 049); a new endpoint.

## Acceptance criteria

1. As the broker, the button is shown when an approval has been requested and pressing it calls the Approve endpoint.
2. As seller, buyer or lender, the button is not rendered, and a direct call to the endpoint is refused (the endpoint is the control; the button is a convenience).
3. The page sends no role or deal id to the endpoint; the role comes only from the cookie.
4. A refusal or error shows fixed text, not the response body.
5. The page makes no call except the existing endpoints (`/api/demo-session`, `/api/agent`, `/api/inbox` once 050b is built, and the Approve endpoint).

## Tests

Page-only, so no handler test. Read `index_v2.html`, list every `fetch(` target and search it for `ANTHROPIC`, `KEY`, `process.env` and `sk-`. Then run `npm start`, request an approval as the broker through the chat, press Approve, and check the other three roles do not see the button. Run `npm test` before and after to show the backend is unchanged.

## Sources

Ticket 043 (endpoint and tool); ticket 063 (role switcher and chat in `index_v2.html`); `.scratch/role-based-chat-agent/spec.md` Status codes and approvals.

## Notes

Split from 043, whose Files line named `index.html`. The page work for the other roles' buttons (046 to 049) is not part of this ticket.
