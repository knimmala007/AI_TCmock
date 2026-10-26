# 035: Forms with no template are flagged, not filled
Status: todo | Depends on: 034 | Owner: agent | Size: S

## What solving this does

A required form that has no template is reported to the user and never written.

Files: modify `backend/tools.js`, `backend/tests/tools_save_answers.test.js`

## Scope

In: The flag for the 13 template-less codes.
Out: Creating templates.

## Acceptance criteria

1. Writing to any of the 13 codes does nothing and says the form needs a template.
2. `get_deal` and `flag_missing` list them as flagged.

## Tests

handler.

## Sources

`backend/reminders.md` R9; decision in ticket 018.

## Notes

How the flag is worded is set in ticket 024.
