# 051: Status and form explanations for seller, buyer and lender
Status: todo | Depends on: 050 | Owner: agent | Size: M

## What solving this does

The other three roles can ask where the deal stands and what a form is for, limited to what they may see.

Files: modify `backend/tools.js` | create `backend/tests/tools_status_explain.test.js`

## Scope

In: `get_deal_status`, `explain_form`.
Out: Writing answers.

## Acceptance criteria

1. Each role sees only its own documents and the stage decided in ticket 025.
2. Explanations come from the decided source and never include legal advice.
3. A form the role may not see is refused.

## Tests

handler: each role.

## Sources

`.scratch/role-based-chat-agent/spec.md` Tools; tickets 024, 025.

## Notes

Decided in ticket 024 (ADR 0013). `get_deal_status` stays an alias of `get_deal`. `explain_form({code})` returns repo text only (`DOCS` metadata plus the question text and why), no model-written law. A code the role may not see is `ROLE_FORBIDDEN`; a visible code the deal does not require is `FORM_NOT_REQUIRED`; a visible code with no template returns `ok: true` and a fixed flag-only note.
