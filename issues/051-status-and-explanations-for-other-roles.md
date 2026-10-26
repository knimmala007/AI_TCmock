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

Explanation source is a decision.
