# 020: Add a health-check function
Status: todo | Depends on: 013 | Owner: agent | Size: S

## What solving this does

A tiny function answers whether the deployment is alive and can load the shared rules and fixtures. It is the first thing to deploy, to find hosting problems early.

Files: create `api/health.js`, `backend/health.js`, `backend/tests/health.test.js` | modify none | reference `rules.js`, `backend/fixtures.js`

## Scope

In: A GET endpoint returning ok, the Node version, whether it runs hosted, and counts of rules and fixtures.
Out: Anything that needs a session, storage or a secret.

## Acceptance criteria

1. `GET /api/health` returns 200 JSON with `ok`, `node`, `hosted`, the number of intake questions and the number of documents.
2. It needs no session and touches no storage.
3. The response never contains an environment variable value.
4. Other methods return 405.

## Tests

handler: shape, no secrets even when the environment holds some, method check.

## Sources

`backend/reminders.md` R12, R15; ticket 021.

## Notes

Keep it free of imports that need secrets, so it works before any variable is set.
