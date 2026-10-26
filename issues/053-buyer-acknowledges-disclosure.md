# 053: Buyer acknowledges a disclosure
Status: todo | Depends on: 051 | Owner: agent | Size: S

## What solving this does

The buyer can record that they opened and acknowledged a disclosure.

Files: modify `backend/tools.js` | create `backend/tests/tools_buyer.test.js`

## Scope

In: `acknowledge_disclosure`.
Out: Signing.

## Acceptance criteria

1. It records who acknowledged which form and when.
2. Only the buyer can call it.
3. It cannot touch a form outside the buyer's view.

## Tests

handler.

## Sources

`.scratch/role-based-chat-agent/spec.md` Tools.

## Notes

May need a human attestation rule (ticket 025).
