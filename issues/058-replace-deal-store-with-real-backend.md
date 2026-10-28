# 058: Replace the deal store with the real backend
Status: blocked | Depends on: 027 | Owner: agent | Size: L

## What solving this does

The repository talks to the real backend, and the fixtures are replaced by real data.

Files: modify `backend/repository.js`, `backend/fixtures.js` source | reference all tools

## Scope

In: The swap in one place, then test, check and modify.
Also in: the real backend stores the broker inbox from ticket 050 as its own storage keyed by deal id that implements add(item) and list(dealId) (a table if the backend is SQL, or the same KV if not), with the fields `ticket_id`, deal id, asking role, question and `created_at`, and the same read rules (broker-only `GET /api/inbox`, no model call).
Out: New features.

## Acceptance criteria

1. Only the repository changed; if the tools or prompts had to change, the seam is fixed.
2. The full suite passes against the real backend.
3. Stages, rules and the tested list are confirmed against it.
4. The inbox survives the swap and the 050 tests still pass against the real store.

## Tests

handler: rerun everything.

## Sources

`backend/reminders.md` R1, R2, R3, R4, R5.

## Notes

Blocked on the real backend and data.

The inbox (ticket 050, `backend/inbox.js`) is its own store, not part of the deal file, so it moves to the real backend as its own storage keyed by deal id that implements add(item) and list(dealId) (a table if the backend is SQL, or the same KV if not) (`ticket_id`, deal id, asking role, question, `created_at`). The read rules do not change: only the broker reads it, through `GET /api/inbox`, with no model call, and the question text never reaches a model.
