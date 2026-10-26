# 057: Replace the demo session with real sign-in
Status: blocked | Depends on: 027 | Owner: agent | Size: L

## What solving this does

Real sign-in supplies the role, and the demo session is removed.

Files: modify `backend/session.js`, `index.html`, `api/*.js` | delete `backend/demo_session.js`, `api/demo-session.js`

## Scope

In: Using the signed-in role everywhere.
Out: New roles.

## Acceptance criteria

1. The role comes from sign-in only.
2. No request input can set the role.
3. The audit page still refuses seller, buyer and lender.
4. Threads stay isolated.

## Tests

handler: rerun every identity test.

## Sources

`backend/reminders.md` R6; ADR 0006.

## Notes

Blocked on a sign-in wrapper in this repo.
