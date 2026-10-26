# 033: `ask_next_question` picks the question in code
Status: review pending | Depends on: 024, 031 | Owner: agent | Size: M

## What solving this does

The assistant asks the single most useful unanswered question, chosen by code from the shared rules. The model only phrases it.

Files: modify `backend/tools.js`, `rules.js` (add the ranking function only), `backend/tests/rules.test.js` | create `backend/tests/tools_ask_next.test.js` | reference `backend/fixtures.js`

## Scope

In: The tool, the ranking, the end case.
Out: Saving the answer (034).

## Acceptance criteria

1. It returns the unanswered question that unblocks the most forms, with the chosen tie-break.
2. Questions whose conditions are not met are skipped.
3. When none is left it says so.
4. The model never chooses the question.
5. For every role except the seller, `waterHeater`, `smokeAlarm` and `coDetector` are skipped and never counted as candidates (ADR 0010). The list is a constant in `backend/tools.js`, created here and enforced in 039; the browser's `nextQ()` is unchanged.

## Tests

handler and shared rules: ranking on the five CASES.

## Sources

`.scratch/role-based-chat-agent/spec.md` Tools; `.claude/CONTEXT.MD` Tools; ticket 024.

## Notes

If ticket 024 keeps question order instead of unblock count, this ticket is simpler. Adding a ranking function to `rules.js` is allowed here; changing existing rules is not.
