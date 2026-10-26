# 030a: Polite off-topic refusal
Status: review pending | Depends on: 027d, 030 | Owner: agent | Size: S

## What solving this does

A question that is not about the deal gets a short, polite decline and a pointer back to the deal.

Files: modify `backend/prompts.js` | create `backend/tests/` (new test file)

## Scope

In: One additive rule in the CORE text of `backend/prompts.js`.
Out: A new status code (the ten are locked), a new guard, tool names in the prompt.

## Acceptance criteria

1. The CORE text gains one rule; no existing line is changed or removed.
2. An off-topic turn gets the decline unchanged, calls no tool, and the thread stores it.
3. An ordinary deal question is unaffected.
4. No new status code, no new guard, no tool name in the prompt.

## Tests

handler: scripted fake model. An off-topic turn returns the decline unchanged, calls no tool, and the thread stores it. An ordinary deal question behaves as before. Never assert on prompt wording.

## Sources

`.scratch/role-based-chat-agent/spec.md` Guardrails; tickets 027d, 030.

## Notes

The fake model proves the plumbing only. Real behaviour is checked with one off-topic question in the 028a manual run.

## Mutation checks (run, then reverted)

Test file: `backend/tests/off_topic_refusal.test.js`. Each mutation was made in production code, the file was run, and the file was restored with `git checkout`.

| Mutation | Caught by |
|---|---|
| `agent_handler.js`: drop the assistant save | the 4 off-topic tests and the deal-question test (thread assertions) |
| `agent_handler.js`: append text to the reply | the same 5 tests (unchanged-reply assertions) |
| `agent_loop.js`: run a tool the model did not request | the same 5 tests (tool counter) |
| `agent_handler.js`: always add a `status` field | the same 5 tests (no-status and exact-keys assertions) |

These tests prove plumbing only. No test can fail if the prompt rule is deleted or reworded; that is checked in the 028a manual run.
