# 013: Local server and `npm start`
Status: done | Depends on: 009, 010 | Owner: agent | Size: S

## What solving this does

One command serves the app and the API locally with no dependencies, from an allowlist so nothing else in the repo is exposed.

Files: create `backend/scripts/serve.js`, `backend/tests/serve.test.js`, `package.json`

## Scope

In: Allowlisted static files, `/api/<name>` mounting, `npm start`.
Out: Deploying.

## Acceptance criteria

1. Only the app, `rules.js` and `docs/*.pdf` are served.
2. `.env`, `backend/data` and path tricks return 404.
3. API functions answer at `/api/<name>`.

## Tests

handler over real HTTP (`serve.test.js`).

## Sources

`backend/reminders.md` R12; `.claude/CONTEXT.MD` "Running it locally".

## Notes

Binds to 127.0.0.1.
