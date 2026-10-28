# 036: `save_answers` field-name guard and batch cap
Status: review pending | Depends on: 034 | Owner: agent | Size: S

## What solving this does

The assistant cannot save to a field name it invented, and cannot send more than 15 facts at once.

Files: modify `backend/tools.js` | create `backend/tests/tools_field_guard.test.js` | reference `backend/threads.js`

## Scope

In: The seen-name check and the cap.
Out: Other validation (039).

## Acceptance criteria

1. A field name not seen in earlier results is rejected with the list of valid names.
2. More than 15 facts in one call is refused.

## Tests

handler: scripted model invents `school_district_disclosure`.

## Sources

`.scratch/role-based-chat-agent/spec.md` Guardrails; `.claude/CONTEXT.MD` "No-invented-field-names".

## Notes

This was a real bug.
