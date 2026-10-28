# 037: `save_answers` write refusals
Status: review pending | Depends on: 034, 023 | Owner: agent | Size: M

## What solving this does

A write the role may not make, or that a lock or an approval forbids, is refused with the right code and next step.

Files: modify `backend/tools.js`, `backend/status.js` (only if ticket 023 requires) | create `backend/tests/tools_refusals.test.js`

## Scope

In: `ROLE_FORBIDDEN`, `FORM_NOT_REQUIRED`, `POST_APPROVAL_CHANGE`, `FORM_LOCKED`, in that order.
Out: `APPROVAL_REQUIRED` for actions (043).

## Acceptance criteria

1. Each code fires only in its situation.
2. The order is role, required, approved snapshot, lock.
3. A role learns nothing about a form it may not touch.
4. The reply tells the person the next step.

## Tests

handler: one case per code, plus ordering.

## Sources

`.scratch/role-based-chat-agent/spec.md` Status codes; `.claude/CONTEXT.MD` Status codes; ticket 023.

## Notes

Uses the shapes decided in ticket 023.
