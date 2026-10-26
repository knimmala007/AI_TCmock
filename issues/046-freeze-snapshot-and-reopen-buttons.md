# 046: Freeze snapshot and Reopen buttons
Status: todo | Depends on: 023, 037, 043 | Owner: agent | Size: M

## What solving this does

The broker can freeze the approved package and reopen it. After reopening, the assistant can change forms again.

Files: create `api/snapshot.js`, `backend/tests/snapshot.test.js` | modify `index.html`, `backend/approvals.js`

## Scope

In: Two buttons and their endpoints.
Out: Releasing forms (047).

## Acceptance criteria

1. Freezing records the snapshot and later writes return `POST_APPROVAL_CHANGE`.
2. Reopen is broker-only and clears it.
3. Both are audited.
4. No tool the model can call does either.

## Tests

handler.

## Sources

`.scratch/role-based-chat-agent/spec.md` Status codes and approvals; ticket 023.

## Notes

There is no tool for these; they are buttons only.
