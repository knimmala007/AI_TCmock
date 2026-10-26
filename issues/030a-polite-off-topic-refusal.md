# 030a: Polite off-topic refusal
Status: todo | Depends on: 027d, 030 | Owner: agent | Size: S

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
