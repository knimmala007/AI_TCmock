# 058: Replace the deal store with the real backend
Status: blocked | Depends on: 027 | Owner: agent | Size: L

## What solving this does

The repository talks to the real backend, and the fixtures are replaced by real data.

Files: modify `backend/repository.js`, `backend/fixtures.js` source | reference all tools

## Scope

In: The swap in one place, then test, check and modify.
Out: New features.

## Acceptance criteria

1. Only the repository changed; if the tools or prompts had to change, the seam is fixed.
2. The full suite passes against the real backend.
3. Stages, rules and the tested list are confirmed against it.

## Tests

handler: rerun everything.

## Sources

`backend/reminders.md` R1, R2, R3, R4, R5.

## Notes

Blocked on the real backend and data.
