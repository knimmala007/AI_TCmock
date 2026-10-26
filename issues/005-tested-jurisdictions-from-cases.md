# 005: Tested jurisdictions come from the app's cases
Status: done | Depends on: 001 | Owner: agent | Size: S

## What solving this does

The list of tested cities and counties is exactly what the app's five CASES exercise. Everything else counts as untested.

Files: modify `backend/config.js`, `backend/tests/rules.test.js` | reference `index.html` (CASES)

## Scope

In: San Jose, San Francisco and Los Angeles with their counties; accent-insensitive matching.
Out: The decline behavior (ticket 038).

## Acceptance criteria

1. The list is derived from the CASES by a test and matches exactly.
2. `San José` and `San Jose` match.
3. Austin and Berkeley are untested.

## Tests

shared rules: derived from the CASES.

## Sources

`backend/reminders.md` R5; `.scratch/role-based-chat-agent/spec.md` Guardrails.

## Notes

"Tested" means a CASE exercises it, not that a real deal verified it. San Francisco and Los Angeles are the places the Evaluation tab once got wrong.
