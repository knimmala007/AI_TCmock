# 007: Deal storage: memory, file and Upstash behind one repository
Status: done | Depends on: 003 | Owner: agent | Size: M

## What solving this does

All deal data goes through one repository whose storage is chosen by environment: memory in tests, a file in local development, Upstash when hosted.

Files: create `backend/kv.js`, `backend/repository.js`, `backend/runtime.js`, `backend/scripts/reset_demo_data.js`, tests | reference `backend/fixtures.js`

## Scope

In: Key-value interface, repository, runtime selection, reset script.
Out: The real backend client (ticket 058).

## Acceptance criteria

1. The repository is the only reader and writer of deal data.
2. Hosted without Upstash it refuses to start.
3. Upstash is reached with `fetch`; no dependency was added.

## Tests

Unit tests with a fake `fetch` (`kv.test.js`, `repository.test.js`, `runtime.test.js`).

## Sources

ADR 0003; `backend/reminders.md` R1, R10.

## Notes

Upstash has not been tried against the real service (R10; ticket 044).
