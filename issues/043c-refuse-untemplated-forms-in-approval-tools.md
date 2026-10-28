# 043c: Refuse untemplated forms in `request_approval` and `hand_off` with `NO_TEMPLATE`
Status: todo | Depends on: 043 | Owner: agent | Size: S

## What solving this does

A form with no template cannot be requested or handed over. Today it can go to the seller, because a code with no `DOCS` entry counts as seller-side.

Files: modify `backend/approvals.js` | modify `backend/tests/approvals.test.js`

## Scope

In: `request_approval` and `hand_off` refuse a request that names a form with no template.
Out: Other tools (035 covers `save_answers` and `ask_next_question`).

## Acceptance criteria

1. `request_approval` with a form that has no template returns `ok: false`, code `NO_TEMPLATE`, fixed text with no form name, and records nothing.
2. `hand_off` with such a form returns the same, and does not consume a grant.
3. The check uses the same rule as the other tools (a code with no `DOCS` entry), not a second list.
4. Forms with a template behave as before.

## Tests

handler: each tool with an untemplated code; the grant stays unconsumed; mutation check on the rule.

## Sources

`docs/adr/0013-remaining-tool-signatures.md`; `backend/reminders.md` R9.

## Notes

`NO_TEMPLATE` is a permanent transport code (ADR 0013). Reachable only for the broker, since untemplated codes are seller-side.
