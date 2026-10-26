# 006: Ten status codes and the write guard
Status: done | Depends on: 004 | Owner: agent | Size: M

## What solving this does

The ten status codes exist, and a guard decides which one refuses a write or a gated action. A role learns nothing about a form it may not touch.

Files: create `backend/status.js`, `backend/tests/status.test.js` | reference `backend/roles.js`

## Scope

In: The code list, `guardWrite` (role, required, approved snapshot, lock) and `guardAction` (approval required).
Out: Wiring into tools; final state shapes (ticket 023).

## Acceptance criteria

1. Ten codes, no more.
2. Write checks run in the confirmed order.
3. `APPROVAL_REQUIRED` never comes from a form write.
4. Gated actions are refused until approved per action.

## Tests

shared rules/guard unit tests (`status.test.js`).

## Sources

`.scratch/role-based-chat-agent/spec.md` Status codes and approvals; `.claude/CONTEXT.MD` "Status codes (locked: ten)"; ADR 0002.

## Notes

The guard reads `deal.approval.snapshot`, `deal.locks` and `deal.approvals`. Those shapes are guesses until ticket 023.
