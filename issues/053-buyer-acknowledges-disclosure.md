# 053: Buyer acknowledges a disclosure
Status: todo | Depends on: 051, 047 | Owner: agent | Size: S

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

Decided in ticket 024 (ADR 0013). Appends `{form, by, at}` to `deal.acknowledgements`; no snapshot or lock check; a form outside the buyer's view (own forms plus forms delivered to it) is `ROLE_FORBIDDEN`; a repeat returns `ok: true`, `already: true`, the original time, and writes nothing. Depends on 047 because the buyer sees no seller disclosure until the broker delivers one (`deal.delivered`); 053 can only be built once 047 has decided which forms qualify.
