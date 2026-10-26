# 061: Remove `aiagent` and add `lender` in the Kialae `scope.js`
Status: blocked | Depends on: 014 | Owner: human | Size: S

## What solving this does

The other branch's role code matches the docs: no `aiagent`, and a `lender`.

Files: modify the Kialae branch's `api/_lib/scope.js` | reference `agents/00-orchestrator/contracts.md`

## Scope

In: That one change and its isolation tests, on that branch.
Out: This branch.

## Acceptance criteria

1. `ROLE_VIEWS` has no `aiagent` and has `lender`.
2. The role-isolation tests pass there.
3. The "legacy" wording in the `agents/` docs is then deleted.

## Tests

Role-isolation tests on that branch.

## Sources

`backend/reminders.md` R13; ticket 014.

## Notes

Blocked: different branch, owner decision.
