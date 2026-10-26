# 021: Deploy the health check to a Vercel preview
Status: todo | Depends on: 019, 020 | Owner: human | Size: S

## What solving this does

The owner deploys a preview and confirms the platform serves the API and the shared module without changing hosting settings. This answers the hosting questions before bigger features depend on it.

Files: modify `backend/reminders.md` (record the result) | reference `vercel.json` (do not edit), `package.json`

## Scope

In: One preview deployment and a short written result.
Out: Setting secrets (ticket 028); the full demo (ticket 044).

## Acceptance criteria

1. The preview serves `/api/health` with 200.
2. The reported Node version is 22 or later.
3. `api/` functions are served without editing `vercel.json`.
4. The counts show `rules.js` and the fixtures were bundled.
5. `/api/demo-session` and `/api/events` are reachable (503 or 401 is expected before variables are set).
6. The page loads `rules.js` as a module over https.
7. Findings, including any need to change `vercel.json`, are recorded in the reminders.

## Tests

Manual check against the preview URL.

## Sources

`backend/reminders.md` R12, R15; developer rules in `agents/03-developer/CLAUDE.md`.

## Notes

Agents do not deploy or change Vercel settings; this is the owner's step.
