# 043: Request approval and the broker's Approve click
Status: todo | Depends on: 023, 029, 031 | Owner: agent | Size: M

## What solving this does

The assistant can ask for approval, but only the broker can grant it, with a button. Handing the package to another role is refused until then.

Files: create `backend/approvals.js`, `api/approve.js`, `backend/tests/approvals.test.js` | modify `backend/tools.js`, `index.html` (Approve button) | reference `backend/status.js`

## Scope

In: `request_approval`, the Approve endpoint, `hand_off`, the audit entry.
Out: The other gated actions (046 to 049).

## Acceptance criteria

1. `hand_off` returns `APPROVAL_REQUIRED` until the broker has approved that action.
2. The Approve endpoint re-checks that the session is the broker and refuses everyone else.
3. The approval is recorded per action and no tool the model can call writes it.
4. The approval is written to the event log.
5. After approval `hand_off` succeeds.

## Tests

handler: each role presses Approve; scripted model calls `hand_off` before and after.

## Sources

`.scratch/role-based-chat-agent/spec.md` Status codes and approvals; ADR 0002; ticket 023.

## Notes

Pattern for tickets 046 to 049.
