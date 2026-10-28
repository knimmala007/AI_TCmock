# 063: Port the chat panel and role switcher to `index_v2.html`
Status: todo | Depends on: 029 | Owner: agent | Size: M

## What solving this does

`index_v2.html` gets the same backend wiring as `index.html`, so the new page can be used with the assistant: the chat panel, the role switcher and the status panel. The backend does not change.

Files: modify `index_v2.html` | reference `index.html`

## Scope

In: The chat panel (`chatSend`, posting to `/api/agent`), the role switcher (`syncDemoRole`, posting to `/api/demo-session`), the status panel, and any other backend wiring found in `index.html`.
Out: Any change to `index.html`, `backend/`, `api/`, `rules.js` or `vercel.json`; a new endpoint; a new call from the page.

## Acceptance criteria

1. All four roles (broker, seller, buyer, lender) can send a chat message and see the reply.
2. The role switcher works: choosing a role posts to `/api/demo-session`, and the chat and status panels follow it.
3. The role comes only from the cookie. The page never sends a role to `/api/agent` and never builds a role from the URL or page state for any request other than the switcher's own call.
4. No key or env value appears in the page.
5. The page makes no call except the existing endpoints (`/api/demo-session` and `/api/agent`, the only two `fetch` targets in `index.html` today).

## Tests

None can run through the handler seam, because this is a page-only change. Check by reading the file: list every `fetch(` target in `index_v2.html` and search it for `ANTHROPIC`, `KEY`, `process.env` and `sk-`. Then run `npm start` and chat once in each of the four roles. Run `npm test` before and after to show the backend is unchanged.

## Sources

Ticket 029 (chat panel); `backend/reminders.md` R6 (demo session, `syncDemoRole`); `.scratch/role-based-chat-agent/spec.md` Identity.

## Notes

029 is done; the history read is ticket 029b and is not required for 063. `index_v2.html` has no `fetch(` today, so everything is a port, not a merge.
