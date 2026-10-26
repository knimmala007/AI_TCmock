# 056: Berkeley and Oakland cases
Status: todo | Depends on: 005 | Owner: agent | Size: S

## What solving this does

Two more cases exercise Berkeley and Oakland so those cities can become tested.

Files: modify `index.html` (CASES), `backend/config.js`, `backend/tests/rules.test.js`

## Scope

In: Two CASES and the list update.
Out: Other rules.

## Acceptance criteria

1. Each new CASE reaches 100% and asserts its city forms.
2. The tested list gains Berkeley and Oakland with their county.
3. The test that derives the list from the CASES still passes.

## Tests

shared rules.

## Sources

`backend/reminders.md` R5.

## Notes

Adding CASES changes the app's Test Lab; check with Ethan.
