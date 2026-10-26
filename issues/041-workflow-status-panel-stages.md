# 041: Workflow status panel shows the stages
Status: todo | Depends on: 025, 029, 031 | Owner: agent | Size: M

## What solving this does

The workflow status panel shows the deal's stage from the same source the assistant uses.

Files: modify `index.html` | create `backend/tests/status_panel.test.js` | reference `backend/fixtures.js`

## Scope

In: The panel for each role, as decided.
Out: New stages.

## Acceptance criteria

1. The panel shows the six seller stages for the roles decided in ticket 025.
2. It matches what `get_deal` returns.

## Tests

handler: stub-DOM render.

## Sources

`backend/reminders.md` R4; `.scratch/role-based-chat-agent/spec.md` Data and platform.

## Notes

Mapping to the party-step view is agreed with Ethan.
