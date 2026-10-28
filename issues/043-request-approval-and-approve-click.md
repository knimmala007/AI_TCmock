# 043: Request approval and the broker's Approve click
Status: review pending | Depends on: 023, 029, 031 | Owner: agent | Size: M

## What solving this does

The assistant can ask for approval, but only the broker can grant it, with a button. Handing the package to another role is refused until then.

Files: create `backend/approvals.js`, `api/approve.js`, `backend/tests/approvals.test.js` | modify `backend/tools.js` | reference `backend/status.js`, `backend/repository.js`

## Scope

In: `request_approval`, the Approve endpoint, `hand_off`, the audit entry.
Out: The other gated actions (046 to 049).

## Acceptance criteria

1. `hand_off` returns `APPROVAL_REQUIRED` until the broker has approved that action.
2. The Approve endpoint re-checks that the session is the broker and refuses everyone else.
3. The approval is recorded per action and no tool the model can call writes it.
4. The approval is written to the event log.
5. After approval `hand_off` succeeds.
6. A successful `hand_off` appends `{from, to, forms, at, approval}` to the deal (ADR 0011), with `approval` the grant's `granted_by` and `granted_at`, and marks that grant consumed (ADR 0007).
7. The next role sees only the forms released to it and a note of who handed off and when, never the earlier chat.
8. Release (access) and hand-off (assignment) stay separate. When `to` is the buyer or lender, every form in `forms` must already be released to that role, otherwise `hand_off` is refused. Releasing is ticket 047, so until it exists nothing is released and a hand-off to a buyer or lender is refused.

## Tests

handler: each role presses Approve; scripted model calls `hand_off` before and after.

## Sources

`.scratch/role-based-chat-agent/spec.md` Status codes and approvals; ADR 0002; ticket 023.

## Notes

Pattern for tickets 046 to 049.

The Approve button is not built here: it moves to ticket 043b (`index_v2.html`), which waits on 043 and the port ticket 063. This ticket delivers the endpoint and the tool; until 043b the endpoint is reachable only by a direct call.
