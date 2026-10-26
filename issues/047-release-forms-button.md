# 047: Release forms button
Status: todo | Depends on: 043 | Owner: agent | Size: M

## What solving this does

The broker can release forms to the buyer or lender with a button. Nobody else can.

Files: create `api/release.js`, `backend/tests/release.test.js` | modify `index.html`

## Scope

In: The button and endpoint.
Out: Messages (049).

## Acceptance criteria

1. Release is refused for non-brokers.
2. Released forms become visible to the target role only.
3. It is audited.

## Tests

handler.

## Sources

`.scratch/role-based-chat-agent/spec.md` Status codes and approvals.

## Notes

No model tool exists for this.
