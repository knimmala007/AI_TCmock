# 009: Demo session and role switcher
Status: done | Depends on: 003, 004 | Owner: agent | Size: M

## What solving this does

With no sign-in yet, the UI's role switcher asks the server to start a session for one of four roles. The agent reads the role only from that session cookie.

Files: create `backend/session.js`, `backend/demo_session.js`, `api/demo-session.js`, tests | modify `index.html` (`syncDemoRole`)

## Scope

In: POST endpoint, signed cookie, fresh session per switch, switcher call in the page.
Out: Real sign-in (ticket 057).

## Acceptance criteria

1. Only broker, seller, buyer and lender are accepted.
2. The cookie is signed, HttpOnly and SameSite=Strict (Secure on Vercel).
3. The role is never taken from a body, query, header or chat text.
4. Every switch starts a new session.
5. On Vercel it needs an owner-set `AGENT_SESSION_SECRET` and refuses without one.
6. It is separate from `DEV_FAKE_AUTH`.

## Tests

handler: `session.test.js`, `demo_session.test.js`.

## Sources

ADR 0006; `.scratch/role-based-chat-agent/spec.md` Identity; `backend/reminders.md` R6.

## Notes

Anyone can pick any role, so this is only safe for a redacted demo.
