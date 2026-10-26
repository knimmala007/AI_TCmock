# 054: Lender view in the app
Status: todo | Depends on: 029 | Owner: agent | Size: M

## What solving this does

The app gets a fourth view so the role switcher can pick Lender.

Files: modify `index.html` | create `backend/tests/lender_view.test.js`

## Scope

In: The view and switcher entry; the Lender sees only the appraisal.
Out: Clear to close (055).

## Acceptance criteria

1. The Lender view exists and the switcher can select it.
2. It shows only the appraisal, and only when the buyer is financing.
3. The page and `roles.js` still give the same documents.

## Tests

handler: stub-DOM render and parity.

## Sources

`backend/reminders.md` R6, R8; `.scratch/role-based-chat-agent/spec.md` Tools.

## Notes

The app has no Lender view today.
