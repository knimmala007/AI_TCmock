# 042: Evaluation against the Cottage Grove deal
Status: todo | Depends on: 038, 040 | Owner: agent | Size: M

## What solving this does

A repeatable script runs the broker assistant against the real Cottage Grove deal and the synthetic Austin deal and records what happened, so every change can be re-checked.

Files: create `backend/scripts/eval.js`, `backend/tests/eval.test.js`, `backend/evals/README.md` | reference `backend/fixtures.js`, `backend/tools.js`

## Scope

In: A scripted mode for tests; an optional real-model mode run by hand.
Out: Real backend data.

## Acceptance criteria

1. The scripted mode runs the same scenarios every time and fails on a regression.
2. Scenarios cover: ask the next question, save an answer, an untested city, an invented field, a legal question, a buyer attack.
3. The real-model mode needs the owner's key and is never run by tests.
4. Results are written to a file that is not committed by default.

## Tests

handler: scripted mode.

## Sources

`.claude/CONTEXT.MD` Build methodology step 10; `backend/reminders.md` R2.

## Notes

The method says rerun after every change.
