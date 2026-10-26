# 052: Seller answers intake questions
Status: todo | Depends on: 034, 051 | Owner: agent | Size: M

## What solving this does

The seller can answer the questions that belong to the seller, through the chat.

Files: modify `backend/tools.js`, `backend/roles.js` (data filter) | create `backend/tests/tools_seller.test.js`

## Scope

In: `save_answers` limited to the seller's keys and forms.
Out: Broker-only questions.

## Acceptance criteria

1. A seller can save seller-side answers.
2. A seller cannot save a buyer-side or broker-only key.
3. The refusal explains the next step.

## Tests

handler.

## Sources

`.scratch/role-based-chat-agent/spec.md` Tools.

## Notes

Which keys are the seller's is part of the data filter.
